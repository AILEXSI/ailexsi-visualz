/**
 * Shared Wave-History transport — one PCM-time analyzer for Preview and Export.
 *
 * Advances by hop index derived from audio/PCM time, never wall-clock dt.
 * Seek rebuilds from audio before T (same hops as continuous play to T).
 * Scene code must only consume the snapshot; it must not FFT.
 */
import type { AudioFeatures, WaveHistorySnapshot } from "../types/audio";
import type { PcmBuffer } from "./offline-extractor";
import {
  BANDS,
  CORE_BUILD_ID,
  FFT_SIZE,
  HOP,
  SR,
  analyzePcmToRing,
  createRing,
  fftMags,
  magsToBands,
  normalizeBands,
  pushRing,
  ringRow,
  smoothBands,
  type WaveRing,
} from "./wave-core";

export type { WaveHistorySnapshot };

export interface WaveHistoryAnalyzer {
  sampleAt(timeMs: number): WaveHistorySnapshot;
  lastSnapshot(): WaveHistorySnapshot | null;
  corePcm(): Float32Array;
  reset(): void;
}

export function hopsForPrefix(endSample: number, pcmLength: number): number {
  const end = Math.max(0, Math.min(endSample, pcmLength));
  if (end < FFT_SIZE) return 0;
  const maxStart = end - FFT_SIZE;
  return Math.floor(maxStart / HOP) + 1;
}

export function coreSampleEndForTime(timeMs: number, coreLength: number): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
  return Math.max(0, Math.min(coreLength, Math.floor((timeMs / 1000) * SR)));
}

export function mixMonoPcm(pcm: PcmBuffer): Float32Array {
  const n = pcm.length;
  const out = new Float32Array(n);
  const ch0 = pcm.getChannelData(0);
  const ch1 = pcm.numberOfChannels > 1 ? pcm.getChannelData(1) : null;
  for (let i = 0; i < n; i++) {
    const l = ch0[i] ?? 0;
    const r = ch1 ? (ch1[i] ?? 0) : l;
    out[i] = (l + r) * 0.5;
  }
  return out;
}

/** Linear resample onto the tested core clock (SR = 44100). */
export function resampleToCoreRate(mono: Float32Array, srcRate: number): Float32Array {
  if (!Number.isFinite(srcRate) || srcRate <= 0) return new Float32Array(0);
  if (srcRate === SR) return mono;
  const duration = mono.length / srcRate;
  const n = Math.max(0, Math.floor(duration * SR));
  const out = new Float32Array(n);
  if (mono.length === 0 || n === 0) return out;
  const scale = srcRate / SR;
  for (let i = 0; i < n; i++) {
    const x = i * scale;
    const i0 = Math.min(mono.length - 1, Math.floor(x));
    const i1 = Math.min(mono.length - 1, i0 + 1);
    const t = x - i0;
    out[i] = (mono[i0] ?? 0) * (1 - t) + (mono[i1] ?? 0) * t;
  }
  return out;
}

export function hashFloat32(values: ArrayLike<number>): string {
  let h = 2166136261;
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  for (let i = 0; i < values.length; i++) {
    view.setFloat32(0, values[i] ?? 0, true);
    for (let b = 0; b < 4; b++) {
      h ^= view.getUint8(b);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hashRing(ring: WaveRing): string {
  let h = 2166136261;
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  const n = ring.rows.length;
  for (let age = 0; age < n; age++) {
    const row = ringRow(ring, age);
    for (let i = 0; i < row.length; i++) {
      view.setFloat32(0, row[i] ?? 0, true);
      for (let b = 0; b < 4; b++) {
        h ^= view.getUint8(b);
        h = Math.imul(h, 16777619);
      }
    }
  }
  h ^= ring.count & 0xff;
  h = Math.imul(h, 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function peakBandOf(row: ArrayLike<number>): { band: number; energy: number } {
  let band = 0;
  let energy = -1;
  for (let i = 0; i < row.length; i++) {
    const v = row[i] ?? 0;
    if (v > energy) {
      energy = v;
      band = i;
    }
  }
  return { band, energy: energy < 0 ? 0 : energy };
}

export function snapshotFromRing(
  ring: WaveRing,
  timeMs: number,
  extras: {
    nativeSampleRate: number;
    nativeSampleEnd: number;
    coreSampleEnd: number;
    hopCount: number;
  },
): WaveHistorySnapshot {
  const newest = ring.count > 0 ? ringRow(ring, 0) : new Float32Array(BANDS);
  const peak = peakBandOf(newest);
  const lastStart = extras.hopCount > 0 ? (extras.hopCount - 1) * HOP : 0;
  return {
    buildId: CORE_BUILD_ID,
    timeMs,
    nativeSampleRate: extras.nativeSampleRate,
    nativeSampleEnd: extras.nativeSampleEnd,
    coreSampleEnd: extras.coreSampleEnd,
    hopCount: extras.hopCount,
    windowStart: extras.hopCount > 0 ? lastStart : 0,
    windowEnd: extras.hopCount > 0 ? lastStart + FFT_SIZE : 0,
    dominantBand: peak.band,
    dominantEnergy: peak.energy,
    newestBands: newest.slice(),
    bandsHash: hashFloat32(newest),
    historyHash: hashRing(ring),
    ring,
  };
}

function nativeEndForTime(timeMs: number, pcm: PcmBuffer): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
  return Math.max(0, Math.min(pcm.length, Math.floor((timeMs / 1000) * pcm.sampleRate)));
}

export function createWaveHistoryAnalyzer(pcm: PcmBuffer): WaveHistoryAnalyzer {
  const nativeMono = mixMonoPcm(pcm);
  const core = resampleToCoreRate(nativeMono, pcm.sampleRate);
  let ring = createRing();
  let smooth = new Float32Array(BANDS);
  let nextStart = 0;
  let hopCount = 0;
  let last: WaveHistorySnapshot | null = null;

  function reset(): void {
    ring = createRing();
    smooth = new Float32Array(BANDS);
    nextStart = 0;
    hopCount = 0;
    last = null;
  }

  function processUntil(endSample: number): void {
    const wanted = hopsForPrefix(endSample, core.length);
    if (wanted < hopCount) reset();
    const maxStart = Math.max(0, Math.min(endSample, core.length) - FFT_SIZE);
    const dt = HOP / SR;
    while (nextStart <= maxStart && hopCount < wanted) {
      const frame = core.subarray(nextStart, nextStart + FFT_SIZE);
      const mags = fftMags(frame);
      const raw = magsToBands(mags);
      const norm = normalizeBands(raw);
      smoothBands(smooth, norm, dt);
      pushRing(ring, smooth);
      nextStart += HOP;
      hopCount += 1;
    }
  }

  return {
    reset,
    corePcm: () => core,
    lastSnapshot: () => last,
    sampleAt(timeMs: number) {
      const coreEnd = coreSampleEndForTime(timeMs, core.length);
      processUntil(coreEnd);
      last = snapshotFromRing(ring, timeMs, {
        nativeSampleRate: pcm.sampleRate,
        nativeSampleEnd: nativeEndForTime(timeMs, pcm),
        coreSampleEnd: coreEnd,
        hopCount,
      });
      return last;
    },
  };
}

/** Reference rebuild: analyze PCM[0, T] with the tested core. */
export function analyzePcmToTime(pcm: PcmBuffer, timeMs: number): WaveHistorySnapshot {
  const core = resampleToCoreRate(mixMonoPcm(pcm), pcm.sampleRate);
  const end = coreSampleEndForTime(timeMs, core.length);
  const prefix = core.subarray(0, end);
  const ring = analyzePcmToRing(prefix);
  return snapshotFromRing(ring, timeMs, {
    nativeSampleRate: pcm.sampleRate,
    nativeSampleEnd: nativeEndForTime(timeMs, pcm),
    coreSampleEnd: end,
    hopCount: hopsForPrefix(end, core.length),
  });
}

export function featuresWithWaveHistory(
  features: AudioFeatures,
  analyzer: WaveHistoryAnalyzer | null,
  timeMs: number,
): AudioFeatures {
  if (!analyzer) return features;
  return { ...features, waveHistory: analyzer.sampleAt(timeMs) };
}

export function pcmBufferFromMono(data: Float32Array, sampleRate = SR): PcmBuffer {
  return {
    sampleRate,
    length: data.length,
    numberOfChannels: 1,
    getChannelData: () => data as Float32Array<ArrayBuffer>,
  };
}
