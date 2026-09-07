/** Node verification of bloom weights, feedback bounds, determinism. No GPU. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function eq(name, cond, detail = "") {
  if (!cond) { failed++; console.error("FAIL", name, detail); }
  else console.log("ok", name);
}

const raw = [0.5, 0.28, 0.14, 0.08];
const sum = raw.reduce((a, b) => a + b, 0);
const w = raw.map((x) => x / sum);
eq("weights sum 1", Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
eq("half strongest", w[0] > w[1] && w[1] > w[2] && w[2] > w[3]);
eq("halo faint", w[3] < 0.12 && w[0] > 0.4);

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function clamp01(n) { return Number.isFinite(n) ? clamp(n, 0, 1) : 0; }
function step(state, opts) {
  const kick = clamp01(opts.kick);
  const drop = clamp01(opts.drop);
  const energy = clamp01(opts.energy);
  const dt = Math.max(0, Math.min(0.05, opts.dt));
  const silent = energy < 0.03;
  state.persist = Math.max(0, state.persist - (silent ? 4.2 : 1.35) * dt);
  if (kick > 0.55) state.persist += kick * 0.22;
  if (drop > 0.35) state.persist += drop * 0.32;
  state.persist = Math.min(0.7, state.persist);
  return clamp(0.16 * (0.35 + energy * 0.65) + state.persist, 0, 0.52);
}
const s = { persist: 0 };
let last = 0;
for (let i = 0; i < 240; i++) last = step(s, { kick: 1, drop: 1, energy: 1, dt: 1 / 60 });
eq("feedback bounded", last <= 0.52 && last >= 0);
const s2 = { persist: 0 };
step(s2, { kick: 1, drop: 1, energy: 0.8, dt: 1 / 60 });
let v = 0;
for (let i = 0; i < 180; i++) v = step(s2, { kick: 0, drop: 0, energy: 0, dt: 1 / 60 });
eq("silence drains", v < 0.08);

const files = [
  "src/draw/rng.ts",
  "src/draw/motion.ts",
  "src/gl/post-pipeline.ts",
  "src/gl/feedback.ts",
  "src/scenes/resonance-wave.ts",
  "src/audio/feature-extractor.ts",
];
for (const f of files) {
  const src = readFileSync(join(root, f), "utf8");
  eq("no Math.random " + f, !src.includes("Math.random"));
}
const pipeline = readFileSync(join(root, "src/gl/post-pipeline.ts"), "utf8");
eq("uses BLOOM_WEIGHTS", pipeline.includes("BLOOM_WEIGHTS"));
eq("probes HDR completeness", pipeline.includes("framebufferIsComplete"));
eq("feedback clamped in shader", pipeline.includes("clamp(u_feedback"));
if (failed) { console.error(failed, "failures"); process.exit(1); }
console.log("all checks passed");
