import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEXI_TERRAIN_GOLD_CRESTS,
  LEXI_TERRAIN_GOLD_DEFAULTS,
  LEXI_TERRAIN_GOLD_PASS,
  LEXI_TERRAIN_GOLD_PERIOD_SEC,
  LEXI_TERRAIN_GOLD_VOID,
  createTerrainMotionState,
  stepTerrainMotion,
  terrainCappedBloom,
  terrainHeight,
  terrainMatterPlan,
  terrainMoteX,
  terrainMotionEnergy,
  terrainParx,
  terrainPhase,
  terrainSurfaceHash,
  terrainSurfaceKey,
} from "./lexi-terrain-gold";
import { getCatalogEntry } from "./catalog";

function silent(timeMs: number) {
  return { timeMs, rms: 0, bass: 0, kick: 0, beatPulse: 0 };
}

function music(timeMs: number) {
  const t = timeMs / 1000;
  const kick = t % 0.5 < 0.04 ? 1 : 0;
  return { timeMs, rms: 0.42, bass: 0.55, kick, beatPulse: kick };
}

function maxAbs(a: readonly number[], b: readonly number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  return m;
}

describe("LEXI Terrain Gold Pass 1+2", () => {
  it("wires the named quality defaults", () => {
    expect(LEXI_TERRAIN_GOLD_PERIOD_SEC).toBe(12);
    expect(LEXI_TERRAIN_GOLD_PASS).toEqual({ implemented: [1, 2], deferred: [3] });
    expect(LEXI_TERRAIN_GOLD_DEFAULTS).toMatchObject({
      surfaceDensity: 1.4,
      depthAttenuation: 0.62,
      flowSpeed: 0.35,
      fogDensity: 0.78,
      fogHeight: 0.38,
      bloomCap: 0.55,
      horizonY: 0.42,
      mountainScale: 1.15,
      periodSec: 12,
    });
    expect(LEXI_TERRAIN_GOLD_VOID).toBe("#0a0602");
    expect(LEXI_TERRAIN_GOLD_CRESTS).toEqual({
      deep: "#c47a12",
      mid: "#ffd27a",
      near: "#fff4d2",
    });
    expect(getCatalogEntry("lexi-terrain-gold")?.params).toMatchObject({
      surfaceDensity: 1.4,
      fogDensity: 0.78,
      bloomCap: 0.55,
      periodSec: 12,
      horizonY: 0.42,
    });
  });

  it("caps bloom", () => {
    expect(terrainCappedBloom({ bloom: 0.95, bloomCap: 0.55 })).toBe(0.55);
    expect(terrainCappedBloom(LEXI_TERRAIN_GOLD_DEFAULTS)).toBeLessThanOrEqual(0.55);
    expect(terrainMatterPlan(1920, 1080).particles).toBeLessThan(24);
  });

  it("fract wrap: u=0 and u=1 are the same pose term", () => {
    expect(terrainPhase(0, 1)).toBe(0);
    expect(terrainPhase(1, 1)).toBe(0);
    expect(terrainHeight(0.4, 0.5, 0)).toBeCloseTo(terrainHeight(0.4, 0.5, 1), 10);
  });

  it("depth plan is a continuous surface, not line/particle soup", () => {
    const plan = terrainMatterPlan(1920, 1080, LEXI_TERRAIN_GOLD_DEFAULTS);
    expect(plan.horizonY).toBeCloseTo(0.42, 5);
    expect(plan.layers).toBe(4);
    expect(plan.slices).toBeGreaterThanOrEqual(40);
    expect(plan.cols).toBeGreaterThanOrEqual(28);
    expect(plan.particles).toBeLessThan(24);
    expect(plan.voidHex).toBe("#0a0602");
    expect(plan.bloomCap).toBe(0.55);
  });

  it("does not bring back radar / kaleido rotate / scope arms / meridians", () => {
    const src = readFileSync(new URL("./lexi-terrain-gold.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/ctx\.rotate\s*\(/);
    expect(src).not.toMatch(/mirrors|rotSpeed|hueDrift/);
    expect(src).not.toMatch(/meridian/);
    expect(src).not.toMatch(/terrainPhase\(\s*timeSec/);
  });
});

describe("LEXI Terrain Gold audio-only motion", () => {
  it("motionGate is ~0 when rms/sub/kick are 0", () => {
    expect(terrainMotionEnergy({ rms: 0, bass: 0, kick: 0, beatPulse: 0 }, 0)).toBe(0);
    expect(terrainMotionEnergy({ rms: 0.5, bass: 0.4, kick: 0.8, beatPulse: 0.8 }, 0)).toBeGreaterThan(0.4);
  });

  it("A: normal features — dune/flow follows music (surface key moves)", () => {
    const s = createTerrainMotionState();
    const key0 = terrainSurfaceKey(s.u);
    const hash0 = terrainSurfaceHash(key0);
    const dt = 1 / 30;
    for (let i = 1; i <= 240; i++) {
      stepTerrainMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.35, periodSec: 12 });
    }
    const key1 = terrainSurfaceKey(s.u, 24, 16, { bass: 0.55, kickEnv: s.kickEnv });
    const hash1 = terrainSurfaceHash(key1);
    const delta = maxAbs(key0, key1);
    expect(s.u).toBeGreaterThan(0.01);
    expect(s.gate).toBeGreaterThan(0.2);
    expect(delta).toBeGreaterThan(0.05);
    expect(hash1).not.toBe(hash0);
  });

  it("B: energy 0, timeMs advances — pose frozen after kick/sub decay", () => {
    const s = createTerrainMotionState();
    const dt = 1 / 30;
    stepTerrainMotion(s, { timeMs: 0, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt });
    for (let i = 1; i <= 90; i++) {
      stepTerrainMotion(s, silent(i * dt * 1000), { dt });
    }
    expect(s.kickEnv).toBe(0);
    expect(s.gate).toBe(0);

    const uFrozen = s.u;
    const key0 = terrainSurfaceKey(s.u);
    const hash0 = terrainSurfaceHash(key0);
    const parx0 = terrainParx(s.u);
    const mote0 = terrainMoteX(0, 12, s.u, 1280);

    for (let i = 91; i <= 91 + 240; i++) {
      stepTerrainMotion(s, silent(i * dt * 1000), { dt });
    }

    const key1 = terrainSurfaceKey(s.u);
    expect(s.u).toBe(uFrozen);
    expect(s.gate).toBe(0);
    expect(maxAbs(key0, key1)).toBe(0);
    expect(terrainSurfaceHash(key1)).toBe(hash0);
    expect(terrainParx(s.u)).toBe(parx0);
    expect(terrainMoteX(0, 12, s.u, 1280)).toBe(mote0);
  });

  it("kick does not reset u to 0", () => {
    const s = createTerrainMotionState(0.4);
    stepTerrainMotion(s, { timeMs: 16, rms: 0.3, bass: 0.3, kick: 1, beatPulse: 1 }, { dt: 1 / 30 });
    expect(s.u).not.toBe(0);
    expect(s.u).toBeGreaterThan(0.3);
  });
});
