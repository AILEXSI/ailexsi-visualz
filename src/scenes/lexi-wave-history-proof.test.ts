import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CORE_BUILD_ID } from "../audio/wave-core";
import { createWaveHistoryAnalyzer } from "../audio/wave-history-analyzer";
import {
  WAVE_HISTORY_MUSIC_NAME,
  WAVE_HISTORY_PROOF_TIMES_MS,
  createWaveHistoryMusicBuffer,
  createWaveHistoryMusicPcm,
  encodeWavPcm16,
} from "../audio/wave-history-music-fixture";
import { evidenceLabel } from "./lexi-wave-history-draw";
import { rasterizeWaveHistory } from "./lexi-wave-history-raster";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function encodePngRgba(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[(width * 4 + 1) * y] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, (width * 4 + 1) * y + 1);
  }
  const compressed = deflateSync(raw);
  const chunks: Buffer[] = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    chunks.push(out);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  chunk("IHDR", ihdr);
  chunk("IDAT", compressed);
  chunk("IEND", Buffer.alloc(0));
  return Buffer.concat(chunks);
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

describe("wave-history evidence artifacts", () => {
  it("writes fixture WAV, Preview/Export hashes, and geometry-only PNGs", () => {
    const pcm = createWaveHistoryMusicBuffer();
    const preview = createWaveHistoryAnalyzer(pcm);
    const exported = createWaveHistoryAnalyzer(pcm);
    const points = WAVE_HISTORY_PROOF_TIMES_MS.map((timeMs) => {
      for (let t = 0; t <= timeMs; t += 1000 / 30) preview.sampleAt(t);
      const p = preview.sampleAt(timeMs);
      const e = exported.sampleAt(timeMs);
      expect(p.historyHash).toBe(e.historyHash);
      expect(p.bandsHash).toBe(e.bandsHash);
      return {
        timeMs,
        audioTimeSec: timeMs / 1000,
        pcmWindow: { start: p.windowStart, end: p.windowEnd, hop: p.windowEnd - p.windowStart },
        sampleRange: { start: 0, end: p.coreSampleEnd, sampleRate: 44100 },
        dominantBand: p.dominantBand,
        dominantEnergy: p.dominantEnergy,
        bandsHash: p.bandsHash,
        historyHash: p.historyHash,
        hopCount: p.hopCount,
        buildId: p.buildId,
        previewHistoryHash: p.historyHash,
        exportHistoryHash: e.historyHash,
        passage:
          timeMs === 2500 ? "bass-heavy" : timeMs === 4100 ? "kick transient" : "build / dense chirp",
      };
    });

    mkdirSync(join(root, "fixtures"), { recursive: true });
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "fixtures", WAVE_HISTORY_MUSIC_NAME), encodeWavPcm16(createWaveHistoryMusicPcm()));
    writeFileSync(join(root, "docs/wave-history-evidence-points.json"), JSON.stringify({
      buildId: CORE_BUILD_ID,
      fixture: WAVE_HISTORY_MUSIC_NAME,
      points,
    }, null, 2) + "\n");

    const width = 1280;
    const height = 720;
    const mosaics: Uint8ClampedArray[] = [];
    for (const timeMs of WAVE_HISTORY_PROOF_TIMES_MS) {
      const snap = createWaveHistoryAnalyzer(pcm).sampleAt(timeMs);
      const rgba = rasterizeWaveHistory(width, height, snap.ring, evidenceLabel(snap));
      mosaics.push(rgba);
      const png = encodePngRgba(width, height, rgba);
      const name = `lexi-wave-history-evidence-${timeMs}ms.png`;
      writeFileSync(join(root, "docs", name), png);
    }

    const mosaicW = width;
    const mosaicH = height * 3;
    const mosaic = new Uint8ClampedArray(mosaicW * mosaicH * 4);
    mosaics.forEach((src, i) => {
      mosaic.set(src, i * width * height * 4);
    });
    writeFileSync(join(root, "docs/lexi-wave-history-evidence-geometry.png"), encodePngRgba(mosaicW, mosaicH, mosaic));

    expect(points[0]?.buildId).toBe(CORE_BUILD_ID);
    expect(points.every((p) => p.previewHistoryHash === p.exportHistoryHash)).toBe(true);
  });
});
