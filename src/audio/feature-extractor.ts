/**
 * Web Audio feature extractor — song-locked.
 * Onset via spectral flux. Bands via log-ish splits.
 */

import type { AudioFeatures, AudioAnalyserConfig } from "../types";

export interface FeatureExtractor {
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
  analyser.smoothingTimeConstant = config.smoothingTimeConstant ?? 0.55;
  if (config.minDecibels != null) analyser.minDecibels = config.minDecibels;
  if (config.maxDecibels != null) analyser.maxDecibels = config.maxDecibels;

  sourceNode.connect(analyser);

  const freqBinCount = analyser.frequencyBinCount;
  const freqData = new Uint8Array(freqBinCount);
  const timeData = new Uint8Array(analyser.fftSize);
  const spectrum = new Float32Array(freqBinCount);
  const prevSpectrum = new Float32Array(freqBinCount);

  let beatPulse = 0;
  let lastOnsetTime = 0;
  let fluxEma = 0;

  return {
    sample(timeMs = performance.now()) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.min(1, Math.sqrt(sumSq / timeData.length) * 2.2);

      for (let i = 0; i < freqBinCount; i++) {
        spectrum[i] = freqData[i] / 255;
      }

      let flux = 0;
      for (let i = 0; i < freqBinCount; i++) {
        const d = spectrum[i] - prevSpectrum[i];
        if (d > 0) flux += d;
        prevSpectrum[i] = spectrum[i];
      }
      flux /= freqBinCount;
      fluxEma = fluxEma * 0.88 + flux * 0.12;

      const avg = (start: number, end: number) => {
        let s = 0;
        const n = Math.max(1, end - start);
        for (let i = start; i < end; i++) s += spectrum[i];
        return s / n;
      };
      const bass = avg(0, Math.max(2, Math.floor(freqBinCount * 0.06)));
      const mid = avg(
        Math.floor(freqBinCount * 0.06),
        Math.floor(freqBinCount * 0.28)
      );
      const treble = avg(Math.floor(freqBinCount * 0.28), freqBinCount);

      const silent = rms < 0.02 && bass < 0.03;
      const onset =
        !silent &&
        flux > fluxEma * 1.8 + 0.018 &&
        timeMs - lastOnsetTime > 110;

      if (onset) {
        lastOnsetTime = timeMs;
        beatPulse = 1;
      } else {
        const decay = silent ? 0.18 : 0.06 + (1 - rms) * 0.05;
        beatPulse = Math.max(0, beatPulse - decay);
      }

      return {
        timeMs,
        rms: silent ? 0 : rms,
        bass: silent ? 0 : bass,
        mid: silent ? 0 : mid,
        treble: silent ? 0 : treble,
        spectrum: spectrum.slice(),
        onset,
        beatPulse: silent ? 0 : beatPulse,
        tempoBpm: null,
      };
    },

    disconnect() {
      try {
        sourceNode.disconnect(analyser);
      } catch {
        /* already disconnected */
      }
    },
  };
}
