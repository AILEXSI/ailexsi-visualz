/**
 * Adaptive Energy Core V0.1 — mandatory 12 tests + extras.
 * Tolerances are documented next to each assertion (FFT leakage, Hann, hop overlap, floors).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BANDS,
  FFT_SIZE,
  HOP,
  SR,
  bandIndexForHz,
} from "./wave-core";
import { pcmHighTransients, pcmSinus } from "./pcm-signals";
import {
  PERCEPTION_BANDS,
  PERCEPTION_FMAX_HZ,
  PERCEPTION_FMIN_HZ,
  PERCEPTION_HOP_SAMPLES,
  PERCEPTION_SAMPLE_RATE,
  PERCEPTION_WINDOW_SAMPLES,
  WARMUP_HOPS,
  WARMUP_SEC,
  analyzePcmToPerception,
  clonePerceptionFrame,
  createAdaptiveEnergyCore,
  framesBitEqual,
  hopsFromPcm,
  perceptionFieldsFinite,
  peakAbsoluteBand,
  pushPcmHops,
} from "./adaptive-energy-core";
import {
  createWaveHistoryAnalyzer,
  featuresWithWaveHistory,
  mixMonoPcm,
  pcmBufferFromMono,
  resampleToCoreRate,
} from "./wave-history-analyzer";
import { silentFeatures } from "./feature-extractor";
import type { MusicPerceptionFrameV01 } from "../types/audio";
import type { PcmBuffer } from "./offline-extractor";

const here = dirname(fileURLToPath(import.meta.url));

function sine(seconds: number, hz: number, amp: number, sr = SR): Float32Array {
  const n = Math.floor(sr * seconds);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * hz) / sr;
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(w * i);
  return out;
}

function concat(parts: Float32Array[]): Float32Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function stereoBuffer(left: Float32Array, right: Float32Array, sampleRate = SR): PcmBuffer {
  return {
    sampleRate,
    length: left.length,
    numberOfChannels: 2,
    getChannelData: (ch) => (ch === 0 ? left : right) as Float32Array<ArrayBuffer>,
  };
}

function allHops(pcm: Float32Array): MusicPerceptionFrameV01[] {
  const core = createAdaptiveEnergyCore();
  const hops = hopsFromPcm(pcm);
  return hops.map((h) => clonePerceptionFrame(core.pushHop(h.bands, h.pcmSampleIndex)));
}

function bandSum(frame: MusicPerceptionFrameV01, lo: number, hi: number, key: keyof MusicPerceptionFrameV01["bands"][number] = "absoluteEnergy"): number {
  let s = 0;
  for (let i = lo; i <= hi && i < frame.bands.length; i++) s += frame.bands[i]![key] as number;
  return s;
}

function maxField(frames: MusicPerceptionFrameV01[], band: number, key: keyof MusicPerceptionFrameV01["bands"][number]): number {
  let m = -Infinity;
  for (const f of frames) m = Math.max(m, f.bands[band]![key] as number);
  return m;
}

describe("Adaptive Energy Core V0.1 — time model + contract", () => {
  it("documents the PCM clock (not render FPS)", () => {
    expect(PERCEPTION_SAMPLE_RATE).toBe(44100);
    expect(PERCEPTION_HOP_SAMPLES).toBe(512);
    expect(PERCEPTION_WINDOW_SAMPLES).toBe(2048);
    expect(PERCEPTION_BANDS).toBe(96);
    expect(PERCEPTION_FMIN_HZ).toBe(40);
    expect(PERCEPTION_FMAX_HZ).toBe(5000);
    expect(WARMUP_SEC).toBe(1.5);
    expect(WARMUP_HOPS).toBe(Math.ceil((1.5 * 44100) / 512));
    expect(WARMUP_HOPS).toBe(130);
    const src = readFileSync(join(here, "adaptive-energy-core.ts"), "utf8");
    expect(src).not.toMatch(/performance\.now|requestAnimationFrame|Date\.now|export FPS|ui fps/i);
    expect(src).not.toMatch(/normalizeBands|smoothBands/);
    expect(src).toMatch(/magsToBands/);
  });
});

describe("1 Silence safety", () => {
  it("digital silence stays zero, finite, and does not invent peaks", () => {
    // Exact zeros → FFT bins are exact 0 (no window leakage from energy that is not there).
    const frames = allHops(new Float32Array(SR * 2));
    expect(frames.length).toBeGreaterThan(WARMUP_HOPS);
    const last = frames[frames.length - 1]!;
    expect(last.warmup).toBe(false);
    expect(last.bands[0]!.confidence).toBe(1);
    for (const f of frames) {
      expect(perceptionFieldsFinite(f)).toBe(true);
      expect(f.broadbandEnergy).toBe(0);
      expect(f.broadbandFlux).toBe(0);
      for (const b of f.bands) {
        expect(b.absoluteEnergy).toBe(0);
        expect(b.fastEnvelope).toBe(0);
        expect(b.slowBaseline).toBe(0);
        expect(b.relativeEnergy).toBe(0);
        expect(b.deviation).toBe(0);
        expect(b.spectralFlux).toBe(0);
        expect(b.localPeak).toBe(0);
        expect(b.trend).toBe(0);
      }
    }
  });
});

describe("2 Constant sine stabilization", () => {
  it("a steady tone settles: relative/flux/peak/trend stay small after warm-up", () => {
    // Hann + 75% hop overlap modulates bin magnitude by a few percent as phase slides.
    // After warm-up the slow baseline tracks that mean, so relativeEnergy and flux stay small.
    const frames = allHops(pcmSinus(3.2, 220));
    const settled = frames.slice(WARMUP_HOPS);
    expect(settled.length).toBeGreaterThan(10);
    const peak = peakAbsoluteBand(settled[0]!);
    expect(Math.abs(peak.band - bandIndexForHz(220))).toBeLessThanOrEqual(1);
    expect(peak.energy).toBeGreaterThan(0.05);

    let maxAbsRel = 0;
    let maxFlux = 0;
    let maxPeak = 0;
    let maxAbsTrend = 0;
    for (const f of settled) {
      expect(f.warmup).toBe(false);
      const b = f.bands[peak.band]!;
      maxAbsRel = Math.max(maxAbsRel, Math.abs(b.relativeEnergy));
      maxFlux = Math.max(maxFlux, b.spectralFlux);
      maxPeak = Math.max(maxPeak, b.localPeak);
      maxAbsTrend = Math.max(maxAbsTrend, Math.abs(b.trend));
      expect(perceptionFieldsFinite(f)).toBe(true);
    }
    // 0.25: generous vs Hann/hop beating (observed modulation << 10% of envelope).
    expect(maxAbsRel).toBeLessThan(0.25);
    // Flux of a constant tone is leftover hop modulation, not an onset. << absoluteEnergy.
    expect(maxFlux).toBeLessThan(peak.energy * 0.08);
    expect(maxPeak).toBe(0);
    // Trend window is 8+8 hops (~186 ms); residual slope from leakage stays well under 0.2.
    expect(maxAbsTrend).toBeLessThan(0.2);
  });
});

describe("3 Sudden amplitude increase", () => {
  it("a step-up produces flux, relative energy, and a local peak — not a beat", () => {
    const pcm = concat([sine(2.4, 220, 0.12), sine(1.0, 220, 0.75)]);
    const frames = allHops(pcm);
    const jumpT = 2.4;
    const around = frames.filter((f) => f.pcmTimeSeconds >= jumpT - 0.05 && f.pcmTimeSeconds <= jumpT + 0.12);
    expect(around.length).toBeGreaterThan(0);
    const band = peakAbsoluteBand(frames[WARMUP_HOPS]!).band;
    const maxFlux = maxField(around, band, "spectralFlux");
    const maxRel = maxField(around, band, "relativeEnergy");
    const maxPeak = maxField(around, band, "localPeak");
    const before = frames.filter((f) => f.pcmTimeSeconds < jumpT - 0.2 && f.pcmTimeSeconds > 1.6);
    const after = frames.filter((f) => f.pcmTimeSeconds > jumpT + 0.15);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    const absBefore = before[before.length - 1]!.bands[band]!.absoluteEnergy;
    const absAfter = after[0]!.bands[band]!.absoluteEnergy;
    expect(absAfter).toBeGreaterThan(absBefore * 3);
    // Window straddles the step for ~2048/44100 s, so flux is smeared over a few hops.
    expect(maxFlux).toBeGreaterThan(absBefore * 0.2);
    expect(maxRel).toBeGreaterThan(0.4);
    expect(maxPeak).toBeGreaterThan(0.05);
    expect(maxPeak).toBeLessThanOrEqual(1);
  });
});

describe("4 Release behavior", () => {
  it("a step-down drops fast envelope and relative energy without positive flux", () => {
    const pcm = concat([sine(2.4, 220, 0.7), sine(1.0, 220, 0.05)]);
    const frames = allHops(pcm);
    const dropT = 2.4;
    const band = peakAbsoluteBand(frames[WARMUP_HOPS]!).band;
    const before = frames.find((f) => f.pcmTimeSeconds >= dropT - 0.05 && f.pcmTimeSeconds < dropT)!;
    const after = frames.filter((f) => f.pcmTimeSeconds > dropT + 0.08 && f.pcmTimeSeconds < dropT + 0.35);
    expect(before).toBeTruthy();
    expect(after.length).toBeGreaterThan(3);
    const late = after[after.length - 1]!;
    expect(late.bands[band]!.fastEnvelope).toBeLessThan(before.bands[band]!.fastEnvelope);
    expect(late.bands[band]!.relativeEnergy).toBeLessThan(-0.2);
    expect(late.bands[band]!.slowBaseline).toBeGreaterThan(late.bands[band]!.fastEnvelope);
    // Positive-only flux: a release must not look like an onset.
    const maxFlux = maxField(after, band, "spectralFlux");
    expect(maxFlux).toBeLessThan(before.bands[band]!.absoluteEnergy * 0.05);
  });
});

describe("5 Render-rate independence", () => {
  it("30 / 60 / 144 FPS readers see the same hops; lastFrame does not mutate analysis", () => {
    const hops = hopsFromPcm(pcmSinus(2.5, 330));
    const refCore = createAdaptiveEnergyCore();
    const ref = hops.map((h) => clonePerceptionFrame(refCore.pushHop(h.bands, h.pcmSampleIndex)));

    for (const fps of [30, 60, 144]) {
      const core = createAdaptiveEnergyCore();
      const got: MusicPerceptionFrameV01[] = [];
      let hopI = 0;
      const duration = hops[hops.length - 1]!.pcmTimeSeconds;
      for (let frame = 0; frame / fps <= duration + 1e-9; frame++) {
        const t = frame / fps;
        while (hopI < hops.length && hops[hopI]!.pcmTimeSeconds <= t + 1e-12) {
          got.push(clonePerceptionFrame(core.pushHop(hops[hopI]!.bands, hops[hopI]!.pcmSampleIndex)));
          hopI += 1;
        }
        const a = core.lastFrame();
        const b = core.lastFrame();
        if (a && b) expect(framesBitEqual(a, b)).toBe(true);
      }
      while (hopI < hops.length) {
        got.push(clonePerceptionFrame(core.pushHop(hops[hopI]!.bands, hops[hopI]!.pcmSampleIndex)));
        hopI += 1;
      }
      expect(got.length).toBe(ref.length);
      for (let i = 0; i < ref.length; i++) {
        expect(framesBitEqual(got[i]!, ref[i]!)).toBe(true);
      }
    }
  });
});

describe("6 Relative-event comparability", () => {
  it("the same relative step at two absolute levels stays comparable", () => {
    // Both signals double. After warm-up, relativeEnergy ≈ (2L-L)/L = 1 before the slow baseline moves.
    // FFT window smears the step; compare peak relativeEnergy in a short post-step window.
    const quiet = allHops(concat([sine(2.4, 220, 0.12), sine(0.8, 220, 0.24)]));
    const loud = allHops(concat([sine(2.4, 220, 0.40), sine(0.8, 220, 0.80)]));
    const jumpT = 2.4;
    const qBand = peakAbsoluteBand(quiet[WARMUP_HOPS]!).band;
    const lBand = peakAbsoluteBand(loud[WARMUP_HOPS]!).band;
    expect(qBand).toBe(lBand);
    const win = (frames: MusicPerceptionFrameV01[]) =>
      frames.filter((f) => f.pcmTimeSeconds >= jumpT - 0.03 && f.pcmTimeSeconds <= jumpT + 0.12);
    const qRel = maxField(win(quiet), qBand, "relativeEnergy");
    const lRel = maxField(win(loud), lBand, "relativeEnergy");
    const qAbs = quiet.filter((f) => f.pcmTimeSeconds > jumpT + 0.2).at(-1)!.bands[qBand]!.absoluteEnergy;
    const lAbs = loud.filter((f) => f.pcmTimeSeconds > jumpT + 0.2).at(-1)!.bands[lBand]!.absoluteEnergy;
    expect(lAbs).toBeGreaterThan(qAbs * 2);
    expect(qRel).toBeGreaterThan(0.25);
    expect(lRel).toBeGreaterThan(0.25);
    // 0.45 relative gap: window leakage + different SNR vs RELATIVE_FLOOR, not a scale collapse.
    expect(Math.abs(qRel - lRel) / Math.max(qRel, lRel)).toBeLessThan(0.45);
  });
});

describe("7 Bass isolation", () => {
  it("a 55 Hz tone lives in low linear-Hz bands, not the high end", () => {
    const last = analyzePcmToPerception(sine(2.8, 55, 0.6))!;
    const peak = peakAbsoluteBand(last);
    expect(peak.band).toBeLessThanOrEqual(3);
    expect(Math.abs(peak.band - bandIndexForHz(55))).toBeLessThanOrEqual(1);
    const low = bandSum(last, 0, 8);
    const high = bandSum(last, 70, 95);
    // Hann sidelobes leak, but a 55 Hz tone must not light the 3.6 kHz+ region.
    expect(low).toBeGreaterThan(high * 8 + 1e-6);
    expect(high).toBeLessThan(low * 0.05 + 1e-4);
  });
});

describe("8 High-transient isolation", () => {
  it("high beeps raise high-band flux/peaks, not bass", () => {
    const frames = allHops(pcmHighTransients(3.2));
    let highFlux = 0;
    let bassFlux = 0;
    let highPeak = 0;
    let bassPeak = 0;
    for (const f of frames) {
      highFlux = Math.max(highFlux, bandSum(f, 68, 95, "spectralFlux"));
      bassFlux = Math.max(bassFlux, bandSum(f, 0, 8, "spectralFlux"));
      highPeak = Math.max(highPeak, bandSum(f, 68, 95, "localPeak"));
      bassPeak = Math.max(bassPeak, bandSum(f, 0, 8, "localPeak"));
    }
    expect(highFlux).toBeGreaterThan(bassFlux * 3 + 1e-5);
    expect(highPeak).toBeGreaterThan(0);
    expect(bassPeak).toBeLessThan(highPeak * 0.35 + 1e-6);
  });
});

describe("9 Sample-rate invariance", () => {
  it("44100 and 48000 map to the same 40–5000 Hz / 96-band model after core resample", () => {
    // wave-core hardcodes SR=44100. The analyzer resamples first, so band edges stay 40..5000 Hz.
    const hz = 880;
    const a44 = createWaveHistoryAnalyzer(pcmBufferFromMono(sine(3.0, hz, 0.5, 44100), 44100));
    const a48 = createWaveHistoryAnalyzer(pcmBufferFromMono(sine(3.0, hz, 0.5, 48000), 48000));
    a44.sampleAt(2800);
    a48.sampleAt(2800);
    const p44 = a44.lastPerception()!;
    const p48 = a48.lastPerception()!;
    expect(p44.warmup).toBe(false);
    expect(p48.warmup).toBe(false);
    const peak44 = peakAbsoluteBand(p44);
    const peak48 = peakAbsoluteBand(p48);
    expect(Math.abs(peak44.band - bandIndexForHz(hz))).toBeLessThanOrEqual(1);
    expect(Math.abs(peak48.band - peak44.band)).toBeLessThanOrEqual(1);
    let dot = 0, n44 = 0, n48 = 0;
    for (let i = 0; i < BANDS; i++) {
      const x = p44.bands[i]!.absoluteEnergy;
      const y = p48.bands[i]!.absoluteEnergy;
      dot += x * y;
      n44 += x * x;
      n48 += y * y;
    }
    const cosine = dot / Math.max(1e-12, Math.sqrt(n44) * Math.sqrt(n48));
    // Linear resample interpolates samples; cosine 0.98 leaves room for that interpolation error.
    expect(cosine).toBeGreaterThan(0.98);
    expect(Math.abs(p44.bands[peak44.band]!.relativeEnergy)).toBeLessThan(0.25);
    expect(Math.abs(p48.bands[peak48.band]!.relativeEnergy)).toBeLessThan(0.25);
  });
});

describe("10 No false first-frame event", () => {
  it("the first accepted hop has zero flux, zero localPeak, zero relativeEnergy", () => {
    const hops = hopsFromPcm(pcmSinus(1.0, 440));
    const core = createAdaptiveEnergyCore();
    const first = core.pushHop(hops[0]!.bands, hops[0]!.pcmSampleIndex);
    expect(first.warmup).toBe(true);
    expect(first.broadbandFlux).toBe(0);
    expect(first.bands[0]!.confidence).toBe(0);
    for (const b of first.bands) {
      expect(b.spectralFlux).toBe(0);
      expect(b.localPeak).toBe(0);
      expect(b.relativeEnergy).toBe(0);
      expect(b.trend).toBe(0);
      expect(b.deviation).toBe(0);
    }
    expect(first.pcmSampleIndex).toBe(FFT_SIZE);
    expect(first.pcmTimeSeconds).toBe(FFT_SIZE / SR);
  });
});

describe("11 Non-finite containment", () => {
  it("NaN / Infinity / wrong length yield a zero-safe invalid frame and do not poison state", () => {
    const core = createAdaptiveEnergyCore();
    const good = new Float32Array(BANDS);
    good[10] = 0.2;
    const ok = core.pushHop(good, FFT_SIZE);
    expect(ok.bands[10]!.absoluteEnergy).toBe(0.2);

    const nan = new Float32Array(BANDS);
    nan[3] = Number.NaN;
    const badNan = core.pushHop(nan, FFT_SIZE * 2);
    expect(perceptionFieldsFinite(badNan)).toBe(true);
    expect(badNan.warmup).toBe(true);
    expect(badNan.broadbandEnergy).toBe(0);
    expect(badNan.bands.every((b) => b.confidence === 0 && b.localPeak === 0)).toBe(true);

    const inf = new Float32Array(BANDS);
    inf[4] = Number.POSITIVE_INFINITY;
    const badInf = core.pushHop(inf, FFT_SIZE * 3);
    expect(perceptionFieldsFinite(badInf)).toBe(true);

    const short = core.pushHop(new Float32Array(8), FFT_SIZE * 4);
    expect(perceptionFieldsFinite(short)).toBe(true);
    expect(short.bands).toHaveLength(BANDS);

    const after = core.pushHop(good, FFT_SIZE + HOP);
    expect(perceptionFieldsFinite(after)).toBe(true);
    expect(after.bands[10]!.absoluteEnergy).toBe(0.2);
    expect(core.acceptedHops()).toBe(2);
  });
});

describe("12 Exact replay determinism", () => {
  it("identical PCM yields bit-identical perception frames", () => {
    const pcm = concat([sine(1.2, 110, 0.3), sine(1.2, 880, 0.45)]);
    const a = allHops(pcm);
    const b = allHops(pcm);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(framesBitEqual(a[i]!, b[i]!)).toBe(true);
    }
    const c = analyzePcmToPerception(pcm)!;
    expect(framesBitEqual(c, a[a.length - 1]!)).toBe(true);
  });
});

describe("extra: near-zero baseline", () => {
  it("tiny values do not explode ratios or invent peaks", () => {
    const core = createAdaptiveEnergyCore();
    const tiny = new Float32Array(BANDS);
    tiny[20] = 1e-8;
    for (let i = 0; i < 40; i++) {
      const f = core.pushHop(tiny, FFT_SIZE + i * HOP);
      expect(perceptionFieldsFinite(f)).toBe(true);
      expect(Math.abs(f.bands[20]!.relativeEnergy)).toBeLessThan(1);
      expect(f.bands[20]!.localPeak).toBe(0);
    }
  });
});

describe("extra: long sustained loud", () => {
  it("after warm-up a loud constant is high absolute, near-zero relative", () => {
    const last = analyzePcmToPerception(sine(3.2, 220, 0.85))!;
    expect(last.warmup).toBe(false);
    const peak = peakAbsoluteBand(last);
    expect(peak.energy).toBeGreaterThan(0.08);
    expect(Math.abs(last.bands[peak.band]!.relativeEnergy)).toBeLessThan(0.25);
    expect(last.bands[peak.band]!.localPeak).toBe(0);
    expect(last.bands[peak.band]!.confidence).toBe(1);
  });
});

describe("extra: rapid alternating", () => {
  it("0/1 hops keep producing positive flux on the rises", () => {
    const core = createAdaptiveEnergyCore();
    let riseFlux = 0;
    for (let i = 0; i < 24; i++) {
      const row = new Float32Array(BANDS);
      row[40] = i % 2 === 0 ? 0 : 0.5;
      const f = core.pushHop(row, FFT_SIZE + i * HOP);
      if (i % 2 === 1) riseFlux = Math.max(riseFlux, f.bands[40]!.spectralFlux);
    }
    expect(riseFlux).toBeGreaterThan(0.05);
  });
});

describe("extra: channel layout", () => {
  it("stereo L=R matches mono; L-only is the 0.5 mix", () => {
    const mono = sine(2.2, 220, 0.5);
    const aMono = createWaveHistoryAnalyzer(pcmBufferFromMono(mono));
    const aStereo = createWaveHistoryAnalyzer(stereoBuffer(mono, mono));
    aMono.sampleAt(2000);
    aStereo.sampleAt(2000);
    expect(framesBitEqual(aMono.lastPerception()!, aStereo.lastPerception()!)).toBe(true);

    const leftOnly = createWaveHistoryAnalyzer(stereoBuffer(mono, new Float32Array(mono.length)));
    const half = createWaveHistoryAnalyzer(pcmBufferFromMono(sine(2.2, 220, 0.25)));
    leftOnly.sampleAt(2000);
    half.sampleAt(2000);
    const pL = leftOnly.lastPerception()!;
    const pH = half.lastPerception()!;
    const bL = peakAbsoluteBand(pL);
    const bH = peakAbsoluteBand(pH);
    expect(bL.band).toBe(bH.band);
    expect(Math.abs(bL.energy - bH.energy) / Math.max(bH.energy, 1e-9)).toBeLessThan(0.08);
  });
});

describe("extra: truncated final window", () => {
  it("PCM shorter than one FFT window produces no perception hop", () => {
    expect(analyzePcmToPerception(new Float32Array(1000))).toBeNull();
    expect(hopsFromPcm(new Float32Array(FFT_SIZE - 1))).toHaveLength(0);
    const a = createWaveHistoryAnalyzer(pcmBufferFromMono(new Float32Array(1000)));
    a.sampleAt(20);
    expect(a.lastPerception()).toBeNull();
  });
});

describe("extra: reset / new-source", () => {
  it("reset drops envelope, baseline, flux, peak, trend, confidence, and warm-up", () => {
    const pcm = pcmSinus(2.8, 220);
    const core = createAdaptiveEnergyCore();
    const warmed = pushPcmHops(core, pcm)!;
    expect(warmed.warmup).toBe(false);
    expect(warmed.bands[peakAbsoluteBand(warmed).band]!.confidence).toBe(1);
    expect(core.acceptedHops()).toBeGreaterThan(WARMUP_HOPS);

    core.reset();
    expect(core.lastFrame()).toBeNull();
    expect(core.acceptedHops()).toBe(0);

    const hops = hopsFromPcm(pcm);
    const first = core.pushHop(hops[0]!.bands, hops[0]!.pcmSampleIndex);
    expect(first.warmup).toBe(true);
    expect(first.bands[0]!.confidence).toBe(0);
    expect(first.broadbandFlux).toBe(0);
    for (const b of first.bands) {
      expect(b.spectralFlux).toBe(0);
      expect(b.localPeak).toBe(0);
      expect(b.relativeEnergy).toBe(0);
      expect(b.trend).toBe(0);
    }

    const fresh = createAdaptiveEnergyCore();
    const replayA = hops.map((h) => clonePerceptionFrame(core.pushHop(h.bands, h.pcmSampleIndex)));
    // first hop already pushed; rebuild from scratch for equality
    const replayB = hops.map((h) => clonePerceptionFrame(fresh.pushHop(h.bands, h.pcmSampleIndex)));
    expect(framesBitEqual(replayB[0]!, first)).toBe(true);
    expect(replayB.length).toBe(hops.length);
  });

  it("analyzer reset on seek-back rebuilds perception from PCM[0, T]", () => {
    const pcm = pcmBufferFromMono(concat([sine(2.0, 110, 0.4), sine(2.0, 880, 0.5)]));
    const live = createWaveHistoryAnalyzer(pcm);
    live.sampleAt(3500);
    const at35 = clonePerceptionFrame(live.lastPerception()!);
    live.sampleAt(1800);
    const seek = live.lastPerception()!;
    const cold = createWaveHistoryAnalyzer(pcm);
    cold.sampleAt(1800);
    expect(framesBitEqual(seek, cold.lastPerception()!)).toBe(true);
    expect(framesBitEqual(seek, at35)).toBe(false);
  });
});

describe("extra: analyzer attach + raw-band provenance", () => {
  it("Preview/Export helper attaches the same perception at T from PCM hops only", () => {
    const pcm = pcmBufferFromMono(pcmSinus(3.0, 220));
    const preview = createWaveHistoryAnalyzer(pcm);
    for (let t = 0; t <= 2500; t += 1000 / 30) preview.sampleAt(t);
    const exportSeek = createWaveHistoryAnalyzer(pcm);
    const feat = featuresWithWaveHistory(silentFeatures(2500), exportSeek, 2500);
    expect(feat.musicPerception).toBeTruthy();
    expect(framesBitEqual(preview.lastPerception()!, feat.musicPerception!)).toBe(true);
    expect(featuresWithWaveHistory(silentFeatures(0), null, 0).musicPerception).toBeUndefined();
  });

  it("resample helper is the only SR bridge — perception does not remap Hz itself", () => {
    const native = sine(1.0, 220, 0.4, 48000);
    const core = resampleToCoreRate(mixMonoPcm(pcmBufferFromMono(native, 48000)), 48000);
    expect(core.length).toBe(Math.floor(native.length / 48000 * 44100));
    const src = readFileSync(join(here, "adaptive-energy-core.ts"), "utf8");
    expect(src).not.toMatch(/resampleToCoreRate/);
  });
});
