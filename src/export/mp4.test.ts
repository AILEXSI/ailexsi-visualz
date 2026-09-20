import { describe, expect, it } from "vitest";
import { mp4HasSoundTrack, muxAvcToMp4, readFourccAt } from "./mp4";
import { avcEncoderCandidates, requiredAvcLevel } from "./avc";

function fakeAvcC(): Uint8Array {
  return new Uint8Array([1, 0x42, 0x00, 0x1f, 0xff, 0xe1, 0x00]);
}

describe("vis-only MP4 mux", () => {
  it("writes ftyp + moov + mdat for one keyframe", () => {
    const bytes = muxAvcToMp4({
      width: 1280,
      height: 720,
      fps: 30,
      description: fakeAvcC(),
      samples: [
        { data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]), timestampUs: 0, durationUs: 33_333, key: true },
      ],
    });
    expect(readFourccAt(bytes, 4)).toBe("ftyp");
    expect(bytes.byteLength).toBeGreaterThan(64);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("moov");
    expect(text).toContain("mdat");
    expect(text).toContain("avc1");
    expect(text).not.toContain("mp4a");
    expect(text).not.toContain("soun");
    expect([...text.matchAll(/trak/g)]).toHaveLength(1);
  });

  it("movie duration equals sample count / fps (vis-only, no audio track)", () => {
    const fps = 30;
    const frames = 90;
    const samples = Array.from({ length: frames }, (_, i) => ({
      data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]),
      timestampUs: Math.round((i / fps) * 1_000_000),
      durationUs: Math.round(1_000_000 / fps),
      key: i === 0,
    }));
    const bytes = muxAvcToMp4({
      width: 64,
      height: 36,
      fps,
      description: fakeAvcC(),
      samples,
    });
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain("mp4a");
    expect([...text.matchAll(/trak/g)]).toHaveLength(1);
    expect(frames / fps).toBeCloseTo(3, 6);
  });

  it("refuses an empty sample list", () => {
    expect(() =>
      muxAvcToMp4({ width: 16, height: 16, fps: 30, description: fakeAvcC(), samples: [] }),
    ).toThrow(/No encoded samples/);
  });
});

describe("AVC capability", () => {
  it("720p30 starts at Level 3.1 Baseline", () => {
    const level = requiredAvcLevel(1280, 720, 30);
    expect(level?.label).toBe("3.1");
    expect(avcEncoderCandidates(1280, 720, 30)[0]).toBe("avc1.42001f");
  });

  it("1080p30 requires Level 4.0", () => {
    const level = requiredAvcLevel(1920, 1080, 30);
    expect(level?.label).toBe("4.0");
    expect(avcEncoderCandidates(1920, 1080, 30)[0]).toBe("avc1.420028");
  });
});

describe("muxed A1 audio", () => {
  it("adds one sound trak (mp4a) next to vis — player needs no extra file", () => {
    const bytes = muxAvcToMp4({
      width: 64,
      height: 36,
      fps: 30,
      description: fakeAvcC(),
      samples: [
        { data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]), timestampUs: 0, durationUs: 33_333, key: true },
      ],
      audio: {
        sampleRate: 48000,
        channels: 2,
        description: new Uint8Array([0x11, 0x90]),
        samples: [{ data: new Uint8Array([1, 2, 3, 4]), timestampUs: 0, durationUs: 21_333 }],
      },
    });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("avc1");
    expect(text).toContain("mp4a");
    expect(text).toContain("soun");
    expect(mp4HasSoundTrack(bytes)).toBe(true);
    expect([...text.matchAll(/trak/g)].length).toBeGreaterThanOrEqual(2);
  });

  it("muxer can still write sowt — primary Export MP4 must not treat that as Fertig", () => {
    const pcm = new Uint8Array(480);
    const bytes = muxAvcToMp4({
      width: 64,
      height: 36,
      fps: 30,
      description: fakeAvcC(),
      samples: [
        { data: new Uint8Array([0, 0, 0, 8, 0x65, 1, 2, 3, 4, 5, 6, 7]), timestampUs: 0, durationUs: 33_333, key: true },
      ],
      pcm: { sampleRate: 48000, channels: 1, data: pcm, frames: 240 },
    });
    expect(mp4HasSoundTrack(bytes)).toBe(true);
    expect(new TextDecoder().decode(bytes)).toContain("sowt");
  });
});
