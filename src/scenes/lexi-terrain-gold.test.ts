import { describe, expect, it } from "vitest";
import { LEXI_TERRAIN_GOLD_PERIOD_SEC, terrainPhase } from "./lexi-terrain-gold";

describe("LEXI Terrain Gold loop phase", () => {
  it("wraps: t=0 and t=T are the same u (no hue-spin / kaleido)", () => {
    const T = LEXI_TERRAIN_GOLD_PERIOD_SEC;
    expect(terrainPhase(0, T)).toBe(0);
    expect(terrainPhase(T, T)).toBe(0);
    expect(terrainPhase(T * 3, T)).toBe(0);
  });
});
