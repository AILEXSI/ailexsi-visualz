import { describe, expect, it } from "vitest";
import {
  EXAMPLE_FFPROBE_MUXED_STREAMS,
  NO_AUDIO_STREAM_ERROR,
  assertPrimaryExportHasAudio,
  muxAvcToMp4,
  mp4HasSoundTrack,
  pcmToWav,
  quoteFfmpegMuxCommand,
  slicePcmWindow,
  wavDurationSec,
} from "@ailexsi/visualz";
import {
  createEmptyProject,
  exportFrameCount,
  formatTimecode,
  placeAudio,
  resolveExportRange,
  setLoopRange,
  toggleLoop,
  visFileDurationSec,
} from "../model";
import { attachA1Audio } from "./vis-export";
import { formatPrimaryExportFertig } from "./export-status";

function fakeAvcC(): Uint8Array {
  return new Uint8Array([1, 0x42, 0x00, 0x1f, 0xff, 0xe1, 0x00]);
}

function fakeVis(frames: number, fps: number) {
  const samples = Array.from({ length: frames }, (_, i) => ({
    data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]),
    timestampUs: Math.round((i / fps) * 1_000_000),
    durationUs: Math.round(1_000_000 / fps),
    key: i % (fps * 2) === 0,
  }));
  const bytes = muxAvcToMp4({
    width: 64,
    height: 36,
    fps,
    description: fakeAvcC(),
    samples,
  });
  return { bytes, width: 64, height: 36, fps, frames, codec: "avc1.42001f", description: fakeAvcC(), samples };
}

function tone(sr: number, seconds: number) {
  const length = Math.round(sr * seconds);
  const ch = new Float32Array(length);
  for (let i = 0; i < length; i++) ch[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
  return { sampleRate: sr, length, numberOfChannels: 1, getChannelData: () => ch };
}

const SONG = {
  name: "song.wav",
  durationMs: 180_000,
  mimeType: "audio/wav",
  objectUrl: "blob:test",
  peaks: [0.2, 0.8],
};

describe("default Export MP4 path", () => {
  it("primary function is exportMp4 / exportVisWithA1 — not exportVisOnly", async () => {
    const { exportMp4, exportVisWithA1, exportVisOnly } = await import("./vis-export");
    expect(exportMp4.name).toBe("exportMp4");
    expect(exportVisWithA1.name).toBe("exportVisWithA1");
    expect(exportVisOnly.name).toBe("exportVisOnly");
    expect(quoteFfmpegMuxCommand("{visTemp}.mp4", "{a1Range}.wav", "{out}.mp4")).toContain("-map 0:v:0");
    expect(EXAMPLE_FFPROBE_MUXED_STREAMS.streams?.[1]).toMatchObject({
      codec_type: "audio",
      codec_name: "aac",
    });
  });

  it("Loop 01:29.88–02:19.91 → ~50s, A1 PCM passed, Fertig names AAC", () => {
    const p = setLoopRange(placeAudio(createEmptyProject(), SONG), 89_880, 139_910);
    const range = resolveExportRange(p);
    expect(formatTimecode(range.startMs)).toBe("01:29.88");
    expect(formatTimecode(range.endMs)).toBe("02:19.91");
    expect(range.durationMs).toBe(50_030);
    const fps = 30;
    const frames = exportFrameCount(range.durationMs, fps);
    expect(visFileDurationSec(frames, fps)).toBeCloseTo(50.03, 2);
    const sliced = slicePcmWindow(tone(8_000, 150), range.startMs, range.durationMs);
    expect(wavDurationSec(pcmToWav(sliced))).toBeCloseTo(50.03, 2);
    expect(
      formatPrimaryExportFertig({
        frames,
        codec: "avc1.42001f",
        byteLength: 1_024_000,
        range,
      }),
    ).toBe("Fertig · 1501 frames · avc1.42001f · 1024000 bytes · audio: aac · from A1 · range 01:29.88–02:19.91");
  });

  it("Loop OFF → full length + audio on Fertig", () => {
    const looped = setLoopRange(placeAudio(createEmptyProject(), SONG), 89_880, 139_910);
    const full = toggleLoop(looped);
    const range = resolveExportRange(full);
    expect(range.kind).toBe("full");
    expect(range.durationMs).toBe(180_000);
    expect(
      formatPrimaryExportFertig({
        frames: exportFrameCount(range.durationMs, 30),
        codec: "avc1.42001f",
        byteLength: 4_000,
        range,
      }),
    ).toBe("Fertig · 5400 frames · avc1.42001f · 4000 bytes · audio: aac · from A1 · range FULL");
  });

  it("default export without audio stream → failure", async () => {
    const vis = fakeVis(30, 30);
    expect(mp4HasSoundTrack(vis.bytes)).toBe(false);
    await expect(
      attachA1Audio({
        vis,
        pcm: tone(8_000, 2),
        startMs: 0,
        durationMs: 1_000,
        muxA1: async () => ({ bytes: vis.bytes, command: quoteFfmpegMuxCommand("v.mp4", "a.wav", "o.mp4") }),
      }),
    ).rejects.toThrow(/no audio stream/i);
    expect(() => assertPrimaryExportHasAudio(vis.bytes, undefined)).toThrow(NO_AUDIO_STREAM_ERROR);
  });

  it("vis-only secondary still silent by design", () => {
    const vis = fakeVis(30, 30);
    expect(mp4HasSoundTrack(vis.bytes)).toBe(false);
    expect(new TextDecoder().decode(vis.bytes)).not.toContain("soun");
  });
});
