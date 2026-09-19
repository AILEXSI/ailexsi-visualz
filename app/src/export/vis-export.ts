/**
 * Export MP4: cinematic VIS frames (H.264) + A1 audio when requested.
 * Primary path muxes AAC (or PCM fallback). Vis-only is the silent option.
 */

import {
  createOfflineFeatureExtractor,
  createVisualEngine,
  encodeAacFromPcm,
  muxAvcToMp4,
  pcmToSowt,
  selectAvcEncoderConfig,
  silentFeatures,
  slicePcmWindow,
  type AvcSample,
  type OfflineFeatureExtractor,
  type PcmBuffer,
} from "@ailexsi/visualz";

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
  /** Mux A1 into the same MP4 (primary). False = silent vis-only. */
  muxAudio?: boolean;
  onProgress?: (ratio: number, frame: number, total: number) => void;
  signal?: AbortSignal;
};

export type VisExportResult = {
  bytes: Uint8Array;
  width: number;
  height: number;
  fps: number;
  frames: number;
  codec: string;
  audio?: "aac/A1" | "pcm/A1";
};

function webCodecsUnavailableMessage(): string {
  return "FAIL: WebCodecs VideoEncoder is not available. H.264 MP4 is required; WebM is not a fallback.";
}

export async function exportVisOnly(opts: VisExportOptions): Promise<VisExportResult> {
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

    let audio: VisExportResult["audio"];
    let aac;
    let pcmTrack;
    if (opts.muxAudio) {
      if (!opts.pcm) throw new Error("A1 audio is required for Export MP4");
      const sliced = slicePcmWindow(opts.pcm, startMs, durationMs, opts.featureTimeAt);
      try {
        aac = await encodeAacFromPcm(sliced);
        audio = "aac/A1";
      } catch {
        const sowt = pcmToSowt(sliced);
        pcmTrack = {
          sampleRate: sowt.sampleRate,
          channels: sowt.channels,
          data: sowt.data,
          frames: sowt.frames,
        };
        audio = "pcm/A1";
      }
    }
    const bytes = muxAvcToMp4({
      width,
      height,
      fps,
      description,
      samples,
      audio: aac,
      pcm: pcmTrack,
    });
    return { bytes, width, height, fps, frames: samples.length, codec: selected.codec, audio };
  } finally {
    try { encoder.close(); } catch { /* already closed */ }
    engine.destroy();
  }
}
