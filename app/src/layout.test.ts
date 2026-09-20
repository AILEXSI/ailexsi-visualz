import { describe, expect, it } from "vitest";
import { clampTimelineHeight, defaultTimelineHeight, TIMELINE_MIN_PX } from "./layout";

describe("timeline height", () => {
  it("defaults in the 220–280px band at typical window sizes", () => {
    expect(defaultTimelineHeight(720)).toBe(TIMELINE_MIN_PX);
    const at800 = defaultTimelineHeight(800);
    expect(at800).toBeGreaterThanOrEqual(220);
    expect(at800).toBeLessThanOrEqual(280);
  });

  it("gives the timeline more pixels when the window grows (not only preview letterbox)", () => {
    expect(defaultTimelineHeight(1200)).toBeGreaterThan(defaultTimelineHeight(800));
    expect(clampTimelineHeight(180)).toBe(TIMELINE_MIN_PX);
    expect(clampTimelineHeight(900)).toBe(480);
  });
});
