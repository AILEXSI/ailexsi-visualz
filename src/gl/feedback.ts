/**
 * Musical, bounded feedback persistence.
 * Kick/drop raise memory briefly. Silence drains. Never unbounded.
 */

export const FEEDBACK_MIN = 0;
export const FEEDBACK_MAX = 0.52;
export const FEEDBACK_BASE = 0.16;

export interface FeedbackState {
  persist: number;
}

export function createFeedbackState(): FeedbackState {
  return { persist: 0 };
}

export function stepFeedback(
  state: FeedbackState,
  opts: {
    kick: number;
    drop: number;
    energy: number;
    dt: number;
  }
): number {
  const kick = clamp01(opts.kick);
  const drop = clamp01(opts.drop);
  const energy = clamp01(opts.energy);
  const dt = Math.max(0, Math.min(0.05, opts.dt));

  const silent = energy < 0.03;
  const decayPerSec = silent ? 4.2 : 1.35;
  state.persist = Math.max(0, state.persist - decayPerSec * dt);

  if (kick > 0.55) state.persist += kick * 0.22;
  if (drop > 0.35) state.persist += drop * 0.32;

  state.persist = Math.min(0.7, state.persist);

  const amount = FEEDBACK_BASE * (0.35 + energy * 0.65) + state.persist;
  return clamp(amount, FEEDBACK_MIN, FEEDBACK_MAX);
}

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return clamp(n, 0, 1);
}
