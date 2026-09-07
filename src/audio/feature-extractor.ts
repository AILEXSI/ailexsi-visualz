/** Web Audio extractor — flux per band + kick/snare/hat/vocal/build/drop. */

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

  const n = analyser.frequencyBinCount;
  const freqData = new Uint8Array(n);
  const timeData = new Uint8Array(analyser.fftSize);
  const spectrum = new Float32Array(n);
  const prev = new Float32Array(n);

  let kick = 0, snare = 0, hat = 0, vocal = 0, rise = 0, prevE = 0;
  let lastKick = 0;

  const avg = (a: number, b: number) => {
    let s = 0;
    const end = Math.min(n, b);
    for (let i = a; i < end; i++) s += spectrum[i];
    return s / Math.max(1, end - a);
  };

  return {
    sample(timeMs = performance.now()) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
      let ss = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        ss += v * v;
      }
      const rms = Math.min(1, Math.sqrt(ss / timeData.length) * 2.2);
      let fluxB = 0, fluxM = 0, fluxH = 0;
      for (let i = 0; i < n; i++) {
        spectrum[i] = freqData[i] / 255;
        const d = Math.max(0, spectrum[i] - prev[i]);
        if (i < n * 0.06) fluxB += d;
        else if (i < n * 0.28) fluxM += d;
        else fluxH += d;
        prev[i] = spectrum[i];
      }
      const bass = avg(0, Math.floor(n * 0.06));
      const mid = avg(Math.floor(n * 0.06), Math.floor(n * 0.28));
      const treble = avg(Math.floor(n * 0.28), n);
      const silent = rms < 0.02 && bass < 0.03;
      const kickHit = !silent && fluxB > 0.35 && bass > 0.16 && timeMs - lastKick > 100;
      const snareHit = !silent && fluxM > 0.4 && mid > 0.14 && bass < 0.55;
      const hatHit = !silent && (fluxH > 0.25 || treble > 0.22);
      if (kickHit) { lastKick = timeMs; kick = 1; } else kick = Math.max(0, kick - 0.08);
      snare = snareHit ? 1 : Math.max(0, snare - 0.12);
      hat = Math.min(1, hat * 0.72 + (hatHit ? 0.5 : 0));
      vocal = vocal * 0.88 + mid * 0.12 * (1 - bass * 0.35);
      const energy = rms * 0.45 + bass * 0.4 + mid * 0.15;
      const de = energy - prevE;
      rise = Math.max(0, rise * 0.92 + de * 4);
      const buildup = rise > 0.12 ? Math.min(1, rise * 1.2) : 0;
      const drop = rise > 0.25 && de > 0.08 && bass > 0.28 ? 1 : 0;
      prevE = energy * 0.5 + prevE * 0.5;
      return {
        timeMs,
        rms: silent ? 0 : rms,
        bass: silent ? 0 : bass,
        mid: silent ? 0 : mid,
        treble: silent ? 0 : treble,
        spectrum: spectrum.slice(),
        onset: kickHit,
        beatPulse: silent ? 0 : kick,
        tempoBpm: null,
        kick: silent ? 0 : kick,
        snare: silent ? 0 : snare,
        hat: silent ? 0 : hat,
        vocal: silent ? 0 : Math.min(1, vocal * 1.6),
        buildup: silent ? 0 : buildup,
        drop: silent ? 0 : drop,
      };
    },
    disconnect() {
      try { sourceNode.disconnect(analyser); } catch { /* */ }
    },
  };
}
