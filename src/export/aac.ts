import type { AacSample, AacTrack } from "./mp4";
import type { SlicedPcm } from "./pcm-slice";

export const AAC_CODEC = "mp4a.40.2";
export const AAC_BITRATE = 320_000;

function stripAdts(raw: Uint8Array): Uint8Array {
  if (raw.length >= 7 && raw[0] === 0xff && ((raw[1] ?? 0) & 0xf0) === 0xf0) {
    const crc = ((raw[1] ?? 0) & 0x01) === 0;
    return raw.subarray(crc ? 9 : 7);
  }
  return raw;
}

function descriptionBytes(desc: unknown): Uint8Array | undefined {
  if (!desc) return undefined;
  if (desc instanceof ArrayBuffer) return new Uint8Array(desc.slice(0));
  if (ArrayBuffer.isView(desc)) {
    return new Uint8Array(desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength));
  }
  return undefined;
}

export function aacAudioSpecificConfigIsUsable(desc: Uint8Array | undefined | null): boolean {
  if (!desc || desc.byteLength < 2) return false;
  const objectType = desc[0]! >> 3;
  return objectType >= 1 && objectType <= 31;
}

export async function encodeAacFromPcm(pcm: SlicedPcm): Promise<AacTrack> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") {
    throw new Error("AAC encoder unavailable");
  }
  const samples: AacSample[] = [];
  let description: Uint8Array | undefined;
  let encodeError: Error | undefined;
  const encoder = new AudioEncoder({
    output(chunk, meta) {
      const desc = descriptionBytes(meta?.decoderConfig?.description);
      if (desc && desc.byteLength > 0) description = desc;
      const raw = new Uint8Array(chunk.byteLength);
      chunk.copyTo(raw);
      const data = stripAdts(raw);
      if (!data.byteLength) return;
      samples.push({
        data,
        timestampUs: chunk.timestamp,
        durationUs: chunk.duration ?? Math.round((1024 / pcm.sampleRate) * 1_000_000),
      });
    },
    error(err) {
      encodeError = err instanceof Error ? err : new Error(String(err));
    },
  });
  try {
    encoder.configure({
      codec: AAC_CODEC,
      numberOfChannels: pcm.channels,
      sampleRate: pcm.sampleRate,
      bitrate: AAC_BITRATE,
    });
    const frameSize = 1024;
    for (let offset = 0; offset < pcm.length; offset += frameSize) {
      if (encodeError) throw encodeError;
      const frames = Math.min(frameSize, pcm.length - offset);
      const planar = new Float32Array(frames * pcm.channels);
      for (let c = 0; c < pcm.channels; c++) {
        planar.set(pcm.getChannelData(c).subarray(offset, offset + frames), c * frames);
      }
      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate: pcm.sampleRate,
        numberOfFrames: frames,
        numberOfChannels: pcm.channels,
        timestamp: Math.round((offset / pcm.sampleRate) * 1_000_000),
        data: planar,
      });
      encoder.encode(audioData);
      audioData.close();
    }
    await encoder.flush();
    encoder.close();
  } catch (err) {
    try { encoder.close(); } catch { /* already closed */ }
    throw err instanceof Error ? err : new Error(String(err));
  }
  if (encodeError) throw encodeError;
  if (!description || !aacAudioSpecificConfigIsUsable(description)) {
    throw new Error("AAC encoder did not emit a usable AudioSpecificConfig");
  }
  if (!samples.length) throw new Error("AAC encoder produced no samples");
  return {
    sampleRate: pcm.sampleRate,
    channels: pcm.channels,
    description,
    samples,
  };
}
