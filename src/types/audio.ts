/** AILEXSI Visualz — Audio Feature Types */

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
}

export interface AudioAnalyserConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}
