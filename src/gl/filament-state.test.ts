import { describe, it, expect } from "vitest";
import { filamentParams, filamentParamsBatch } from "./filament-state";

const audio = { kick: 0.4, bass: 0.5, drop: 0 };

describe("filament state", () => {
  it("same seed + time + id is identical", () => {
    const a = filamentParams(3, 1200, 99, audio);
    const b = filamentParams(3, 1200, 99, audio);
    expect(a).toEqual(b);
  });
  it("different ids diverge", () => {
    const a = filamentParams(0, 1200, 99, audio);
    const b = filamentParams(1, 1200, 99, audio);
    expect(a.phase).not.toBe(b.phase);
  });
  it("params stay bounded", () => {
    const all = filamentParamsBatch(24, 0, 1, { kick: 2, bass: 9, drop: -4 });
    for (const f of all) {
      expect(f.amp).toBeGreaterThan(0);
      expect(f.amp).toBeLessThan(1);
      expect(f.width).toBeGreaterThan(0);
      expect(f.width).toBeLessThan(0.1);
      expect(f.intensity).toBeGreaterThan(0);
      expect(f.intensity).toBeLessThanOrEqual(1.2);
    }
  });
});
