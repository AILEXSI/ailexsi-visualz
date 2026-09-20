import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ENERGY_HORIZON_Y,
  ENERGY_VOID,
  createEnergyMotionState,
  energyCappedBloom,
  energyFract,
  energyMotionEnergy,
  energyPoseHash,
  energyPoseKey,
  energyProject,
  stepEnergyMotion,
} from "./lexi-energy-math";

function silent(timeMs: number) {
  return { timeMs, rms: 0, bass: 0, kick: 0, beatPulse: 0 };
}

function music(timeMs: number) {
  const t = timeMs / 1000;
  const kick = t % 0.5 < 0.04 ? 1 : 0;
  return { timeMs, rms: 0.42, bass: 0.55, kick, beatPulse: kick };
}

describe("LEXI Energy math", () => {
  it("horizon sits in the 48–55% band and projects to X 50%", () => {
    expect(ENERGY_HORIZON_Y).toBeGreaterThanOrEqual(0.48);
    expect(ENERGY_HORIZON_Y).toBeLessThanOrEqual(0.55);
    expect(ENERGY_VOID).toBe("#000000");
    const p = energyProject(0.5, 0, 1920, 1080, ENERGY_HORIZON_Y, 1);
    expect(p.vpX).toBe(960);
    expect(p.vpY).toBeCloseTo(1080 * ENERGY_HORIZON_Y, 8);
    expect(p.x).toBeCloseTo(960, 8);
    expect(energyCappedBloom(0.95, 0.42)).toBe(0.42);
    expect(energyFract(0)).toBe(0);
    expect(energyFract(1)).toBe(0);
  });

  it("motionGate is 0 at silence and >0 with music", () => {
    expect(energyMotionEnergy({ rms: 0, bass: 0, kick: 0, beatPulse: 0 }, 0)).toBe(0);
    expect(energyMotionEnergy({ rms: 0.5, bass: 0.4, kick: 0.7, beatPulse: 0.7 }, 0)).toBeGreaterThan(0.35);
  });

  it("A: audio on — u advances and pose key changes", () => {
    const s = createEnergyMotionState();
    const hash0 = energyPoseHash(energyPoseKey(s.u));
    const dt = 1 / 30;
    for (let i = 1; i <= 240; i++) {
      stepEnergyMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 8 });
    }
    expect(s.u).toBeCloseTo(0.359927792926574, 12);
    expect(s.gate).toBeCloseTo(0.6476801008244427, 12);
    expect(hash0).toBe(537738845);
    expect(energyPoseHash(energyPoseKey(s.u))).toBe(-1263515599);
  });

  it("B: gate≈0 after decay — travel is tiny idle only while timeMs advances", () => {
    const s = createEnergyMotionState();
    const dt = 1 / 30;
    for (let i = 1; i <= 60; i++) {
      stepEnergyMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 8 });
    }
    stepEnergyMotion(s, { timeMs: 61 * dt * 1000, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt, flowSpeed: 0.55, periodSec: 8 });
    for (let i = 62; i <= 62 + 180; i++) {
      stepEnergyMotion(s, silent(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 8 });
    }
    expect(s.kickEnv).toBe(0);
    expect(s.gate).toBe(0);
    const u0 = s.u;
    const hash0 = energyPoseHash(energyPoseKey(s.u));
    for (let i = 243; i <= 243 + 240; i++) {
      stepEnergyMotion(s, silent(i * dt * 1000), { dt, flowSpeed: 0.55, periodSec: 8 });
    }
    expect(s.gate).toBe(0);
    expect(u0).toBeCloseTo(0.10990708570914226, 12);
    expect(s.u).toBeCloseTo(0.1299904190424759, 12);
    expect(Math.abs(s.u - u0)).toBeCloseTo(0.020083333333333647, 12);
    expect(hash0).toBe(-1470231012);
  });

  it("kick does not reset u", () => {
    const s = createEnergyMotionState(0.4);
    stepEnergyMotion(s, { timeMs: 16, rms: 0.3, bass: 0.3, kick: 1, beatPulse: 1 }, { dt: 1 / 30 });
    expect(s.u).not.toBe(0);
    expect(s.u).toBeGreaterThan(0.3);
  });

  it("draw path is lines + black — no dune heightfield / fill ribbon", () => {
    const draw = readFileSync(new URL("./lexi-energy-draw.ts", import.meta.url), "utf8");
    const math = readFileSync(new URL("./lexi-energy-math.ts", import.meta.url), "utf8");
    expect(draw).toMatch(/ENERGY DRAW PATH/);
    expect(draw).toMatch(/ctx\.stroke\(/);
    expect(draw).toMatch(/ENERGY_VOID/);
    expect(draw).not.toMatch(/fillRibbon/);
    expect(draw).not.toMatch(/terrainHeight/);
    expect(draw).not.toMatch(/Lambert|lambert/);
    expect(math).not.toMatch(/terrainHeight/);
    expect(draw).not.toMatch(/cameraShake|shake/);
  });
});
