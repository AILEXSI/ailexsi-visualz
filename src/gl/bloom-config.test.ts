import { describe, it, expect } from "vitest";
import { BLOOM_WEIGHTS, BLOOM_WEIGHT_RAW, normalizeWeights } from "./bloom-config";

describe("bloom weights", () => {
  it("sums to 1", () => {
    const s = BLOOM_WEIGHTS.reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 10);
  });
  it("half-res is the strongest", () => {
    expect(BLOOM_WEIGHTS[0]).toBeGreaterThan(BLOOM_WEIGHTS[1]);
    expect(BLOOM_WEIGHTS[1]).toBeGreaterThan(BLOOM_WEIGHTS[2]);
    expect(BLOOM_WEIGHTS[2]).toBeGreaterThan(BLOOM_WEIGHTS[3]);
  });
  it("1/16 is a faint halo only", () => {
    expect(BLOOM_WEIGHTS[3]).toBeLessThan(0.12);
    expect(BLOOM_WEIGHTS[0]).toBeGreaterThan(0.4);
  });
  it("rejects bad raw arrays", () => {
    expect(() => normalizeWeights([-1, 0, 0, 0])).toThrow();
    expect(() => normalizeWeights([0, 0, 0, 0])).toThrow();
  });
  it("raw has four entries", () => {
    expect(BLOOM_WEIGHT_RAW).toHaveLength(4);
  });
});
