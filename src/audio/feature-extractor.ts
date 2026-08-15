/**
 * Lightweight Web Audio feature extractor for Visualz demos.
 * Host can also push features from ailexsi-analyser instead.
 */

import type { AudioFeatures, AudioAnalyserConfig } from "../types";

export interface FeatureExtractor {
  /** Call every animation frame (or from engine) */
  sample(timeMs?: number): AudioFeatures;
  disconnect(): void;
}

export function createFeatureExtractor(
  audioContext: AudioContext,
  sourceNode: AudioNode,
  config: AudioAnalyserConfig = {}
): FeatureExtractor {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = config.fftSize ?? 2048;
  analyser.smoothingTimeConstant = config.smoothingTimeConstant ?? 0.75;
  if (config.minDecibels != null) analyser.minDecibels = config.minDecibels;
  if (config.maxDecibels != null) analyser.maxDecibels = config.maxDecibels;

  sourceNode.connect(analyser);
  // Do not connect analyser to destination — host owns output routing

  const freqBinCount = analyser.frequencyBinCount;
  const freqData = new Uint8Array(freqBinCount);
  const timeData = new Uint8Array(analyser.fftSize);
  const spectrum = new Float32Array(freqBinCount);

  let prevEnergy = 0;
  let beatPulse = 0;
  let lastOnsetTime = 0;

  return {
    sample(timeMs = performance.now()) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // RMS from time domain
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.min(1, Math.sqrt(sumSq / timeData.length) * 2);

      // Spectrum normalized 0–1
      for (let i = 0; i < freqBinCount; i++) {
        spectrum[i] = freqData[i] / 255;
      }

      // Simple 3-band split (approximate)
      const third = Math.floor(freqBinCount / 6);
      const avg = (start: number, end: number) => {
        let s = 0;
        const n = Math.max(1, end - start);
        for (let i = start; i < end; i++) s += spectrum[i];
        return s / n;
      };
      const bass = avg(0, third);
      const mid = avg(third, third * 3);
      const treble = avg(third * 3, freqBinCount);

      // Onset via energy jump
      const energy = rms * 0.5 + bass * 0.5;
      const delta = energy - prevEnergy;
      prevEnergy = energy * 0.85 + prevEnergy * 0.15;
      const onset =
        delta > 0.12 && timeMs - lastOnsetTime > 120;
      if (onset) {
        lastOnsetTime = timeMs;
        beatPulse = 1;
      } else {
        beatPulse = Math.max(0, beatPulse - 0.045);
      }

      return {
        timeMs,
        rms,
        bass,
        mid,
        treble,
        spectrum: spectrum.slice(),
        onset,
        beatPulse,
        tempoBpm: null,
      };
    },

    disconnect() {
      try {
        sourceNode.disconnect(analyser);
      } catch {
        // already disconnected
      }
    },
  };
}
