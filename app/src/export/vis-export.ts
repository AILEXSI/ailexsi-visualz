/**
 * Export paths:
 * - Primary `exportMp4` / `exportVisWithA1` — VIS H.264 + audible A1 (AAC).
 *   Tauri/Windows: ffmpeg mux. Browser: WebCodecs AAC. Neither may Fertig without an audio stream.
 * - Secondary `exportVisOnly` — silent vis-only (no audio track), by design.
 */

import {
  assertPrimaryExportHasAudio,
  createOfflineFeatureExtractor,
  createVisualEngine,
  encodeAacFromPcm,
  muxAvcToMp4,
  pcmToWav,
  selectAvcEncoderConfig,
  silentFeatures,
  slicePcmWindow,
  type AvcSample,
  type OfflineFeatureExtractor,
  type PcmBuffer,
} from "@ailexsi/visualz";
import { isTauriRuntime } from "../tauri-runtime";
import { muxVisA1WithFfmpeg } from "./tauri-ffmpeg";

export type VisExportOptions = {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  /** Timeline start of the export window (loop IN, or 0 for FULL). */
  startMs?: number;
  sceneId: string;
  /** Scene at a timeline time — used after Cutter splits with different VIS functions. */
  sceneAt?: (timelineMs: number) => string;
  /** Style params on the VIS clip at a timeline time (Kaleido presets, etc.). */
  paramsAt?: (timelineMs: number) => Record<string, number | string | boolean> | undefined;
  /** PCM / feature time (source file) for a timeline time after trims. */
  featureTimeAt?: (timelineMs: number) => number;
  pcm: PcmBuffer | null;
  onProgress?: (ratio: number, frame: number, total: number) => void;
  signal?: AbortSignal;
  /** Tauri save path — ffmpeg writes the muxed file here. */
  destPath?: string;
  /**
   * Test seam for primary mux. Default: Tauri ffmpeg, else WebCodecs AAC.
   * A fake that returns vis-only bytes is rejected by `assertPrimaryExportHasAudio`.
   */
  muxA1?: MuxA1Fn;
};

export type MuxA1Fn = (req: {
  visBytes: Uint8Array;
  wavBytes: Uint8Array;
  destPath?: string;
}) => Promise<{ bytes: Uint8Array; command?: string; probeJson?: string; writtenPath?: string }>;

export type VisExportResult = {
  bytes: Uint8Array;
  width: number;
  height: number;
  fps: number;
  frames: number;
  codec: string;
  /** Primary path only — never set for vis-only. */
  audio?: "aac";
  command?: string;
  probeJson?: string;
  writtenPath?: string;
};

export type EncodedVis = {
  bytes: Uint8Array;
  width: number;
  height: number;
  fps: number;
  frames: number;
  codec: string;
  description: Uint8Array;
  samples: AvcSample[];
};

function webCodecsUnavailableMessage(): string {
  return "FAIL: WebCodecs VideoEncoder is not available. H.264 MP4 is required; WebM is not a fallback.";
}

async function encodeVisAvc(opts: VisExportOptions): Promise<EncodedVis> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error(webCodecsUnavailableMessage());
  }
  const width = Math.max(16, Math.round(opts.width / 2) * 2);
  const height = Math.max(16, Math.round(opts.height / 2) * 2);
  const fps = opts.fps;
  const durationMs = Math.max(0, opts.durationMs);
  const startMs = Math.max(0, opts.startMs ?? 0);
  const total = Math.max(1, Math.round((durationMs / 1000) * fps));
  const frameDurUs = Math.round(1_000_000 / fps);
  const dt = 1 / fps;

  const selected = await selectAvcEncoderConfig({ width, height, fps });
  if (!selected.ok) throw new Error(selected.error);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const engine = createVisualEngine({
    canvas,
    initialSceneId: opts.sceneId,
    preserveDrawingBuffer: true,
  });
  engine.resize(width, height);

  const extractor: OfflineFeatureExtractor | null = opts.pcm
    ? createOfflineFeatureExtractor(opts.pcm)
    : null;

  const samples: AvcSample[] = [];
  let description: Uint8Array | null = null;
  let encodeError: Error | null = null;

  const encoder = new VideoEncoder({
    output(chunk, meta) {
      if (meta?.decoderConfig?.description && !description) {
        const desc = meta.decoderConfig.description;
        if (desc instanceof ArrayBuffer) {
          description = new Uint8Array(desc.slice(0));
        } else if (ArrayBuffer.isView(desc)) {
          description = new Uint8Array(desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength));
        }
      }
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({
        data,
        timestampUs: chunk.timestamp,
        durationUs: chunk.duration ?? frameDurUs,
        key: chunk.type === "key",
      });
    },
    error(err) {
      encodeError = err instanceof Error ? err : new Error(String(err));
    },
  });

  try {
    encoder.configure({
      ...selected.config,
      latencyMode: "quality",
      hardwareAcceleration: "prefer-software",
    });

    let lastScene = opts.sceneId;
    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) throw new Error("Export cancelled");
      const timeMs = startMs + (i / fps) * 1000;
      const scene = opts.sceneAt?.(timeMs) ?? opts.sceneId;
      if (scene !== lastScene) {
        engine.setScene(scene);
        lastScene = scene;
      }
      const params = opts.paramsAt?.(timeMs);
      if (params) engine.setParams(params);
      const featMs = opts.featureTimeAt?.(timeMs) ?? timeMs;
      engine.setFeatures(extractor ? extractor.sample(featMs) : silentFeatures(featMs));
      engine.step(dt);
      const frame = new VideoFrame(canvas, {
        timestamp: i * frameDurUs,
        duration: frameDurUs,
      });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      opts.onProgress?.((i + 1) / total, i + 1, total);
      if (encodeError) throw encodeError;
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
    }

    await encoder.flush();
    encoder.close();
    if (encodeError) throw encodeError;
    if (!description) throw new Error("FAIL: encoder did not emit AVC decoder config (avcC)");

    const bytes = muxAvcToMp4({
      width,
      height,
      fps,
      description,
      samples,
    });
    return { bytes, width, height, fps, frames: samples.length, codec: selected.codec, description, samples };
  } finally {
    try { encoder.close(); } catch { /* already closed */ }
    engine.destroy();
  }
}

/** Secondary path: silent VIS H.264. No A1. */
export async function exportVisOnly(opts: VisExportOptions): Promise<VisExportResult> {
  const vis = await encodeVisAvc(opts);
  return {
    bytes: vis.bytes,
    width: vis.width,
    height: vis.height,
    fps: vis.fps,
    frames: vis.frames,
    codec: vis.codec,
  };
}

/**
 * Attach A1 to already-encoded vis bytes. Cannot return success without an audio stream.
 * Range WAV is the Loop IN/OUT window (or full A1) — same window as the vis encode.
 */
export async function attachA1Audio(opts: {
  vis: EncodedVis;
  pcm: PcmBuffer;
  startMs: number;
  durationMs: number;
  featureTimeAt?: (timelineMs: number) => number;
  destPath?: string;
  muxA1?: MuxA1Fn;
}): Promise<VisExportResult> {
  const sliced = slicePcmWindow(opts.pcm, opts.startMs, opts.durationMs, opts.featureTimeAt);
  const wavBytes = pcmToWav(sliced);
  const useFfmpeg = Boolean(opts.muxA1) || isTauriRuntime();

  let bytes: Uint8Array;
  let command: string | undefined;
  let probeJson: string | undefined;
  let writtenPath: string | undefined;

  if (useFfmpeg) {
    const mux: MuxA1Fn =
      opts.muxA1 ??
      (async (req) =>
        muxVisA1WithFfmpeg({
          visBytes: req.visBytes,
          wavBytes: req.wavBytes,
          outPath: req.destPath,
        }));
    const muxed = await mux({
      visBytes: opts.vis.bytes,
      wavBytes,
      destPath: opts.destPath,
    });
    bytes = muxed.bytes;
    command = muxed.command;
    probeJson = muxed.probeJson;
    writtenPath = muxed.writtenPath;
  } else {
    let aac;
    try {
      aac = await encodeAacFromPcm(sliced);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `FAIL: AAC encoder could not mux A1 (${msg}). Browser Export MP4 needs WebCodecs AudioEncoder. On the Windows EXE, ffmpeg muxes VIS + A1. Vis-only is a separate button.`,
      );
    }
    bytes = muxAvcToMp4({
      width: opts.vis.width,
      height: opts.vis.height,
      fps: opts.vis.fps,
      description: opts.vis.description,
      samples: opts.vis.samples,
      audio: aac,
    });
  }

  assertPrimaryExportHasAudio(bytes, "aac", probeJson);
  return {
    bytes,
    width: opts.vis.width,
    height: opts.vis.height,
    fps: opts.vis.fps,
    frames: opts.vis.frames,
    codec: opts.vis.codec,
    audio: "aac",
    command,
    probeJson,
    writtenPath,
  };
}

/**
 * Default Export MP4: one playable file — VIS H.264 + A1 AAC.
 * Tauri: ffmpeg `-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k`.
 * Browser: WebCodecs AAC mux, then the same audio-stream probe.
 */
export async function exportMp4(opts: VisExportOptions): Promise<VisExportResult> {
  if (!opts.pcm) {
    throw new Error("FAIL: A1 audio is required for Export MP4. Import audio first. Vis-only is a separate button.");
  }
  const vis = await encodeVisAvc(opts);
  return attachA1Audio({
    vis,
    pcm: opts.pcm,
    startMs: Math.max(0, opts.startMs ?? 0),
    durationMs: Math.max(0, opts.durationMs),
    featureTimeAt: opts.featureTimeAt,
    destPath: opts.destPath,
    muxA1: opts.muxA1,
  });
}

/** Alias — primary path is never named exportVisOnly. */
export async function exportVisWithA1(opts: VisExportOptions): Promise<VisExportResult> {
  return exportMp4(opts);
}
