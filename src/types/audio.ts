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
  /**
   * Adaptive Energy Core V0.1 snapshot (Preview + Export).
   * Read-only perception evidence. Not a scene input requirement.
   */
  musicPerception?: MusicPerceptionFrameV01;
}

/** Per-band Adaptive Energy Core V0.1 state. See docs/ADAPTIVE-ENERGY-CORE.md. */
export interface BandStateV01 {
  /** Raw mean FFT-bin magnitude in this band (pre-normalize). Linear, >= 0. */
  absoluteEnergy: number;
  /** Fast asymmetric envelope of absoluteEnergy. Same units. */
  fastEnvelope: number;
  /** Slow envelope of absoluteEnergy (local typical). Same units. */
  slowBaseline: number;
  /** (fastEnvelope - slowBaseline) / max(slowBaseline, floor). Dimensionless. */
  relativeEnergy: number;
  /** Rolling z-score of absoluteEnergy with variance floor. Dimensionless. */
  deviation: number;
  /** max(0, canonical_t - canonical_{t-1}). canonical = fastEnvelope. */
  spectralFlux: number;
  /** Causal local-transient score in [0, 1]. Not a beat. */
  localPeak: number;
  /** Short-term rising (+) / falling (−) / stable (~0) in [-1, 1]. */
  trend: number;
  /** History validity / maturity in [0, 1]. Not aesthetics. */
  confidence: number;
}

/** One Adaptive Energy hop. Clock is PCM samples, never render frames. */
export interface MusicPerceptionFrameV01 {
  /** Exclusive end sample of this hop's FFT window on the core clock. */
  pcmSampleIndex: number;
  /** pcmSampleIndex / sampleRate (core clock, 44100 after resample). */
  pcmTimeSeconds: number;
  /** True until WARMUP_HOPS accepted hops. */
  warmup: boolean;
  /** Mean of band absoluteEnergy. */
  broadbandEnergy: number;
  /** max(0, broadbandEnergy_t - broadbandEnergy_{t-1}). */
  broadbandFlux: number;
  bands: readonly BandStateV01[];
}

export interface AudioAnalyserConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}
