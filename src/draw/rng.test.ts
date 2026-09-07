import { describe, it, expect } from "vitest";
import { seedFrom, rand01 } from "./rng";

describe("deterministic rng", () => {
  it("same inputs same output", () => {
    const a = rand01(seedFrom(1234, 19770822, 7));
    const b = rand01(seedFrom(1234, 19770822, 7));
    expect(a).toBe(b);
  });
  it("different particle ids diverge", () => {
    const a = rand01(seedFrom(1234, 1, 0));
    const b = rand01(seedFrom(1234, 1, 1));
    expect(a).not.toBe(b);
  });
});
