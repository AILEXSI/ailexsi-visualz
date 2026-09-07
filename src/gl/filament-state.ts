/**
 * Deterministic GPU-filament parameters.
 * Same songTime + trackSeed + filamentId → same params.
 */

import { rand01, seedFrom } from "../draw/rng";

export const FILAMENT_COUNT_DEFAULT = 24;
export const TRACK_SEED_DEFAULT = 19770822;

export type FilamentParams = {
  id: number;
  phase: number;
  freq: number;
  amp: number;
  width: number;
  yOff: number;
  depth: number;
  intensity: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function filamentParams(
  id: number,
  songTimeMs: number,
  trackSeed: number,
  audio: { kick: number; bass: number; drop: number }
): FilamentParams {
  const s = seedFrom(songTimeMs, trackSeed, id);
  const kick = clamp01(audio.kick);
  const bass = clamp01(audio.bass);
  const drop = clamp01(audio.drop);
  const depth = 0.25 + rand01(s ^ 0x51) * 0.75;
  return {
    id,
    phase: rand01(s) * Math.PI * 2,
    freq: 1.6 + rand01(s ^ 3) * 2.4,
    amp: (0.045 + bass * 0.16 + kick * 0.05 + drop * 0.07) * (0.55 + depth),
    width: 0.004 + (1 - depth) * 0.01 + kick * 0.003,
    yOff: (id / Math.max(1, FILAMENT_COUNT_DEFAULT - 1) - 0.5) * 0.42,
    depth,
    intensity: 0.35 + depth * 0.45 + kick * 0.2,
  };
}

export function filamentParamsBatch(
  count: number,
  songTimeMs: number,
  trackSeed: number,
  audio: { kick: number; bass: number; drop: number }
): FilamentParams[] {
  const n = Math.max(1, Math.min(64, count | 0));
  const out: FilamentParams[] = [];
  for (let i = 0; i < n; i++) out.push(filamentParams(i, songTimeMs, trackSeed, audio));
  return out;
}
