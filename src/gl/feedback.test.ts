import { describe, it, expect } from "vitest";
import {
  createFeedbackState,
  stepFeedback,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
} from "./feedback";

describe("feedback envelope", () => {
  it("stays within bounds under kick spam", () => {
    const s = createFeedbackState();
    let last = 0;
    for (let i = 0; i < 240; i++) {
      last = stepFeedback(s, { kick: 1, drop: 1, energy: 1, dt: 1 / 60 });
    }
    expect(last).toBeLessThanOrEqual(FEEDBACK_MAX);
    expect(last).toBeGreaterThanOrEqual(FEEDBACK_MIN);
  });

  it("drains to near-zero in silence", () => {
    const s = createFeedbackState();
    stepFeedback(s, { kick: 1, drop: 1, energy: 0.8, dt: 1 / 60 });
    let v = 0;
    for (let i = 0; i < 180; i++) {
      v = stepFeedback(s, { kick: 0, drop: 0, energy: 0, dt: 1 / 60 });
    }
    expect(v).toBeLessThan(0.08);
  });

  it("kick raises more than idle energy", () => {
    const a = createFeedbackState();
    const b = createFeedbackState();
    const idle = stepFeedback(a, { kick: 0, drop: 0, energy: 0.3, dt: 1 / 60 });
    const kicked = stepFeedback(b, { kick: 1, drop: 0, energy: 0.3, dt: 1 / 60 });
    expect(kicked).toBeGreaterThan(idle);
  });

  it("rejects NaN energy", () => {
    const s = createFeedbackState();
    const v = stepFeedback(s, { kick: Number.NaN, drop: Number.NaN, energy: Number.NaN, dt: 1 / 60 });
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(FEEDBACK_MIN);
  });
});
