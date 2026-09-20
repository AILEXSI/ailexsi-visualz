import { describe, expect, it } from "vitest";
import { silentFeatures } from "./feature-extractor";
import { BANDS, CORE_BUILD_ID, FFT_SIZE, HISTORY, SR, analyzePcmToRing, ringRow } from "./wave-core";
import { pcmKick, pcmSinus } from "./pcm-signals";
import {
  analyzePcmToTime,
  createWaveHistoryAnalyzer,
  featuresWithWaveHistory,
  hopsForPrefix,
  pcmBufferFromMono,
} from "./wave-history-analyzer";
import {
  WAVE_HISTORY_PROOF_TIMES_MS,
  createWaveHistoryMusicBuffer,
  createWaveHistoryMusicPcm,
} from "./wave-history-music-fixture";

function ringsEqual(a: ReturnType<typeof analyzePcmToRing>, b: ReturnType<typeof analyzePcmToRing>): boolean {
  if (a.count !== b.count) return false;
  for (let age = 0; age < a.rows.length; age++) {
    const ra = ringRow(a, age);
    const rb = ringRow(b, age);
    for (let i = 0; i < BANDS; i++) if (ra[i] !== rb[i]) return false;
  }
  return true;
}

function finiteSnap(snap: ReturnType<typeof analyzePcmToTime>): boolean {
  if (!Number.isFinite(snap.dominantEnergy) || !Number.isFinite(snap.dominantBand)) return false;
  for (let age = 0; age < snap.ring.rows.length; age++) {
    const row = ringRow(snap.ring, age);
    for (let i = 0; i < BANDS; i++) {
      const v = row[i]!;
      if (!Number.isFinite(v) || v < 0) return false;
    }
  }
  return true;
}

describe("wave-history analyzer (shared Preview/Export path)", () => {
  it("identical PCM → identical scene data", () => {
    const pcm = pcmBufferFromMono(pcmSinus(3.2, 220));
    const a = createWaveHistoryAnalyzer(pcm).sampleAt(3200);
    const b = createWaveHistoryAnalyzer(pcm).sampleAt(3200);
    expect(a.historyHash).toBe(b.historyHash);
    expect(a.bandsHash).toBe(b.bandsHash);
    expect(a.buildId).toBe(CORE_BUILD_ID);
    expect(ringsEqual(a.ring, analyzePcmToRing(pcmSinus(3.2, 220)))).toBe(true);
  });

  it("Preview/Export parity at three fixture times", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const points = [];
    for (const timeMs of WAVE_HISTORY_PROOF_TIMES_MS) {
      const preview = createWaveHistoryAnalyzer(pcm);
      for (let t = 0; t <= timeMs; t += 1000 / 30) preview.sampleAt(t);
      const previewSnap = preview.sampleAt(timeMs);

      const exportFromStart = createWaveHistoryAnalyzer(pcm);
      for (let t = 0; t <= timeMs; t += 1000 / 30) exportFromStart.sampleAt(t);
      const exportSnap = exportFromStart.sampleAt(timeMs);

      const exportSeekStart = createWaveHistoryAnalyzer(pcm).sampleAt(timeMs);
      const reference = analyzePcmToTime(pcm, timeMs);

      expect(previewSnap.historyHash).toBe(exportSnap.historyHash);
      expect(previewSnap.bandsHash).toBe(exportSnap.bandsHash);
      expect(previewSnap.historyHash).toBe(exportSeekStart.historyHash);
      expect(previewSnap.historyHash).toBe(reference.historyHash);
      expect(previewSnap.dominantBand).toBe(reference.dominantBand);
      expect(previewSnap.windowStart).toBe(reference.windowStart);
      expect(previewSnap.windowEnd).toBe(reference.windowEnd);
      expect(previewSnap.windowEnd - previewSnap.windowStart).toBe(previewSnap.hopCount > 0 ? FFT_SIZE : 0);

      points.push({
        timeMs,
        pcmWindow: [previewSnap.windowStart, previewSnap.windowEnd],
        sampleRange: [0, previewSnap.coreSampleEnd],
        dominantBand: previewSnap.dominantBand,
        dominantEnergy: previewSnap.dominantEnergy,
        bandsHash: previewSnap.bandsHash,
        historyHash: previewSnap.historyHash,
        hopCount: previewSnap.hopCount,
        buildId: previewSnap.buildId,
      });
    }
    expect(points).toHaveLength(3);
    expect(new Set(points.map((p) => p.historyHash)).size).toBe(3);
  });

  it("pause freezes; resume continues from the same musical state", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const live = createWaveHistoryAnalyzer(pcm);
    live.sampleAt(2500);
    const paused = live.lastSnapshot();
    expect(paused).toBeTruthy();
    const still = live.sampleAt(2500);
    expect(still.historyHash).toBe(paused!.historyHash);
    expect(still.bandsHash).toBe(paused!.bandsHash);
    const resumed = live.sampleAt(4100);
    const fresh = createWaveHistoryAnalyzer(pcm).sampleAt(4100);
    expect(resumed.historyHash).toBe(fresh.historyHash);
    expect(resumed.historyHash).not.toBe(paused!.historyHash);
  });

  it("deterministic seek rebuilds history before T (same as play to T)", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const played = createWaveHistoryAnalyzer(pcm);
    for (let t = 0; t <= 7800; t += 20) played.sampleAt(t);
    const at7800 = played.sampleAt(7800);

    played.sampleAt(2500);
    const seekBack = played.sampleAt(2500);
    expect(seekBack.historyHash).toBe(analyzePcmToTime(pcm, 2500).historyHash);

    const seekForward = played.sampleAt(7800);
    expect(seekForward.historyHash).toBe(at7800.historyHash);
    expect(seekForward.hopCount).toBe(at7800.hopCount);
    expect(seekBack.hopCount).toBeLessThan(at7800.hopCount);
  });

  it("loop boundary rebuilds from the new PCM time", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const a = createWaveHistoryAnalyzer(pcm);
    a.sampleAt(9200);
    const afterLoop = a.sampleAt(100);
    expect(afterLoop.historyHash).toBe(analyzePcmToTime(pcm, 100).historyHash);
    expect(afterLoop.hopCount).toBe(hopsForPrefix(Math.floor(0.1 * SR), a.corePcm().length));
  });

  it("silence stays zero and finite", () => {
    const pcm = pcmBufferFromMono(new Float32Array(SR * 2));
    const snap = createWaveHistoryAnalyzer(pcm).sampleAt(2000);
    expect(snap.newestBands.every((v) => v === 0)).toBe(true);
    expect(snap.dominantEnergy).toBe(0);
    expect(finiteSnap(snap)).toBe(true);
  });

  it("extremes stay finite with no NaN/Infinity and no RNG", () => {
    const huge = pcmSinus(2, 110);
    for (let i = 0; i < huge.length; i++) huge[i] = (huge[i] ?? 0) * 1e6;
    const snap = createWaveHistoryAnalyzer(pcmBufferFromMono(huge)).sampleAt(2000);
    expect(finiteSnap(snap)).toBe(true);
    expect(snap.newestBands.every((v) => v >= 0 && v <= 1)).toBe(true);
    const kick = createWaveHistoryAnalyzer(pcmBufferFromMono(pcmKick(3.2))).sampleAt(3200);
    expect(finiteSnap(kick)).toBe(true);
  });

  it("project start is an empty ring until the first complete FFT window", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const start = createWaveHistoryAnalyzer(pcm).sampleAt(0);
    expect(start.hopCount).toBe(0);
    expect(start.coreSampleEnd).toBe(0);
    expect(start.ring.count).toBe(0);
    const almost = createWaveHistoryAnalyzer(pcm).sampleAt((FFT_SIZE / SR) * 1000 - 1);
    expect(almost.hopCount).toBe(0);
    const first = createWaveHistoryAnalyzer(pcm).sampleAt((FFT_SIZE / SR) * 1000);
    expect(first.hopCount).toBe(1);
  });

  it("featuresWithWaveHistory is the only attach used by Preview/Export", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const analyzer = createWaveHistoryAnalyzer(pcm);
    const raw = silentFeatures(2500);
    const feat = featuresWithWaveHistory(raw, analyzer, 2500);
    expect(feat.waveHistory?.historyHash).toBe(analyzePcmToTime(pcm, 2500).historyHash);
    expect(feat.spectrum.length).toBe(raw.spectrum.length);
    expect(featuresWithWaveHistory(raw, null, 2500).waveHistory).toBeUndefined();
  });

  it("music fixture contains quiet / bass / kick / highs / build / dense / silence", () => {
    const pcm = createWaveHistoryMusicPcm();
    const rms = (t0: number, t1: number) => {
      const a = Math.floor(t0 * SR);
      const b = Math.floor(t1 * SR);
      let s = 0;
      for (let i = a; i < b; i++) s += (pcm[i] ?? 0) ** 2;
      return Math.sqrt(s / Math.max(1, b - a));
    };
    expect(rms(0, 0.8)).toBeLessThan(1e-6);
    expect(rms(1.1, 2.0)).toBeGreaterThan(0.02);
    expect(rms(1.1, 2.0)).toBeLessThan(rms(2.4, 3.6));
    expect(rms(4.05, 4.2)).toBeGreaterThan(rms(3.7, 3.9));
    expect(rms(5.3, 5.4)).toBeGreaterThan(rms(5.42, 5.5));
    expect(rms(7.6, 7.9)).toBeGreaterThan(rms(6.5, 6.7));
    expect(rms(8.2, 8.8)).toBeGreaterThan(0.2);
    expect(rms(9.4, 9.9)).toBeLessThan(1e-6);
  });
});
