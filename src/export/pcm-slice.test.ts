import { describe, expect, it } from "vitest";
import { pcmToSowt, slicePcmWindow, slicedPcmIsAudible } from "./pcm-slice";

function tone(sr = 48000, seconds = 1, freq = 440) {
  const length = sr * seconds;
  const ch = new Float32Array(length);
  for (let i = 0; i < length; i++) ch[i] = Math.sin((2 * Math.PI * freq * i) / sr);
  return {
    sampleRate: sr,
    length,
    numberOfChannels: 1,
    getChannelData: () => ch,
  };
}

describe("A1 PCM slice for mux", () => {
  it("Loop window starts at featureTimeAt(IN) so picture and sound share range start", () => {
    const pcm = tone(48_000, 4);
    const sliced = slicePcmWindow(pcm, 1_000, 2_000, (t) => t);
    expect(sliced.length).toBe(96_000);
    expect(sliced.sampleRate).toBe(48_000);
    expect(slicedPcmIsAudible(sliced)).toBe(true);
    const first = sliced.getChannelData(0)[0] ?? 0;
    const atIn = pcm.getChannelData(0)[48_000] ?? 0;
    expect(first).toBeCloseTo(atIn, 5);
  });

  it("full window keeps the A1 length", () => {
    const pcm = tone(44_100, 2);
    const sliced = slicePcmWindow(pcm, 0, 2_000);
    expect(sliced.length).toBe(88_200);
    const sowt = pcmToSowt(sliced);
    expect(sowt.frames).toBe(88_200);
    expect(sowt.data.byteLength).toBe(88_200 * 2);
  });
});
