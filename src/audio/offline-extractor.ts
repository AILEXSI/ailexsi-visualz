/**
 * Offline PCM analyser — same band splits as the live AnalyserNode extractor
 * so preview seek and vis-only export share one musical clock.
 */

import type { AudioFeatures } from "../types";
import { silentFeatures } from "./feature-extractor";

export type PcmBuffer = Pick<
  AudioBuffer,
  "sampleRate" | "length" | "numberOfChannels" | "getChannelData"
>;

export interface OfflineFeatureExtractor {
  sample(timeMs: number): AudioFeatures;
}

const FFT_SIZE = 2048;

function avg(spectrum: Float32Array, a: number, b: number): number {
  let s = 0;
  const end = Math.min(spectrum.length, b);
  const start = Math.max(0, a);
  for (let i = start; i < end; i++) s += spectrum[i] ?? 0;
  return s / Math.max(1, end - start);
}

/** In-place radix-2 FFT. `re`/`im` length must be a power of two. */
export function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = re[j]!;
      const ti = im[j]!;
      re[j] = re[i]!;
      im[j] = im[i]!;
      re[i] = tr;
      im[i] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wrStep = Math.cos(theta);
    const wiStep = Math.sin(theta);
    for (let i = 0; i < n; i += size) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < half; k++) {
        const even = i + k;
        const odd = even + half;
        const or = re[odd]!;
        const oi = im[odd]!;
        const tr = wr * or - wi * oi;
        const ti = wr * oi + wi * or;
        re[odd] = re[even]! - tr;
        im[odd] = im[even]! - ti;
        re[even] += tr;
        im[even] += ti;
        const nwr = wr * wrStep - wi * wiStep;
        wi = wr * wiStep + wi * wrStep;
        wr = nwr;
      }
    }
  }
}

export function waveformPeaks(channel: Float32Array, buckets: number): number[] {
  const n = Math.max(1, buckets | 0);
  const peaks = new Array<number>(n).fill(0);
  if (!channel.length) return peaks;
  const step = channel.length / n;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * step);
    const b = Math.min(channel.length, Math.floor((i + 1) * step));
    for (let j = a; j < b; j++) m = Math.max(m, Math.abs(channel[j] ?? 0));
    peaks[i] = m;
  }
  return peaks;
}

function mixMono(buffer: PcmBuffer, start: number, count: number, dest: Float32Array): void {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  dest.fill(0);
  for (let i = 0; i < count; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= buffer.length) continue;
    const l = ch0[idx] ?? 0;
    const r = ch1 ? (ch1[idx] ?? 0) : l;
    dest[i] = (l + r) * 0.5;
  }
}

export function createOfflineFeatureExtractor(buffer: PcmBuffer): OfflineFeatureExtractor {
  const window = new Float32Array(FFT_SIZE);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const spectrum = new Float32Array(FFT_SIZE / 2);
  const prev = new Float32Array(FFT_SIZE / 2);
  let kick = 0;
  let snare = 0;
  let hat = 0;
  let vocal = 0;
  let rise = 0;
  let prevE = 0;
  let lastKick = -1e9;
  let lastTime = Number.NEGATIVE_INFINITY;

  return {
    sample(timeMs: number) {
      if (!Number.isFinite(timeMs) || buffer.length === 0) return silentFeatures(0);
      if (timeMs + 1 < lastTime) {
        prev.fill(0);
        kick = 0;
        snare = 0;
        hat = 0;
        vocal = 0;
        rise = 0;
        prevE = 0;
        lastKick = -1e9;
      }
      lastTime = timeMs;
      const center = Math.floor((timeMs / 1000) * buffer.sampleRate);
      const start = center - FFT_SIZE / 2;
      mixMono(buffer, start, FFT_SIZE, window);

      let ss = 0;
      for (let i = 0; i < FFT_SIZE; i++) {
        const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
        const v = window[i]! * hann;
        ss += window[i]! * window[i]!;
        re[i] = v;
        im[i] = 0;
      }
      const rms = Math.min(1, Math.sqrt(ss / FFT_SIZE) * 2.2);
      fftRadix2(re, im);
      const n = spectrum.length;
      for (let i = 0; i < n; i++) {
        const mag = Math.hypot(re[i]!, im[i]!) / (FFT_SIZE * 0.25);
        spectrum[i] = Math.min(1, mag);
      }

      let fluxB = 0;
      let fluxM = 0;
      let fluxH = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.max(0, spectrum[i]! - prev[i]!);
        if (i < n * 0.06) fluxB += d;
        else if (i < n * 0.28) fluxM += d;
        else fluxH += d;
        prev[i] = spectrum[i]!;
      }
      const bass = avg(spectrum, 0, Math.floor(n * 0.06));
      const mid = avg(spectrum, Math.floor(n * 0.06), Math.floor(n * 0.28));
      const treble = avg(spectrum, Math.floor(n * 0.28), n);
      const silent = rms < 0.02 && bass < 0.03;
      const kickHit = !silent && fluxB > 0.35 && bass > 0.16 && timeMs - lastKick > 100;
      const snareHit = !silent && fluxM > 0.4 && mid > 0.14 && bass < 0.55;
      const hatHit = !silent && (fluxH > 0.25 || treble > 0.22);
      if (kickHit) {
        lastKick = timeMs;
        kick = 1;
      } else {
        kick = Math.max(0, kick - 0.08);
      }
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
  };
}
