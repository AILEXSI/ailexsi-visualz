import { describe, expect, it } from "vitest";
import {
  LEXI_TERRAIN_GOLD_P12_DEFAULTS,
  LEXI_TERRAIN_GOLD_P12_ID,
  LEXI_TERRAIN_GOLD_P12_PERIOD_SEC,
  lexiTerrainGoldP12Scene,
  terrainHeight,
  terrainPhase,
  terrainSurfaceKey,
} from "./lexi-terrain-gold-p12";
import { getCatalogEntry } from "./catalog";
import { builtinScenes } from "./index";

describe("LEXI Terrain Gold · Pass 1+2 (clock) retained stage", () => {
  it("keeps its own id and catalog label", () => {
    expect(LEXI_TERRAIN_GOLD_P12_ID).toBe("lexi-terrain-gold-p12");
    expect(lexiTerrainGoldP12Scene.id).toBe("lexi-terrain-gold-p12");
    expect(lexiTerrainGoldP12Scene.name).toBe("Terrain Gold · Pass 1+2 (clock)");
    expect(getCatalogEntry("lexi-terrain-gold-p12")).toMatchObject({
      id: "lexi-terrain-gold-p12",
      displayName: "Terrain Gold · Pass 1+2 (clock)",
      renderer: "lexi-terrain-gold-p12",
      family: "LEXI Terrain Gold",
      params: LEXI_TERRAIN_GOLD_P12_DEFAULTS,
    });
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold-p12")).toBe(true);
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold")).toBe(true);
    expect(builtinScenes.some((s) => s.id === "lexi-terrain-gold-field")).toBe(true);
  });

  it("clock-travel: u and surface key move when timeMs advances at zero audio", () => {
    const T = LEXI_TERRAIN_GOLD_P12_PERIOD_SEC;
    const u0 = terrainPhase(0, T);
    const u8 = terrainPhase(8, T);
    expect(u0).toBe(0);
    expect(u8).toBeCloseTo(8 / 12, 10);
    expect(u8).not.toBe(u0);
    const key0 = terrainSurfaceKey(u0);
    const key8 = terrainSurfaceKey(u8);
    expect(key0).not.toEqual(key8);
    expect(terrainHeight(0.4, 0.5, 0)).toBeCloseTo(terrainHeight(0.4, 0.5, 1), 10);
  });
});
