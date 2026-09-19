import { describe, expect, it } from "vitest";
import {
  KALEIDO_LOOP_PRESETS,
  kaleidoLoopPhase,
  kaleidoLoopState,
  kaleidoPeriodSec,
  maxChannelDelta,
  renderKaleidoLoopPixels,
} from "./kaleido-loop";

describe("kaleido-loop seamless", () => {
  it("fract phase wraps: t=0 and t=T are the same u", () => {
    const T = kaleidoPeriodSec(8);
    expect(kaleidoLoopPhase(0, T)).toBe(0);
    expect(kaleidoLoopPhase(T, T)).toBe(0);
    expect(kaleidoLoopPhase(T * 4, T)).toBe(0);
  });

  it("rotation / zoom / hue close over the period", () => {
    const p = KALEIDO_LOOP_PRESETS["gold-gate"];
    const T = kaleidoPeriodSec(p.periodBeats);
    const a = kaleidoLoopState(0, p);
    const b = kaleidoLoopState(T, p);
    expect(a.rot).toBeCloseTo(b.rot, 10);
    expect(a.zoom).toBeCloseTo(b.zoom, 10);
    expect(a.hue).toBeCloseTo(b.hue, 10);
    expect(a.mirrors).toBe(b.mirrors);
  });

  it("8 bars at 120 BPM (4 periods of 8 beats): frame 0 ≈ last frame after bloom (≤1 LSB)", () => {
    const p = KALEIDO_LOOP_PRESETS["gold-gate"];
    const T8bars = (8 * 4 * 60) / 120;
    const w = 48;
    const h = 27;
    const first = renderKaleidoLoopPixels(w, h, 0, p);
    const last = renderKaleidoLoopPixels(w, h, T8bars, p);
    expect(maxChannelDelta(first, last)).toBeLessThanOrEqual(1);
  });
});
