import { describe, expect, it } from "vitest";
import { cycleProductionScreen } from "./screens";

describe("production screens", () => {
  it("cycles arrange and cutter", () => {
    expect(cycleProductionScreen("arrange", 1)).toBe("cutter");
    expect(cycleProductionScreen("cutter", 1)).toBe("arrange");
    expect(cycleProductionScreen("arrange", -1)).toBe("cutter");
  });
});
