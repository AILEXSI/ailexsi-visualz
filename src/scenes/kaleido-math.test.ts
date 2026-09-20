import { describe, expect, it } from "vitest";
import {
  createKaleidoMotionState,
  kaleidoBeatsToSec,
  kaleidoCappedBloom,
  kaleidoFoldAngle,
  kaleidoFract,
  kaleidoMotionEnergy,
  kaleidoPoseHash,
  kaleidoPoseKey,
  stepKaleidoMotion,
} from "./kaleido-math";

function silent(timeMs: number) {
  return { timeMs, rms: 0, bass: 0, kick: 0, beatPulse: 0 };
}

function music(timeMs: number) {
  const t = timeMs / 1000;
  const kick = t % 0.5 < 0.04 ? 1 : 0;
  return { timeMs, rms: 0.42, bass: 0.55, kick, beatPulse: kick };
}

describe("kaleido-math", () => {
  it("fract wrap and period: 8 beats @ 120 BPM is 4s", () => {
    expect(kaleidoBeatsToSec(8)).toBe(4);
    expect(kaleidoBeatsToSec(16)).toBe(8);
    expect(kaleidoFract(0)).toBe(0);
    expect(kaleidoFract(1)).toBe(0);
    expect(kaleidoPoseKey(0)).toEqual(kaleidoPoseKey(1));
    expect(kaleidoCappedBloom(0.95, 0.65)).toBe(0.65);
  });

  it("folds angles into a mirrored sector", () => {
    const a = kaleidoFoldAngle(0.1, 8);
    const b = kaleidoFoldAngle(Math.PI * 2 + 0.1, 8);
    expect(a.slice).toBeCloseTo(Math.PI / 4, 10);
    expect(a.folded).toBeCloseTo(b.folded, 10);
    expect(a.folded).toBeLessThanOrEqual(a.slice * 0.5 + 1e-9);
  });

  it("motionGate is 0 at silence and >0 with music", () => {
    expect(kaleidoMotionEnergy({ rms: 0, bass: 0, kick: 0, beatPulse: 0 }, 0)).toBe(0);
    expect(kaleidoMotionEnergy({ rms: 0.5, bass: 0.4, kick: 0.8, beatPulse: 0.8 }, 0)).toBeGreaterThan(0.4);
  });

  it("A: audio on — u advances and pose key changes", () => {
    const s = createKaleidoMotionState();
    const hash0 = kaleidoPoseHash(kaleidoPoseKey(s.u));
    const dt = 1 / 30;
    for (let i = 1; i <= 240; i++) {
      stepKaleidoMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    expect(s.u).toBeCloseTo(0.206968009050363, 12);
    expect(s.gate).toBeCloseTo(0.6820195964861432, 12);
    expect(hash0).toBe(-1814310123);
    expect(kaleidoPoseHash(kaleidoPoseKey(s.u))).toBe(-1344630402);
  });

  it("B: features=0 after kick decay — zero travel while timeMs advances", () => {
    const s = createKaleidoMotionState();
    const dt = 1 / 30;
    for (let i = 1; i <= 60; i++) {
      stepKaleidoMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    expect(s.u).toBeGreaterThan(0.01);
    stepKaleidoMotion(s, { timeMs: 61 * dt * 1000, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt, flowSpeed: 0.9, periodSec: 4 });
    for (let i = 62; i <= 62 + 180; i++) {
      stepKaleidoMotion(s, silent(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    expect(s.kickEnv).toBe(0);
    expect(s.gate).toBe(0);
    const uFrozen = s.u;
    const hash0 = kaleidoPoseHash(kaleidoPoseKey(s.u));
    for (let i = 243; i <= 243 + 240; i++) {
      stepKaleidoMotion(s, silent(i * dt * 1000), { dt, flowSpeed: 0.9, periodSec: 4 });
    }
    expect(s.u).toBe(uFrozen);
    expect(s.u).toBeCloseTo(0.33317292214597727, 12);
    expect(hash0).toBe(412139050);
    expect(kaleidoPoseHash(kaleidoPoseKey(s.u))).toBe(hash0);
  });

  it("kick does not reset u", () => {
    const s = createKaleidoMotionState(0.4);
    stepKaleidoMotion(s, { timeMs: 16, rms: 0.3, bass: 0.3, kick: 1, beatPulse: 1 }, { dt: 1 / 30 });
    expect(s.u).not.toBe(0);
    expect(s.u).toBeGreaterThan(0.3);
  });
});
