import { mp4HasSoundTrack } from "./mp4";

/** Exact argv after the binary. Maps are mandatory; AAC encoder is never omitted. */
export const FFMPEG_MUX_FLAGS = [
  "-y",
  "-i",
  "-i",
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
] as const;

export const NO_AUDIO_STREAM_ERROR =
  "FAIL: Export MP4 has no audio stream. Silent vis-only is not a success. A1 was not muxed.";

export const FFMPEG_MISSING_ERROR =
  "FAIL: ffmpeg not found on PATH. Export MP4 requires ffmpeg to mux VIS H.264 + A1 audio (AAC 320k). Vis-only is not a silent fallback. Install ffmpeg or add it to PATH.";

export function quoteFfmpegArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * Canonical command logged / tested / started:
 * ffmpeg -y -i "{visTemp}.mp4" -i "{a1Range}.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest "{out}.mp4"
 */
export function ffmpegMuxArgv(visTempMp4: string, a1RangeWav: string, outMp4: string): string[] {
  return [
    "-y",
    "-i",
    visTempMp4,
    "-i",
    a1RangeWav,
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
    outMp4,
  ];
}

export function quoteFfmpegMuxCommand(
  visTempMp4: string,
  a1RangeWav: string,
  outMp4: string,
  ffmpegBin = "ffmpeg",
): string {
  const bin =
    ffmpegBin === "ffmpeg" || ffmpegBin.endsWith("ffmpeg") || ffmpegBin.endsWith("ffmpeg.exe")
      ? "ffmpeg"
      : quoteFfmpegArg(ffmpegBin);
  return [
    bin,
    "-y",
    "-i",
    quoteFfmpegArg(visTempMp4),
    "-i",
    quoteFfmpegArg(a1RangeWav),
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
    quoteFfmpegArg(outMp4),
  ].join(" ");
}

export type FfprobeStream = {
  index?: number;
  codec_name?: string;
  codec_type?: string;
  duration?: string;
  bit_rate?: string;
};

export type FfprobeJson = {
  streams?: FfprobeStream[];
};

export function parseFfprobeJson(raw: string): FfprobeJson {
  try {
    return JSON.parse(raw) as FfprobeJson;
  } catch {
    return {};
  }
}

export function ffprobeHasAudioStream(probe: string | FfprobeJson): boolean {
  const json = typeof probe === "string" ? parseFfprobeJson(probe) : probe;
  return (json.streams ?? []).some((s) => s.codec_type === "audio");
}

export function ffprobeAudioCodec(probe: string | FfprobeJson): string | undefined {
  const json = typeof probe === "string" ? parseFfprobeJson(probe) : probe;
  return (json.streams ?? []).find((s) => s.codec_type === "audio")?.codec_name;
}

export function ffprobeDurationSec(probe: string | FfprobeJson): number | undefined {
  const json = typeof probe === "string" ? parseFfprobeJson(probe) : probe;
  for (const s of json.streams ?? []) {
    const n = Number(s.duration);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function mp4LooksLikeSowtOnly(bytes: Uint8Array): boolean {
  const text = new TextDecoder().decode(bytes);
  return text.includes("sowt") && !text.includes("mp4a");
}

/**
 * Primary Export MP4 cannot succeed without an audio stream.
 * Called after bytes are written — Fertig is never shown when this throws.
 */
export function assertPrimaryExportHasAudio(
  bytes: Uint8Array,
  audio?: string | null,
  probeJson?: string | null,
): void {
  const probeOk = probeJson ? ffprobeHasAudioStream(probeJson) : false;
  const boxOk = mp4HasSoundTrack(bytes);
  if (!audio) {
    throw new Error(NO_AUDIO_STREAM_ERROR);
  }
  if (probeJson && !probeOk) {
    throw new Error(`${NO_AUDIO_STREAM_ERROR} ffprobe has no codec_type=audio.`);
  }
  if (!boxOk && !probeOk) {
    throw new Error(NO_AUDIO_STREAM_ERROR);
  }
  if (mp4LooksLikeSowtOnly(bytes) && ffprobeAudioCodec(probeJson ?? "") !== "aac") {
    throw new Error(
      "FAIL: Export MP4 muxed inaudible PCM (sowt). Need AAC. ffmpeg mux is required on Tauri.",
    );
  }
}

export const EXAMPLE_FFPROBE_MUXED_STREAMS: FfprobeJson = {
  streams: [
    { index: 0, codec_name: "h264", codec_type: "video" },
    { index: 1, codec_name: "aac", codec_type: "audio", bit_rate: "320000" },
  ],
};
