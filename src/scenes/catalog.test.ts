import { describe, expect, it } from "vitest";
import {
  KALEIDO_LOOP_FAMILY,
  KALEIDO_LOOP_ID,
  KALEIDO_LOOP_MODE,
  KALEIDO_LOOP_PRESETS,
} from "./kaleido-loop";
import { SCENE_CATALOG, VIS_FAMILIES, catalogEntriesFor, getCatalogEntry } from "./catalog";

describe("VIS style registry", () => {
  it("lists Studio families plus Kaleido Loop", () => {
    expect([...VIS_FAMILIES]).toEqual([
      "LEXI",
      "LEXI Terrain Gold",
      "Classic",
      "Flow",
      "Geometry",
      "Synthwave",
      "Particle-Nebula",
      "Kaleido Loop",
    ]);
  });

  it("wires Kaleido Loop as its own family (not LEXI)", () => {
    const family = catalogEntriesFor("Kaleido Loop");
    expect(family.every((e) => e.family === KALEIDO_LOOP_FAMILY)).toBe(true);
    expect(family.every((e) => e.renderer === KALEIDO_LOOP_ID)).toBe(true);
    expect(family.every((e) => e.mode === KALEIDO_LOOP_MODE)).toBe(true);
    expect(family.map((e) => e.displayName)).toEqual([
      "Kaleido Loop",
      "Gold Gate",
      "Pink Core",
      "Cyan Pulse",
    ]);
    expect(getCatalogEntry("kaleido-loop-gold-gate")?.params).toEqual(KALEIDO_LOOP_PRESETS["gold-gate"]);
    expect(SCENE_CATALOG.filter((e) => e.family === "LEXI")).toEqual([]);
    expect(getCatalogEntry("lexi-terrain-gold")?.family).toBe("LEXI Terrain Gold");
    expect(getCatalogEntry("lexi-terrain-gold")?.renderer).toBe("lexi-terrain-gold");
  });
});
