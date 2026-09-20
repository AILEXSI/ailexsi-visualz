import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KALEIDO_PETAL_DEFAULTS,
  KALEIDO_PETAL_ID,
  createKaleidoMotionState,
  kaleidoPetalScene,
  stepKaleidoMotion,
} from "./kaleido-petal";
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

describe("Kaleido · Petal", () => {
  it("keeps its own id and does not overwrite kaleido-loop presets", () => {
    expect(KALEIDO_PETAL_ID).toBe("kaleido-petal");
    expect(kaleidoPetalScene.id).toBe("kaleido-petal");
    expect(kaleidoPetalScene.name).toBe("Kaleido · Petal");
    expect(getCatalogEntry("kaleido-petal")).toMatchObject({
      id: "kaleido-petal",
      displayName: "Kaleido · Petal",
      renderer: "kaleido-petal",
      family: "Kaleido Loop",
      params: KALEIDO_PETAL_DEFAULTS,
    });
    expect(getCatalogEntry("kaleido-loop-pink-core")?.renderer).toBe("kaleido-loop");
    expect(builtinScenes.some((s) => s.id === "kaleido-petal")).toBe(true);
    expect(KALEIDO_PETAL_DEFAULTS).toMatchObject({
      mirrors: 8,
      periodBeats: 8,
      rotSpeed: 0.55,
      bloom: 0.62,
      hueDrift: 16,
      pulseAmount: 0.38,
    });
  });

  it("draw path is soft petals — bloom capped, no full-frame flash", () => {
    const src = readFileSync(new URL("./kaleido-petal.ts", import.meta.url), "utf8");
    expect(src).toMatch(/PETAL DRAW PATH/);
    expect(src).toMatch(/quadraticCurveTo/);
    expect(src).toMatch(/kaleidoCappedBloom/);
    expect(src).not.toMatch(/cameraShake|shake/);
  });

  it("A/B: music advances u; silence after decay freezes pose", () => {
    const s = createKaleidoMotionState();
    const dt = 1 / 30;
    const hash0 = kaleidoPoseHash(kaleidoPoseKey(s.u));
    for (let i = 1; i <= 240; i++) {
      stepKaleidoMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 4 });
    }
    expect(s.u).toBeGreaterThan(0.01);
    expect(kaleidoPoseHash(kaleidoPoseKey(s.u))).not.toBe(hash0);

    const s2 = createKaleidoMotionState();
    for (let i = 1; i <= 60; i++) {
      stepKaleidoMotion(s2, music(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 4 });
    }
    stepKaleidoMotion(s2, { timeMs: 61 * dt * 1000, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt, flowSpeed: 0.55, periodSec: 4 });
    for (let i = 62; i <= 62 + 180; i++) {
      stepKaleidoMotion(s2, silent(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 4 });
    }
    const frozen = s2.u;
    const h = kaleidoPoseHash(kaleidoPoseKey(s2.u));
    for (let i = 243; i <= 243 + 240; i++) {
      stepKaleidoMotion(s2, silent(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 4 });
    }
    expect(s2.gate).toBe(0);
    expect(s2.u).toBe(frozen);
    expect(kaleidoPoseHash(kaleidoPoseKey(s2.u))).toBe(h);
  });
});
