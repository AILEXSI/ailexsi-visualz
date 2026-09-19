import type { PcmBuffer } from "../audio/offline-extractor";

export type SlicedPcm = {
  sampleRate: number;
  channels: number;
  length: number;
  getChannelData: (channel: number) => Float32Array;
};

/** Map an export window onto A1 PCM. `featureTimeAt` keeps cuts/trims in sync. */
export function slicePcmWindow(
  pcm: PcmBuffer,
  startMs: number,
  durationMs: number,
  featureTimeAt?: (timelineMs: number) => number,
): SlicedPcm {
  const sampleRate = pcm.sampleRate;
  const channels = Math.max(1, Math.min(2, pcm.numberOfChannels));
  const length = Math.max(1, Math.round((Math.max(0, durationMs) / 1000) * sampleRate));
  const out: Float32Array[] = [];
  for (let c = 0; c < channels; c++) out.push(new Float32Array(length));
  const src: Float32Array[] = [];
  for (let c = 0; c < channels; c++) src.push(pcm.getChannelData(c));
  const srcLen = pcm.length;
  for (let i = 0; i < length; i++) {
    const timelineMs = startMs + (i / sampleRate) * 1000;
    const srcMs = featureTimeAt ? featureTimeAt(timelineMs) : timelineMs;
    const si = Math.max(0, Math.min(srcLen - 1, Math.floor((srcMs / 1000) * sampleRate)));
    for (let c = 0; c < channels; c++) out[c]![i] = src[c]![si] ?? 0;
  }
  return {
    sampleRate,
    channels,
    length,
    getChannelData: (channel: number) => out[Math.max(0, Math.min(channels - 1, channel))]!,
  };
}

export function pcmToSowt(pcm: SlicedPcm): { data: Uint8Array; frames: number; channels: number; sampleRate: number } {
  const frames = pcm.length;
  const channels = pcm.channels;
  const data = new Uint8Array(frames * channels * 2);
  const view = new DataView(data.buffer);
  const ch: Float32Array[] = [];
  for (let c = 0; c < channels; c++) ch.push(pcm.getChannelData(c));
  let o = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, ch[c]![i] ?? 0));
      view.setInt16(o, Math.round(s * 32767), true);
      o += 2;
    }
  }
  return { data, frames, channels, sampleRate: pcm.sampleRate };
}

export function slicedPcmIsAudible(pcm: SlicedPcm, floor = 0.01): boolean {
  const ch = pcm.getChannelData(0);
  let peak = 0;
  const step = Math.max(1, Math.floor(ch.length / 4000));
  for (let i = 0; i < ch.length; i += step) peak = Math.max(peak, Math.abs(ch[i] ?? 0));
  return peak >= floor;
}
