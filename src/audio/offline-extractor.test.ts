import { describe, expect, it } from "vitest";
import { createOfflineFeatureExtractor, waveformPeaks, fftRadix2 } from "./offline-extractor";

function sineBuffer(hz: number, seconds: number, sampleRate = 44100, amp = 0.8) {
  const length = Math.floor(sampleRate * seconds);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) data[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * amp;
  return {
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
}

describe("offline feature extractor", () => {
  it("reads energy from a loud sine and silence from zeros", () => {
    const loud = createOfflineFeatureExtractor(sineBuffer(110, 0.25));
    const quiet = createOfflineFeatureExtractor(sineBuffer(110, 0.25, 44100, 0));
    const a = loud.sample(80);
    const b = quiet.sample(80);
    expect(a.rms).toBeGreaterThan(0.15);
    expect(b.rms).toBe(0);
    expect(b.onset).toBe(false);
  });

  it("waveformPeaks reports the loud bucket", () => {
    const ch = new Float32Array(8);
    ch[6] = 0.9;
    expect(waveformPeaks(ch, 4)[3]).toBeCloseTo(0.9);
    expect(waveformPeaks(ch, 4)[0]).toBe(0);
  });

  it("fftRadix2 puts a DC impulse in bin 0", () => {
    const re = new Float32Array([1, 0, 0, 0]);
    const im = new Float32Array(4);
    fftRadix2(re, im);
    expect(re[0]).toBeCloseTo(1);
  });
});
