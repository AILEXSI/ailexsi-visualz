import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEXI_TERRAIN_GOLD_CRESTS,
  LEXI_TERRAIN_GOLD_DEFAULTS,
  LEXI_TERRAIN_GOLD_PASS,
  LEXI_TERRAIN_GOLD_PERIOD_SEC,
  LEXI_TERRAIN_GOLD_VOID,
  terrainCappedBloom,
  terrainHeight,
  terrainMatterPlan,
  terrainPhase,
  terrainSurfaceKey,
} from "./lexi-terrain-gold";
import { getCatalogEntry } from "./catalog";

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

  it("caps bloom and keeps audio listen minimal", () => {
    expect(terrainCappedBloom({ bloom: 0.95, bloomCap: 0.55 })).toBe(0.55);
    expect(terrainCappedBloom(LEXI_TERRAIN_GOLD_DEFAULTS)).toBeLessThanOrEqual(0.55);
    expect(terrainMatterPlan(1920, 1080).audioListen).toBeLessThanOrEqual(0.08);
    expect(terrainMatterPlan(1920, 1080).particles).toBeLessThan(24);
  });

  it("wraps: t=0 and t=T are the same u (no hue-spin / kaleido)", () => {
    const T = LEXI_TERRAIN_GOLD_PERIOD_SEC;
    expect(terrainPhase(0, T)).toBe(0);
    expect(terrainPhase(T, T)).toBe(0);
    expect(terrainPhase(T * 3, T)).toBe(0);
  });

  it("surface layout at frame 0 equals period end (loop-safe, silence-safe)", () => {
    const a = terrainSurfaceKey(0);
    const b = terrainSurfaceKey(1);
    const c = terrainSurfaceKey(terrainPhase(LEXI_TERRAIN_GOLD_PERIOD_SEC));
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(terrainHeight(0.4, 0.5, 0)).toBeCloseTo(terrainHeight(0.4, 0.5, 1), 10);
    expect(a.some((v) => v !== a[0])).toBe(true);
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
  });
});
