/**
 * Adaptive Energy Core V0.1 — PCM-time perception state only.
 *
 * Consumes already-mapped wave-core band energies (magsToBands, pre-normalize).
 * Does not FFT, does not draw, does not own a render clock.
 *
 * Provenance: independently implemented envelope / flux / rolling-deviation math.
 * Conceptual inspiration only (classic A/R followers, positive spectral flux).
 * No Essentia, madmom, aubio, librosa, Butterchurn, projectM, CAVA, or copied code.
 */
import { BANDS, FFT_SIZE, HOP, SR, fftMags, magsToBands } from "./wave-core";
import type { BandStateV01, MusicPerceptionFrameV01 } from "../types/audio";

export const PERCEPTION_BUILD_ID = "adaptive-energy-v0.1";

/** Core analysis clock after resampleToCoreRate. */
export const PERCEPTION_SAMPLE_RATE = SR;
export const PERCEPTION_HOP_SAMPLES = HOP;
export const PERCEPTION_WINDOW_SAMPLES = FFT_SIZE;
export const PERCEPTION_BANDS = BANDS;
export const PERCEPTION_FMIN_HZ = 40;
export const PERCEPTION_FMAX_HZ = 5000;

export const FAST_ATTACK_SEC = 0.02;
export const FAST_RELEASE_SEC = 0.08;
export const SLOW_ATTACK_SEC = 1.5;
export const SLOW_RELEASE_SEC = 1.5;

/** Division floor for relativeEnergy. Matches wave-core silence gate order. */
export const RELATIVE_FLOOR = 1e-4;
/** Population-std floor so a flat buffer cannot explode z-scores. */
export const DEVIATION_FLOOR = 1e-4;
/** ~1.00 s of hops at 512/44100. Real rolling window, not an EMA fake-z. */
export const DEVIATION_WINDOW_HOPS = 86;
/** Minimum hops before std is treated as evidence. */
export const DEVIATION_MIN_HOPS = 8;
export const DEVIATION_CLAMP = 20;
export const RELATIVE_CLAMP = 50;

export const TREND_SHORT_HOPS = 8;
export const TREND_FLOOR = 1e-4;

export const LOCAL_PEAK_RADIUS = 3;
export const LOCAL_PEAK_FLUX_FLOOR = 1e-5;
export const LOCAL_PEAK_REL_FLOOR = 0.15;
export const LOCAL_PEAK_ABS_FLOOR = 1e-4;

/** Warm-up length in PCM seconds of accepted hops (hop advances, not wall time). */
export const WARMUP_SEC = 1.5;
export const WARMUP_HOPS = Math.ceil((WARMUP_SEC * SR) / HOP);

export const ENERGY_ABS_FLOOR = 1e-12;
export const ENERGY_ABS_CEIL = 1e12;

const ZERO_BAND: BandStateV01 = Object.freeze({
  absoluteEnergy: 0,
  fastEnvelope: 0,
  slowBaseline: 0,
  relativeEnergy: 0,
  deviation: 0,
  spectralFlux: 0,
  localPeak: 0,
  trend: 0,
  confidence: 0,
});

export interface AdaptiveEnergyCoreOptions {
  bandCount?: number;
  sampleRate?: number;
  analysisHopSamples?: number;
  analysisWindowSamples?: number;
}

export interface AdaptiveEnergyCore {
  pushHop(bands: ArrayLike<number>, pcmSampleIndex: number): MusicPerceptionFrameV01;
  lastFrame(): MusicPerceptionFrameV01 | null;
  reset(): void;
  acceptedHops(): number;
}

function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

function contain01(x: number): number {
  return clamp(x, 0, 1);
}

function arCoeff(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / Math.max(1e-4, tau));
}

function sanitizeEnergy(x: number): number {
  if (!Number.isFinite(x) || x < ENERGY_ABS_FLOOR) return 0;
  if (x > ENERGY_ABS_CEIL) return ENERGY_ABS_CEIL;
  return x;
}

function emptyBands(n: number): BandStateV01[] {
  const out: BandStateV01[] = [];
  for (let i = 0; i < n; i++) out.push(ZERO_BAND);
  return out;
}

export function invalidPerceptionFrame(
  bandCount: number,
  pcmSampleIndex = 0,
  pcmTimeSeconds = 0,
): MusicPerceptionFrameV01 {
  return {
    pcmSampleIndex: Number.isFinite(pcmSampleIndex) ? pcmSampleIndex : 0,
    pcmTimeSeconds: Number.isFinite(pcmTimeSeconds) ? pcmTimeSeconds : 0,
    warmup: true,
    broadbandEnergy: 0,
    broadbandFlux: 0,
    bands: emptyBands(bandCount),
  };
}

function inputIsValid(bands: ArrayLike<number>, bandCount: number, pcmSampleIndex: number): boolean {
  if (!Number.isFinite(pcmSampleIndex)) return false;
  if (bands.length !== bandCount) return false;
  for (let i = 0; i < bandCount; i++) {
    const v = bands[i];
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  return true;
}

class BandTracker {
  fast = 0;
  slow = 0;
  prevCanonical: number | null = null;
  readonly absHist: Float64Array;
  absCount = 0;
  absHead = 0;
  readonly fluxHist: Float64Array;
  fluxCount = 0;
  fluxHead = 0;

  constructor(devWindow: number, fluxWindow: number) {
    this.absHist = new Float64Array(devWindow);
    this.fluxHist = new Float64Array(fluxWindow);
  }

  reset(): void {
    this.fast = 0;
    this.slow = 0;
    this.prevCanonical = null;
    this.absHist.fill(0);
    this.absCount = 0;
    this.absHead = 0;
    this.fluxHist.fill(0);
    this.fluxCount = 0;
    this.fluxHead = 0;
  }

  pushAbs(v: number): void {
    this.absHist[this.absHead] = v;
    this.absHead = (this.absHead + 1) % this.absHist.length;
    if (this.absCount < this.absHist.length) this.absCount += 1;
  }

  pushFlux(v: number): void {
    this.fluxHist[this.fluxHead] = v;
    this.fluxHead = (this.fluxHead + 1) % this.fluxHist.length;
    if (this.fluxCount < this.fluxHist.length) this.fluxCount += 1;
  }

  meanStd(): { mean: number; std: number } {
    if (this.absCount === 0) return { mean: 0, std: 0 };
    let s = 0;
    for (let i = 0; i < this.absCount; i++) s += this.absHist[i]!;
    const mean = s / this.absCount;
    let v = 0;
    for (let i = 0; i < this.absCount; i++) {
      const d = this.absHist[i]! - mean;
      v += d * d;
    }
    return { mean, std: Math.sqrt(v / this.absCount) };
  }

  /** Mean of the most recent `n` absoluteEnergy samples (newest last). */
  recentMean(n: number): number {
    if (this.absCount === 0 || n <= 0) return 0;
    const take = Math.min(n, this.absCount);
    let s = 0;
    for (let i = 1; i <= take; i++) {
      const idx = (this.absHead - i + this.absHist.length) % this.absHist.length;
      s += this.absHist[idx]!;
    }
    return s / take;
  }

  olderMean(n: number): number {
    if (this.absCount < n * 2 || n <= 0) return 0;
    let s = 0;
    for (let i = n + 1; i <= n * 2; i++) {
      const idx = (this.absHead - i + this.absHist.length) % this.absHist.length;
      s += this.absHist[idx]!;
    }
    return s / n;
  }

  fluxIsLocalMax(radius: number): boolean {
    if (this.fluxCount < radius + 1) return false;
    const newestIdx = (this.fluxHead - 1 + this.fluxHist.length) % this.fluxHist.length;
    const newest = this.fluxHist[newestIdx]!;
    for (let i = 2; i <= radius + 1; i++) {
      if (i > this.fluxCount) break;
      const idx = (this.fluxHead - i + this.fluxHist.length) % this.fluxHist.length;
      if (newest < this.fluxHist[idx]!) return false;
    }
    return true;
  }
}

export function createAdaptiveEnergyCore(opts: AdaptiveEnergyCoreOptions = {}): AdaptiveEnergyCore {
  const bandCount = opts.bandCount ?? PERCEPTION_BANDS;
  const sampleRate = opts.sampleRate ?? PERCEPTION_SAMPLE_RATE;
  const hop = opts.analysisHopSamples ?? PERCEPTION_HOP_SAMPLES;
  const dt = hop / sampleRate;
  const aFast = arCoeff(dt, FAST_ATTACK_SEC);
  const rFast = arCoeff(dt, FAST_RELEASE_SEC);
  const aSlow = arCoeff(dt, SLOW_ATTACK_SEC);
  const rSlow = arCoeff(dt, SLOW_RELEASE_SEC);
  const fluxWindow = LOCAL_PEAK_RADIUS + 1;

  let trackers: BandTracker[] = [];
  let hops = 0;
  let prevBroadband: number | null = null;
  let last: MusicPerceptionFrameV01 | null = null;

  function alloc(): void {
    trackers = [];
    for (let i = 0; i < bandCount; i++) trackers.push(new BandTracker(DEVIATION_WINDOW_HOPS, fluxWindow));
  }

  function reset(): void {
    alloc();
    hops = 0;
    prevBroadband = null;
    last = null;
  }

  alloc();

  return {
    reset,
    acceptedHops: () => hops,
    lastFrame: () => last,
    pushHop(bands, pcmSampleIndex) {
      const pcmTimeSeconds = Number.isFinite(pcmSampleIndex) ? pcmSampleIndex / sampleRate : 0;
      if (!inputIsValid(bands, bandCount, pcmSampleIndex)) {
        return invalidPerceptionFrame(bandCount, pcmSampleIndex, pcmTimeSeconds);
      }

      hops += 1;
      const first = hops === 1;
      const warmup = hops < WARMUP_HOPS;
      const confidence = first ? 0 : contain01(hops / WARMUP_HOPS);

      const outBands: BandStateV01[] = [];
      let broadbandSum = 0;

      for (let b = 0; b < bandCount; b++) {
        const tr = trackers[b]!;
        const absoluteEnergy = sanitizeEnergy(bands[b] as number);
        broadbandSum += absoluteEnergy;

        if (first) {
          tr.fast = absoluteEnergy;
          tr.slow = absoluteEnergy;
        } else {
          const fCoeff = absoluteEnergy > tr.fast ? aFast : rFast;
          const sCoeff = absoluteEnergy > tr.slow ? aSlow : rSlow;
          tr.fast = tr.fast + (absoluteEnergy - tr.fast) * fCoeff;
          tr.slow = tr.slow + (absoluteEnergy - tr.slow) * sCoeff;
        }

        const fastEnvelope = sanitizeEnergy(tr.fast);
        const slowBaseline = sanitizeEnergy(tr.slow);
        const relativeEnergy = clamp(
          (fastEnvelope - slowBaseline) / Math.max(slowBaseline, RELATIVE_FLOOR),
          -RELATIVE_CLAMP,
          RELATIVE_CLAMP,
        );

        tr.pushAbs(absoluteEnergy);
        const { mean, std } = tr.meanStd();
        const deviation = tr.absCount < DEVIATION_MIN_HOPS
          ? 0
          : clamp((absoluteEnergy - mean) / Math.max(std, DEVIATION_FLOOR), -DEVIATION_CLAMP, DEVIATION_CLAMP);

        const spectralFlux = tr.prevCanonical === null
          ? 0
          : Math.max(0, fastEnvelope - tr.prevCanonical);
        tr.prevCanonical = fastEnvelope;
        tr.pushFlux(spectralFlux);

        const localPeak = (!first
          && tr.fluxIsLocalMax(LOCAL_PEAK_RADIUS)
          && spectralFlux > LOCAL_PEAK_FLUX_FLOOR
          && relativeEnergy > LOCAL_PEAK_REL_FLOOR
          && absoluteEnergy > LOCAL_PEAK_ABS_FLOOR)
          ? contain01(spectralFlux / Math.max(fastEnvelope, RELATIVE_FLOOR))
          : 0;

        const trend = tr.absCount < TREND_SHORT_HOPS * 2
          ? 0
          : clamp(
            (tr.recentMean(TREND_SHORT_HOPS) - tr.olderMean(TREND_SHORT_HOPS))
              / Math.max(Math.abs(tr.olderMean(TREND_SHORT_HOPS)), TREND_FLOOR),
            -1,
            1,
          );

        outBands.push(Object.freeze({
          absoluteEnergy,
          fastEnvelope,
          slowBaseline,
          relativeEnergy,
          deviation,
          spectralFlux,
          localPeak,
          trend,
          confidence,
        }));
      }

      const broadbandEnergy = bandCount > 0 ? broadbandSum / bandCount : 0;
      const broadbandFlux = prevBroadband === null ? 0 : Math.max(0, broadbandEnergy - prevBroadband);
      prevBroadband = broadbandEnergy;

      last = Object.freeze({
        pcmSampleIndex,
        pcmTimeSeconds,
        warmup,
        broadbandEnergy,
        broadbandFlux,
        bands: Object.freeze(outBands),
      });
      return last;
    },
  };
}

/**
 * Batch helper: PCM (already on the 44100 core clock) → raw magsToBands → core.
 * One hop per 512 samples after the first 2048-sample window. No normalize / A/R from wave-core.
 */
export function analyzePcmToPerception(pcm: Float32Array): MusicPerceptionFrameV01 | null {
  const core = createAdaptiveEnergyCore();
  return pushPcmHops(core, pcm);
}

export function pushPcmHops(
  core: AdaptiveEnergyCore,
  pcm: Float32Array,
  endSample?: number,
): MusicPerceptionFrameV01 | null {
  const end = endSample === undefined ? pcm.length : Math.max(0, Math.min(pcm.length, endSample));
  if (end < FFT_SIZE) return null;
  const maxStart = end - FFT_SIZE;
  let last: MusicPerceptionFrameV01 | null = null;
  for (let start = 0; start <= maxStart; start += HOP) {
    const raw = magsToBands(fftMags(pcm.subarray(start, start + FFT_SIZE)));
    last = core.pushHop(raw, start + FFT_SIZE);
  }
  return last;
}

export function hopsFromPcm(pcm: Float32Array): Array<{
  bands: Float32Array;
  pcmSampleIndex: number;
  pcmTimeSeconds: number;
}> {
  const hops: Array<{ bands: Float32Array; pcmSampleIndex: number; pcmTimeSeconds: number }> = [];
  if (pcm.length < FFT_SIZE) return hops;
  const maxStart = pcm.length - FFT_SIZE;
  for (let start = 0; start <= maxStart; start += HOP) {
    const pcmSampleIndex = start + FFT_SIZE;
    hops.push({
      bands: magsToBands(fftMags(pcm.subarray(start, start + FFT_SIZE))),
      pcmSampleIndex,
      pcmTimeSeconds: pcmSampleIndex / SR,
    });
  }
  return hops;
}

export function perceptionFieldsFinite(frame: MusicPerceptionFrameV01): boolean {
  if (!Number.isFinite(frame.pcmSampleIndex) || !Number.isFinite(frame.pcmTimeSeconds)) return false;
  if (!Number.isFinite(frame.broadbandEnergy) || !Number.isFinite(frame.broadbandFlux)) return false;
  if (frame.broadbandEnergy < 0 || frame.broadbandFlux < 0) return false;
  for (const b of frame.bands) {
    if (
      !Number.isFinite(b.absoluteEnergy) || !Number.isFinite(b.fastEnvelope)
      || !Number.isFinite(b.slowBaseline) || !Number.isFinite(b.relativeEnergy)
      || !Number.isFinite(b.deviation) || !Number.isFinite(b.spectralFlux)
      || !Number.isFinite(b.localPeak) || !Number.isFinite(b.trend)
      || !Number.isFinite(b.confidence)
    ) return false;
    if (b.absoluteEnergy < 0 || b.fastEnvelope < 0 || b.slowBaseline < 0) return false;
    if (b.spectralFlux < 0 || b.localPeak < 0 || b.localPeak > 1) return false;
    if (b.confidence < 0 || b.confidence > 1) return false;
    if (b.trend < -1 || b.trend > 1) return false;
    if (Math.abs(b.relativeEnergy) > RELATIVE_CLAMP) return false;
    if (Math.abs(b.deviation) > DEVIATION_CLAMP) return false;
  }
  return true;
}

export function framesBitEqual(a: MusicPerceptionFrameV01, b: MusicPerceptionFrameV01): boolean {
  if (a.pcmSampleIndex !== b.pcmSampleIndex) return false;
  if (a.pcmTimeSeconds !== b.pcmTimeSeconds) return false;
  if (a.warmup !== b.warmup) return false;
  if (a.broadbandEnergy !== b.broadbandEnergy) return false;
  if (a.broadbandFlux !== b.broadbandFlux) return false;
  if (a.bands.length !== b.bands.length) return false;
  for (let i = 0; i < a.bands.length; i++) {
    const x = a.bands[i]!;
    const y = b.bands[i]!;
    if (
      x.absoluteEnergy !== y.absoluteEnergy
      || x.fastEnvelope !== y.fastEnvelope
      || x.slowBaseline !== y.slowBaseline
      || x.relativeEnergy !== y.relativeEnergy
      || x.deviation !== y.deviation
      || x.spectralFlux !== y.spectralFlux
      || x.localPeak !== y.localPeak
      || x.trend !== y.trend
      || x.confidence !== y.confidence
    ) return false;
  }
  return true;
}

export function clonePerceptionFrame(frame: MusicPerceptionFrameV01): MusicPerceptionFrameV01 {
  return {
    pcmSampleIndex: frame.pcmSampleIndex,
    pcmTimeSeconds: frame.pcmTimeSeconds,
    warmup: frame.warmup,
    broadbandEnergy: frame.broadbandEnergy,
    broadbandFlux: frame.broadbandFlux,
    bands: frame.bands.map((b) => ({ ...b })),
  };
}

export function peakAbsoluteBand(frame: MusicPerceptionFrameV01): { band: number; energy: number } {
  let band = 0;
  let energy = -1;
  for (let i = 0; i < frame.bands.length; i++) {
    const v = frame.bands[i]!.absoluteEnergy;
    if (v > energy) {
      energy = v;
      band = i;
    }
  }
  return { band, energy: energy < 0 ? 0 : energy };
}
