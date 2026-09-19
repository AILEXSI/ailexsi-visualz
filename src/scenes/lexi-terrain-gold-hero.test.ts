import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEXI_TERRAIN_GOLD_HERO_DEFAULTS,
  LEXI_TERRAIN_GOLD_HERO_ID,
  LEXI_TERRAIN_GOLD_HERO_KICK_TAU,
  createTerrainMotionState,
  fieldLowMid,
  heroSampleBrightness,
  lexiTerrainGoldHeroScene,
  stepFieldMotion,
  terrainHeight,
  terrainSurfaceHash,
  terrainSurfaceKey,
} from "./lexi-terrain-gold-hero";
import { terrainHeight as motionGateHeight } from "./lexi-terrain-gold";
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

describe("LEXI Terrain Gold · Hero Look catalog", () => {
  it("keeps its own id and does not overwrite retained stages", () => {
    expect(LEXI_TERRAIN_GOLD_HERO_ID).toBe("lexi-terrain-gold-hero");
    expect(lexiTerrainGoldHeroScene.id).toBe("lexi-terrain-gold-hero");
    expect(lexiTerrainGoldHeroScene.name).toBe("Terrain Gold · Hero Look");
    expect(getCatalogEntry("lexi-terrain-gold-hero")).toMatchObject({
      id: "lexi-terrain-gold-hero",
      displayName: "Terrain Gold · Hero Look",
      renderer: "lexi-terrain-gold-hero",
      family: "LEXI Terrain Gold",
      params: LEXI_TERRAIN_GOLD_HERO_DEFAULTS,
    });
    expect(getCatalogEntry("lexi-terrain-gold")?.displayName).toBe("Terrain Gold · MotionGate");
    expect(getCatalogEntry("lexi-terrain-gold-field")?.displayName).toBe("Terrain Gold · Field Draw");
    expect(getCatalogEntry("lexi-terrain-gold-field-plus")?.displayName).toBe("Terrain Gold · Field Draw Plus");
    expect(getCatalogEntry("lexi-terrain-gold-p12")?.displayName).toBe("Terrain Gold · Pass 1+2 (clock)");
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold-hero")).toBe(true);
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold")).toBe(true);
    expect(LEXI_TERRAIN_GOLD_HERO_KICK_TAU).toBe(0.5);
    expect(terrainHeight).toBe(motionGateHeight);
  });

  it("draw path is thick ridge ribbons + volume fog + bokeh — no dune fill", () => {
    const src = readFileSync(new URL("./lexi-terrain-gold-hero.ts", import.meta.url), "utf8");
    expect(src).toMatch(/HERO DRAW PATH/);
    expect(src).toMatch(/strokeHeroRibbons/);
    expect(src).toMatch(/paintVolumeFog/);
    expect(src).toMatch(/paintHorizonAreaLight/);
    expect(src).toMatch(/paintBokeh/);
    expect(src).toMatch(/ctx\.stroke\(/);
    expect(src).not.toMatch(/fillRibbon/);
    expect(src).not.toMatch(/Lambert|lambert/);
    expect(src).not.toMatch(/ctx\.rotate\s*\(/);
    expect(src).not.toMatch(/function terrainHeight/);
  });

  it("emission is ridge-only", () => {
    const opts = { depthAttenuation: 0.62, gate: 1 };
    let minMask = 1;
    let maxMask = 0;
    for (let i = 0; i <= 24; i++) {
      const s = heroSampleBrightness(i / 24, 0.7, 0.1, {}, opts);
      minMask = Math.min(minMask, s.ridgeMask);
      maxMask = Math.max(maxMask, s.ridgeMask);
    }
    expect(minMask).toBeLessThan(0.12);
    expect(maxMask).toBeGreaterThan(0.3);
  });
});

describe("LEXI Terrain Gold · Hero Look A/B", () => {
  it("A: audio on — u advances and surface key changes", () => {
    const s = createTerrainMotionState();
    const hash0 = terrainSurfaceHash(terrainSurfaceKey(s.u));
    const dt = 1 / 30;
    for (let i = 1; i <= 240; i++) {
      stepFieldMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.35, periodSec: 12 });
    }
    const key1 = terrainSurfaceKey(s.u, 24, 16, { bass: 0.55, kickEnv: s.kickEnv });
    expect(s.u).toBeCloseTo(0.07091347828749299, 12);
    expect(s.gate).toBeCloseTo(0.7790426150841249, 12);
    expect(fieldLowMid(music(1000))).toBeGreaterThan(0.2);
    expect(terrainSurfaceHash(key1)).toBe(-447188435);
    expect(terrainSurfaceHash(key1)).not.toBe(hash0);
  });

  it("B: features=0 after kick/sub decay — zero travel while timeMs advances", () => {
    const s = createTerrainMotionState();
    const dt = 1 / 30;
    for (let i = 1; i <= 60; i++) {
      stepFieldMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.35, periodSec: 12 });
    }
    stepFieldMotion(s, { timeMs: 61 * dt * 1000, rms: 0, bass: 0, mid: 0, kick: 1, beatPulse: 1 }, { dt });
    for (let i = 62; i <= 62 + 180; i++) {
      stepFieldMotion(s, silent(i * dt * 1000), { dt });
    }
    expect(s.kickEnv).toBe(0);
    expect(s.gate).toBe(0);
    const uFrozen = s.u;
    const hash0 = terrainSurfaceHash(terrainSurfaceKey(s.u));
    for (let i = 243; i <= 243 + 240; i++) {
      stepFieldMotion(s, silent(i * dt * 1000), { dt });
    }
    expect(s.u).toBe(uFrozen);
    expect(s.u).toBeCloseTo(0.017367940969097478, 12);
    expect(maxAbs(terrainSurfaceKey(s.u), terrainSurfaceKey(uFrozen))).toBe(0);
    expect(terrainSurfaceHash(terrainSurfaceKey(s.u))).toBe(hash0);
    expect(hash0).toBe(-1649409921);
  });
});
