import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXAMPLE_FFPROBE_MUXED_STREAMS,
  NO_AUDIO_STREAM_ERROR,
  assertPrimaryExportHasAudio,
  ffmpegMuxArgv,
  ffprobeAudioCodec,
  ffprobeDurationSec,
  ffprobeHasAudioStream,
  quoteFfmpegMuxCommand,
} from "./ffmpeg-mux";
import { muxAvcToMp4, mp4HasSoundTrack } from "./mp4";
import { slicePcmWindow } from "./pcm-slice";
import { pcmToWav, wavDurationSec } from "./wav";

function fakeAvcC(): Uint8Array {
  return new Uint8Array([1, 0x42, 0x00, 0x1f, 0xff, 0xe1, 0x00]);
}

function visOnlyBytes(): Uint8Array {
  return muxAvcToMp4({
    width: 64,
    height: 36,
    fps: 30,
    description: fakeAvcC(),
    samples: [
      { data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]), timestampUs: 0, durationUs: 33_333, key: true },
    ],
  });
}

function tone(sr: number, seconds: number) {
  const length = Math.round(sr * seconds);
  const ch = new Float32Array(length);
  for (let i = 0; i < length; i++) ch[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
  return {
    sampleRate: sr,
    length,
    numberOfChannels: 1,
    getChannelData: () => ch,
  };
}

function haveTool(name: string): boolean {
  return spawnSync(name, ["-version"], { encoding: "utf8" }).status === 0;
}

describe("ffmpeg mux command (quoted, maps mandatory)", () => {
  it("quotes the exact command started on Tauri/Windows", () => {
    const command = quoteFfmpegMuxCommand("{visTemp}.mp4", "{a1Range}.wav", "{out}.mp4");
    expect(command).toBe(
      'ffmpeg -y -i "{visTemp}.mp4" -i "{a1Range}.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest "{out}.mp4"',
    );
    const argv = ffmpegMuxArgv("{visTemp}.mp4", "{a1Range}.wav", "{out}.mp4");
    expect(argv).toEqual([
      "-y",
      "-i",
      "{visTemp}.mp4",
      "-i",
      "{a1Range}.wav",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-shortest",
      "{out}.mp4",
    ]);
    expect(argv).toContain("0:v:0");
    expect(argv).toContain("1:a:0");
    expect(argv).toContain("aac");
  });
});

describe("primary export probe", () => {
  it("example ffprobe stream list of a muxed output has codec_type=audio aac", () => {
    expect(ffprobeHasAudioStream(EXAMPLE_FFPROBE_MUXED_STREAMS)).toBe(true);
    expect(ffprobeAudioCodec(EXAMPLE_FFPROBE_MUXED_STREAMS)).toBe("aac");
    expect(EXAMPLE_FFPROBE_MUXED_STREAMS.streams?.map((s) => s.codec_type)).toEqual(["video", "audio"]);
  });

  it("default export without audio stream → failure (never Fertig)", () => {
    const bytes = visOnlyBytes();
    expect(mp4HasSoundTrack(bytes)).toBe(false);
    expect(() => assertPrimaryExportHasAudio(bytes, undefined)).toThrow(NO_AUDIO_STREAM_ERROR);
    expect(() => assertPrimaryExportHasAudio(bytes, "aac")).toThrow(/no audio stream/i);
    expect(() =>
      assertPrimaryExportHasAudio(bytes, "aac", JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264" }] })),
    ).toThrow(/codec_type=audio/);
  });

  it("sowt-only mux is not a primary success", () => {
    const bytes = muxAvcToMp4({
      width: 64,
      height: 36,
      fps: 30,
      description: fakeAvcC(),
      samples: [
        { data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]), timestampUs: 0, durationUs: 33_333, key: true },
      ],
      pcm: { sampleRate: 48000, channels: 1, data: new Uint8Array(480), frames: 240 },
    });
    expect(() => assertPrimaryExportHasAudio(bytes, "aac")).toThrow(/sowt|inaudible/i);
  });

  it("vis-only secondary still silent by design", () => {
    const bytes = visOnlyBytes();
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain("soun");
    expect(text).not.toContain("mp4a");
    expect(mp4HasSoundTrack(bytes)).toBe(false);
    expect([...text.matchAll(/trak/g)]).toHaveLength(1);
  });
});

describe("loop / full A1 range → WAV + ffmpeg mux", () => {
  const IN_MS = 89_880;
  const OUT_MS = 139_910;

  it("Loop 01:29.88–02:19.91 → ~50s A1 WAV (same window as vis)", () => {
    const pcm = tone(8_000, 150);
    const sliced = slicePcmWindow(pcm, IN_MS, OUT_MS - IN_MS);
    const wav = pcmToWav(sliced);
    expect(wavDurationSec(wav)).toBeCloseTo(50.03, 2);
    expect(sliced.length / 8_000).toBeCloseTo((OUT_MS - IN_MS) / 1000, 2);
  });

  it("Loop OFF → full A1 length on the range WAV", () => {
    const pcm = tone(16_000, 12.5);
    const sliced = slicePcmWindow(pcm, 0, 12_500);
    expect(wavDurationSec(pcmToWav(sliced))).toBeCloseTo(12.5, 2);
  });

  it("real ffmpeg mux has an audio stream; duration ≈ OUT-IN", () => {
    if (!haveTool("ffmpeg") || !haveTool("ffprobe")) {
      expect(quoteFfmpegMuxCommand("visTemp.mp4", "a1Range.wav", "out.mp4")).toContain("-map 1:a:0");
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "visualz-ffmpeg-"));
    const vis = join(dir, "visTemp.mp4");
    const wavPath = join(dir, "a1Range.wav");
    const out = join(dir, "out.mp4");
    try {
      const dur = (OUT_MS - IN_MS) / 1000;
      const makeVis = spawnSync(
        "ffmpeg",
        ["-y", "-f", "lavfi", "-i", `color=c=black:s=64x36:d=${dur}:r=30`, "-c:v", "libx264", "-pix_fmt", "yuv420p", vis],
        { encoding: "utf8" },
      );
      expect(makeVis.status, makeVis.stderr).toBe(0);
      writeFileSync(wavPath, pcmToWav(slicePcmWindow(tone(16_000, 150), IN_MS, OUT_MS - IN_MS)));
      const command = quoteFfmpegMuxCommand(vis, wavPath, out);
      expect(command).toBe(
        `ffmpeg -y -i "${vis}" -i "${wavPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest "${out}"`,
      );
      const mux = spawnSync("ffmpeg", ffmpegMuxArgv(vis, wavPath, out), { encoding: "utf8" });
      expect(mux.status, `command: ${command}\n${mux.stderr}`).toBe(0);
      const probe = spawnSync(
        "ffprobe",
        ["-v", "error", "-show_streams", "-print_format", "json", out],
        { encoding: "utf8" },
      );
      expect(ffprobeHasAudioStream(probe.stdout)).toBe(true);
      expect(ffprobeAudioCodec(probe.stdout)).toBe("aac");
      const bytes = new Uint8Array(readFileSync(out));
      assertPrimaryExportHasAudio(bytes, "aac", probe.stdout);
      const seconds = ffprobeDurationSec(probe.stdout);
      expect(seconds).toBeGreaterThan(49);
      expect(seconds).toBeLessThan(51.5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Loop OFF ffmpeg mux is full length + audio", () => {
    if (!haveTool("ffmpeg") || !haveTool("ffprobe")) return;
    const dir = mkdtempSync(join(tmpdir(), "visualz-ffmpeg-full-"));
    const vis = join(dir, "visTemp.mp4");
    const wavPath = join(dir, "a1Range.wav");
    const out = join(dir, "out.mp4");
    try {
      const makeVis = spawnSync(
        "ffmpeg",
        ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x36:d=12.5:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", vis],
        { encoding: "utf8" },
      );
      expect(makeVis.status, makeVis.stderr).toBe(0);
      writeFileSync(wavPath, pcmToWav(slicePcmWindow(tone(16_000, 12.5), 0, 12_500)));
      const mux = spawnSync("ffmpeg", ffmpegMuxArgv(vis, wavPath, out), { encoding: "utf8" });
      expect(mux.status, mux.stderr).toBe(0);
      const probe = spawnSync(
        "ffprobe",
        ["-v", "error", "-show_streams", "-print_format", "json", out],
        { encoding: "utf8" },
      );
      expect(ffprobeHasAudioStream(probe.stdout)).toBe(true);
      const seconds = ffprobeDurationSec(probe.stdout);
      expect(seconds).toBeGreaterThan(12);
      expect(seconds).toBeLessThan(13.2);
      assertPrimaryExportHasAudio(new Uint8Array(readFileSync(out)), "aac", probe.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
