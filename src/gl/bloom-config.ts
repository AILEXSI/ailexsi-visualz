/**
 * Perceptual bloom mip weights.
 * 1/2 = primary glow, 1/16 = large faint halo.
 * Always normalized so they sum to 1.
 */

export const BLOOM_LEVELS = 4 as const;

/** Relative energy before normalize. */
export const BLOOM_WEIGHT_RAW = [0.5, 0.28, 0.14, 0.08] as const;

export function normalizeWeights(raw: readonly number[]): number[] {
  if (raw.length !== BLOOM_LEVELS) {
    throw new Error(`bloom weights must have ${BLOOM_LEVELS} entries`);
  }
  for (const w of raw) {
    if (!Number.isFinite(w) || w < 0) throw new Error("bloom weight invalid");
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error("bloom weights sum to 0");
  return raw.map((w) => w / sum);
}

export const BLOOM_WEIGHTS = normalizeWeights(BLOOM_WEIGHT_RAW);

export function bloomThreshold(): number {
  return 0.4;
}
