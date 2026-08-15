/**
 * AILEXSI Visualz — Audio Feature Types
 * Version: 0.1.0-blueprint
 */

export interface AudioFeatures {
  /** Current time in ms (host timeline or audio clock) */
  timeMs: number;

  /** Overall energy 0–1 */
  rms: number;

  /** Band energies 0–1 */
  bass: number;
  mid: number;
  treble: number;

  /** Normalized frequency spectrum (0–1 per bin) */
  spectrum: Float32Array;

  /** True on the frame an onset/transient was detected */
  onset: boolean;

  /** Decaying pulse 0–1 triggered by beat/onset */
  beatPulse: number;

  /** Optional tempo from external analyser */
  tempoBpm?: number | null;
}

export interface AudioAnalyserConfig {
  fftSize?: number;          // default 2048
  smoothingTimeConstant?: number; // 0–1
  minDecibels?: number;
  maxDecibels?: number;
}
