import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KALEIDO_CRYSTAL_DEFAULTS,
  KALEIDO_CRYSTAL_ID,
  kaleidoCrystalScene,
  stepKaleidoMotion,
  createKaleidoMotionState,
} from "./kaleido-crystal";
import { kaleidoPoseHash, kaleidoPoseKey } from "./kaleido-math";
import { getCatalogEntry } from "./catalog";
import { builtinScenes } from "./index";

function silent(timeMs: number) {
  return { timeMs, rms: 0, bass: 0, kick: 0, beatPulse: 0 };
}

function music(timeMs: number) {
  const t = timeMs / 1000;
  const kick = t % 0.5 < 0.04 ? 1 : 0;
  return { timeMs, rms: 0.42, bass: 0.55, kick, beatPulse: kick };
}

describe("Kaleido · Crystal", () => {
  it("keeps its own id and does not overwrite kaleido-loop presets", () => {
    expect(KALEIDO_CRYSTAL_ID).toBe("kaleido-crystal");
    expect(kaleidoCrystalScene.id).toBe("kaleido-crystal");
    expect(kaleidoCrystalScene.name).toBe("Kaleido · Crystal");
    expect(getCatalogEntry("kaleido-crystal")).toMatchObject({
      id: "kaleido-crystal",
      displayName: "Kaleido · Crystal",
      renderer: "kaleido-crystal",
      family: "Kaleido Loop",
      params: KALEIDO_CRYSTAL_DEFAULTS,
    });
    expect(getCatalogEntry("kaleido-loop")?.renderer).toBe("kaleido-loop");
    expect(getCatalogEntry("kaleido-loop-gold-gate")?.renderer).toBe("kaleido-loop");
    expect(builtinScenes.some((s) => s.id === "kaleido-crystal")).toBe(true);
    expect(builtinScenes.some((s) => s.id === "kaleido-loop")).toBe(true);
    expect(KALEIDO_CRYSTAL_DEFAULTS).toMatchObject({
      mirrors: 10,
      periodBeats: 8,
      rotSpeed: 0.9,
      bloom: 0.48,
      hueDrift: 8,
      pulseAmount: 0.22,
    });
  });

  it("draw path is prism wedges + sparkle — no full-frame flash", () => {
    const src = readFileSync(new URL("./kaleido-crystal.ts", import.meta.url), "utf8");
    expect(src).toMatch(/CRYSTAL DRAW PATH/);
    expect(src).toMatch(/paintKaleidoCrystal/);
    expect(src).toMatch(/ctx\.stroke\(/);
    expect(src).not.toMatch(/fillRect\(0,\s*0,\s*width,\s*height,\s*["']#fff/);
    expect(src).not.toMatch(/cameraShake|shake/);
  });

  it("A/B: music advances u; silence after decay freezes pose", () => {
    const s = createKaleidoMotionState();
    const dt = 1 / 30;
    const hash0 = kaleidoPoseHash(kaleidoPoseKey(s.u));
    for (let i = 1; i <= 240; i++) {
      stepKaleidoMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    expect(s.u).toBeGreaterThan(0.01);
    expect(kaleidoPoseHash(kaleidoPoseKey(s.u))).not.toBe(hash0);

    const s2 = createKaleidoMotionState();
    for (let i = 1; i <= 60; i++) {
      stepKaleidoMotion(s2, music(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    stepKaleidoMotion(s2, { timeMs: 61 * dt * 1000, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt, flowSpeed: 0.9, periodSec: 4 });
    for (let i = 62; i <= 62 + 180; i++) {
      stepKaleidoMotion(s2, silent(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    const frozen = s2.u;
    const h = kaleidoPoseHash(kaleidoPoseKey(s2.u));
    for (let i = 243; i <= 243 + 240; i++) {
      stepKaleidoMotion(s2, silent(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    expect(s2.gate).toBe(0);
    expect(s2.u).toBe(frozen);
    expect(kaleidoPoseHash(kaleidoPoseKey(s2.u))).toBe(h);
  });
});
