/** AILEXSI Visualz — Audio Feature Types */

import type { WaveRing } from "../audio/wave-core";

/** Shared Wave-History FFT snapshot. Preview and Export must produce the same one at time T. */
export interface WaveHistorySnapshot {
  buildId: string;
  timeMs: number;
  nativeSampleRate: number;
  nativeSampleEnd: number;
  coreSampleEnd: number;
  hopCount: number;
  windowStart: number;
  windowEnd: number;
  dominantBand: number;
  dominantEnergy: number;
  newestBands: Float32Array;
  bandsHash: string;
  historyHash: string;
  ring: WaveRing;
}

export interface AudioFeatures {
  timeMs: number;
  rms: number;
  bass: number;
  mid: number;
  treble: number;
  spectrum: Float32Array;
  onset: boolean;
  beatPulse: number;
  tempoBpm?: number | null;
  /** Kick envelope 0–1 (impulse, not mass) */
  kick?: number;
  snare?: number;
  hat?: number;
  vocal?: number;
  buildup?: number;
  drop?: number;
  /**
   * Shared Wave-History FFT snapshot (Preview + Export).
   * Evidence scene consumes this only — not spectrum / live AnalyserNode.
   */
  waveHistory?: WaveHistorySnapshot;
}

export interface AudioAnalyserConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}
