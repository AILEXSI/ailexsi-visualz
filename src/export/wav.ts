import { pcmToSowt, type SlicedPcm } from "./pcm-slice";

const WAV_HEADER = 44;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** 16-bit little-endian PCM WAV for the A1 export window (ffmpeg `-i a1Range.wav`). */
export function pcmToWav(pcm: SlicedPcm): Uint8Array {
  const sowt = pcmToSowt(pcm);
  const dataSize = sowt.data.byteLength;
  const out = new Uint8Array(WAV_HEADER + dataSize);
  const view = new DataView(out.buffer);
  const blockAlign = sowt.channels * 2;
  const byteRate = sowt.sampleRate * blockAlign;
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, sowt.channels, true);
  view.setUint32(24, sowt.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  out.set(sowt.data, WAV_HEADER);
  return out;
}

export function wavDurationSec(bytes: Uint8Array): number {
  if (bytes.byteLength < WAV_HEADER) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  const dataSize = view.getUint32(40, true);
  if (!channels || !sampleRate || !bits) return 0;
  return dataSize / (sampleRate * channels * (bits / 8));
}
