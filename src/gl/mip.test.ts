import { describe, it, expect } from "vitest";
import { bloomMips } from "./mip";

describe("bloomMips", () => {
  it("returns four levels from 1280x720", () => {
    const m = bloomMips(1280, 720);
    expect(m).toHaveLength(4);
    expect(m[0]).toEqual({ w: 640, h: 360, scale: 2 });
    expect(m[1]).toEqual({ w: 320, h: 180, scale: 4 });
    expect(m[2]).toEqual({ w: 160, h: 90, scale: 8 });
    expect(m[3]).toEqual({ w: 80, h: 45, scale: 16 });
  });
  it("never goes below 2px", () => {
    const m = bloomMips(8, 8);
    expect(m.every((x) => x.w >= 2 && x.h >= 2)).toBe(true);
  });
});
