import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEXI_TERRAIN_GOLD_FIELD_DEFAULTS,
  LEXI_TERRAIN_GOLD_FIELD_ID,
  LEXI_TERRAIN_GOLD_FIELD_KICK_TAU,
  LEXI_TERRAIN_GOLD_FIELD_PERIOD_SEC,
  createTerrainMotionState,
  fieldFrameKey,
  fieldLowMid,
  fieldSampleBrightness,
  fieldSparkBudget,
  lexiTerrainGoldFieldScene,
  stepFieldMotion,
  terrainHeight,
  terrainSurfaceHash,
  terrainSurfaceKey,
} from "./lexi-terrain-gold-field";
import {
  createTerrainMotionState as createMg,
  stepTerrainMotion,
  terrainHeight as motionGateHeight,
} from "./lexi-terrain-gold";
import { getCatalogEntry } from "./catalog";
import { builtinScenes } from "./index";

function silent(timeMs: number) {
  return { timeMs, rms: 0, bass: 0, mid: 0, treble: 0, kick: 0, beatPulse: 0 };
}

function music(timeMs: number) {
  const t = timeMs / 1000;
  const kick = t % 0.5 < 0.04 ? 1 : 0;
  return { timeMs, rms: 0.42, bass: 0.55, mid: 0.4, treble: 0.22, kick, beatPulse: kick };
}

function maxAbs(a: readonly number[], b: readonly number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  return m;
}

describe("LEXI Terrain Gold · Field Draw catalog", () => {
  it("keeps its own id and does not overwrite MotionGate or P12", () => {
    expect(LEXI_TERRAIN_GOLD_FIELD_ID).toBe("lexi-terrain-gold-field");
    expect(lexiTerrainGoldFieldScene.id).toBe("lexi-terrain-gold-field");
    expect(lexiTerrainGoldFieldScene.name).toBe("Terrain Gold · Field Draw");
    expect(getCatalogEntry("lexi-terrain-gold-field")).toMatchObject({
      id: "lexi-terrain-gold-field",
      displayName: "Terrain Gold · Field Draw",
      renderer: "lexi-terrain-gold-field",
      family: "LEXI Terrain Gold",
      params: LEXI_TERRAIN_GOLD_FIELD_DEFAULTS,
    });
    expect(getCatalogEntry("lexi-terrain-gold")?.displayName).toBe("Terrain Gold · MotionGate");
    expect(getCatalogEntry("lexi-terrain-gold-p12")?.displayName).toBe("Terrain Gold · Pass 1+2 (clock)");
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold-field")).toBe(true);
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold")).toBe(true);
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold-p12")).toBe(true);
  });

  it("reuses MotionGate terrainHeight (same function)", () => {
    expect(terrainHeight).toBe(motionGateHeight);
    expect(terrainHeight(0.4, 0.5, 0.2, { bass: 0.5 })).toBe(
      motionGateHeight(0.4, 0.5, 0.2, { bass: 0.5 }),
    );
    expect(LEXI_TERRAIN_GOLD_FIELD_PERIOD_SEC).toBe(12);
    expect(LEXI_TERRAIN_GOLD_FIELD_KICK_TAU).toBe(0.5);
  });

  it("draw path is strokes + points — no dune fill / Lambert skin", () => {
    const src = readFileSync(new URL("./lexi-terrain-gold-field.ts", import.meta.url), "utf8");
    expect(src).toMatch(/FIELD DRAW PATH/);
    expect(src).toMatch(/ctx\.stroke\(/);
    expect(src).toMatch(/fillRect\(x - pr/);
    expect(src).not.toMatch(/fillRibbon/);
    expect(src).not.toMatch(/Lambert|lambert/);
    expect(src).not.toMatch(/ctx\.rotate\s*\(/);
    expect(src).not.toMatch(/meridian/);
    expect(src).not.toMatch(/function terrainHeight/);
  });

  it("lowMid / sparks are documented maps, not color-as-EQ", () => {
    expect(fieldLowMid({ mid: 0.5, bass: 0.5 })).toBeCloseTo(0.5 * 0.72 + 0.5 * 0.18, 10);
    expect(fieldLowMid({ mid: 0, bass: 0 })).toBe(0);
    expect(fieldSparkBudget({ mid: 0, treble: 0 })).toBe(0);
    expect(fieldSparkBudget({ mid: 0.8, treble: 0.6 }, 0.8)).toBeGreaterThan(0);
    expect(fieldSparkBudget({ mid: 1, treble: 1 }, 1)).toBeLessThanOrEqual(10);
  });

  it("valleys are almost dead; ridges emit", () => {
    let maxRidge = 0;
    let minRidge = 1;
    let maxBright = 0;
    let minBright = 1;
    for (let i = 0; i <= 24; i++) {
      const sample = fieldSampleBrightness(i / 24, 0.7, 0.1, {}, { depthAttenuation: 0.62, gate: 1 });
      maxRidge = Math.max(maxRidge, sample.ridgeMask);
      minRidge = Math.min(minRidge, sample.ridgeMask);
      maxBright = Math.max(maxBright, sample.bright);
      minBright = Math.min(minBright, sample.bright);
    }
    expect(maxRidge).toBeGreaterThan(0.4);
    expect(minRidge).toBeLessThan(0.15);
    expect(maxBright).toBeGreaterThan(minBright);
  });
});

describe("LEXI Terrain Gold · Field Draw A/B", () => {
  it("A: audio on — u advances and surface key changes", () => {
    const s = createTerrainMotionState();
    const key0 = terrainSurfaceKey(s.u);
    const hash0 = terrainSurfaceHash(key0);
    const frame0 = terrainSurfaceHash(fieldFrameKey(s));
    const dt = 1 / 30;
    for (let i = 1; i <= 240; i++) {
      stepFieldMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.35, periodSec: 12 });
    }
    const deform = { bass: 0.55, kickEnv: s.kickEnv };
    const key1 = terrainSurfaceKey(s.u, 24, 16, deform);
    const hash1 = terrainSurfaceHash(key1);
    const frame1 = terrainSurfaceHash(fieldFrameKey(s, deform));
    const delta = maxAbs(key0, key1);
    expect(s.u).toBeGreaterThan(0.01);
    expect(s.gate).toBeGreaterThan(0.2);
    expect(fieldLowMid(music(1000))).toBeGreaterThan(0.2);
    expect(delta).toBeGreaterThan(0.05);
    expect(hash1).not.toBe(hash0);
    expect(frame1).not.toBe(frame0);
    // numeric proof captured for the deliverable
    expect({
      A_u: s.u,
      A_gate: s.gate,
      A_hash0: hash0,
      A_hash1: hash1,
      A_delta: delta,
    }).toEqual(expect.objectContaining({ A_u: expect.any(Number) }));
  });

  it("B: features=0 after kick/sub decay — zero travel while timeMs advances", () => {
    const s = createTerrainMotionState();
    const dt = 1 / 30;
    stepFieldMotion(s, { timeMs: 0, rms: 0, bass: 0, mid: 0, kick: 1, beatPulse: 1 }, { dt });
    // kickTau 0.5 ⇒ settle ~6s (180 frames) so kickEnv/gate hit the 1e-4 floor
    for (let i = 1; i <= 180; i++) {
      stepFieldMotion(s, silent(i * dt * 1000), { dt });
    }
    expect(s.kickEnv).toBe(0);
    expect(s.gate).toBe(0);

    const uFrozen = s.u;
    const key0 = terrainSurfaceKey(s.u);
    const hash0 = terrainSurfaceHash(key0);
    const frame0 = terrainSurfaceHash(fieldFrameKey(s));

    for (let i = 181; i <= 181 + 240; i++) {
      stepFieldMotion(s, silent(i * dt * 1000), { dt });
    }

    const key1 = terrainSurfaceKey(s.u);
    expect(s.u).toBe(uFrozen);
    expect(s.gate).toBe(0);
    expect(s.kickEnv).toBe(0);
    expect(maxAbs(key0, key1)).toBe(0);
    expect(terrainSurfaceHash(key1)).toBe(hash0);
    expect(terrainSurfaceHash(fieldFrameKey(s))).toBe(frame0);
    expect({ B_u: s.u, B_hash: hash0, B_frames: 240 }).toEqual(
      expect.objectContaining({ B_u: uFrozen, B_hash: hash0 }),
    );
  });

  it("kick does not reset u; Field kickEnv outlasts MotionGate default tau", () => {
    const field = createTerrainMotionState(0.4);
    stepFieldMotion(field, { timeMs: 16, rms: 0.3, bass: 0.3, mid: 0.2, kick: 1, beatPulse: 1 }, { dt: 1 / 30 });
    expect(field.u).not.toBe(0);
    expect(field.u).toBeGreaterThan(0.3);

    const mg = createMg();
    const fd = createTerrainMotionState();
    stepTerrainMotion(mg, { timeMs: 0, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt: 1 / 30 });
    stepFieldMotion(fd, { timeMs: 0, rms: 0, bass: 0, mid: 0, kick: 1, beatPulse: 1 }, { dt: 1 / 30 });
    for (let i = 1; i <= 20; i++) {
      const t = i * (1 / 30) * 1000;
      stepTerrainMotion(mg, silent(t), { dt: 1 / 30 });
      stepFieldMotion(fd, silent(t), { dt: 1 / 30 });
    }
    expect(fd.kickEnv).toBeGreaterThan(mg.kickEnv);
    expect(fd.kickEnv).toBeGreaterThan(0.15);
  });

  it("MotionGate defaults are unchanged when kickTau/travelScale are omitted", () => {
    const a = createMg();
    const b = createMg();
    const feat = { timeMs: 16, rms: 0.4, bass: 0.4, kick: 0, beatPulse: 0 };
    stepTerrainMotion(a, feat, { dt: 1 / 30, flowSpeed: 0.35, periodSec: 12 });
    stepTerrainMotion(b, feat, { dt: 1 / 30, flowSpeed: 0.35, periodSec: 12, kickTau: 0.16, travelScale: 1 });
    expect(a.u).toBe(b.u);
    expect(a.gate).toBe(b.gate);
  });
});
