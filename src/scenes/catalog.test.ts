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
    expect(family.every((e) => e.mode === KALEIDO_LOOP_MODE)).toBe(true);
    const classic = family.filter((e) => e.id.startsWith("kaleido-loop"));
    expect(classic.every((e) => e.renderer === KALEIDO_LOOP_ID)).toBe(true);
    expect(family.map((e) => e.displayName)).toEqual([
      "Kaleido Loop",
      "Gold Gate",
      "Pink Core",
      "Cyan Pulse",
      "Kaleido · Crystal",
      "Kaleido · Petal",
      "Kaleido · Tunnel",
    ]);
    expect(getCatalogEntry("kaleido-loop-gold-gate")?.params).toEqual(KALEIDO_LOOP_PRESETS["gold-gate"]);
    expect(getCatalogEntry("kaleido-crystal")?.renderer).toBe("kaleido-crystal");
    expect(getCatalogEntry("kaleido-petal")?.renderer).toBe("kaleido-petal");
    expect(getCatalogEntry("kaleido-tunnel")?.renderer).toBe("kaleido-tunnel");
    expect(SCENE_CATALOG.filter((e) => e.family === "LEXI")).toEqual([]);
    expect(getCatalogEntry("lexi-terrain-gold")?.family).toBe("LEXI Terrain Gold");
    expect(getCatalogEntry("lexi-terrain-gold")?.renderer).toBe("lexi-terrain-gold");
    expect(getCatalogEntry("lexi-terrain-gold")?.displayName).toBe("Terrain Gold · MotionGate");
    expect(getCatalogEntry("lexi-terrain-gold-p12")?.displayName).toBe("Terrain Gold · Pass 1+2 (clock)");
    expect(getCatalogEntry("lexi-terrain-gold-p12")?.renderer).toBe("lexi-terrain-gold-p12");
    expect(getCatalogEntry("lexi-terrain-gold-field")?.displayName).toBe("Terrain Gold · Field Draw");
    expect(getCatalogEntry("lexi-terrain-gold-field")?.renderer).toBe("lexi-terrain-gold-field");
    expect(getCatalogEntry("lexi-terrain-gold-field-plus")?.displayName).toBe("Terrain Gold · Field Draw Plus");
    expect(getCatalogEntry("lexi-terrain-gold-hero")?.displayName).toBe("Terrain Gold · Hero Look");
    expect(catalogEntriesFor("LEXI Terrain Gold").map((e) => e.id)).toEqual([
      "lexi-terrain-gold",
      "lexi-terrain-gold-field",
      "lexi-terrain-gold-field-plus",
      "lexi-terrain-gold-hero",
      "lexi-terrain-gold-p12",
    ]);
  });
});
