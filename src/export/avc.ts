/**
 * ENC-01-style AVC encoder probe — lifted in spirit from Resonance Studio 5.6.
 * No WebM fallback. Fail loud when the platform cannot encode H.264.
 */

export const AVC_BASELINE_LEVEL_3_1 = "avc1.42001f";
export const DEFAULT_AVC_BITRATE = 3_000_000;

export type AvcLevel = {
  idc: number;
  label: string;
  maxFrameMbs: number;
  maxMbRate: number;
};

export type AvcProfile = {
  idc: number;
  compat: number;
  label: string;
};

export const AVC_LEVELS: readonly AvcLevel[] = [
  { idc: 0x1f, label: "3.1", maxFrameMbs: 3600, maxMbRate: 108_000 },
  { idc: 0x28, label: "4.0", maxFrameMbs: 8192, maxMbRate: 245_760 },
  { idc: 0x29, label: "4.1", maxFrameMbs: 8192, maxMbRate: 245_760 },
  { idc: 0x2a, label: "4.2", maxFrameMbs: 8704, maxMbRate: 522_240 },
  { idc: 0x32, label: "5.0", maxFrameMbs: 22080, maxMbRate: 589_824 },
  { idc: 0x33, label: "5.1", maxFrameMbs: 36864, maxMbRate: 983_040 },
];

export const AVC_PROFILES: readonly AvcProfile[] = [
  { idc: 0x42, compat: 0x00, label: "Baseline" },
  { idc: 0x4d, compat: 0x00, label: "Main" },
  { idc: 0x64, compat: 0x00, label: "High" },
];

export type AvcSupportProbe = (
  config: VideoEncoderConfig,
) => Promise<{ supported: boolean; config?: VideoEncoderConfig }>;

export type AvcEncoderSelection =
  | { ok: true; config: VideoEncoderConfig; codec: string; tried: string[] }
  | { ok: false; error: string; tried: string[] };

function hex2(n: number): string {
  return (n & 0xff).toString(16).padStart(2, "0");
}

export function avcCodecString(profileIdc: number, compat: number, levelIdc: number): string {
  return `avc1.${hex2(profileIdc)}${hex2(compat)}${hex2(levelIdc)}`;
}

export function frameMacroblocks(width: number, height: number): number {
  return Math.ceil(Math.max(0, width) / 16) * Math.ceil(Math.max(0, height) / 16);
}

export function requiredAvcLevel(width: number, height: number, fps: number): AvcLevel | null {
  const mbs = frameMacroblocks(width, height);
  const mbRate = mbs * Math.max(1, fps);
  return AVC_LEVELS.find((level) => level.maxFrameMbs >= mbs && level.maxMbRate >= mbRate) ?? null;
}

export function avcEncoderCandidates(width: number, height: number, fps: number): string[] {
  const min = requiredAvcLevel(width, height, fps);
  if (!min) return [];
  const start = AVC_LEVELS.findIndex((level) => level.idc === min.idc);
  if (start < 0) return [];
  const codecs: string[] = [];
  for (let i = start; i < AVC_LEVELS.length; i++) {
    const level = AVC_LEVELS[i]!;
    for (const profile of AVC_PROFILES) {
      codecs.push(avcCodecString(profile.idc, profile.compat, level.idc));
    }
  }
  return codecs;
}

export function unsupportedAvcEncoderMessage(
  width: number,
  height: number,
  fps: number,
  tried: string[],
): string {
  if (tried.length === 0) {
    return `FAIL: H.264 encoder cannot represent ${width}x${height}@${fps} (exceeds Level 5.1). WebM is not a fallback.`;
  }
  return `FAIL: H.264 encoder not supported for ${width}x${height}@${fps} (tried ${tried.join(", ")}). WebM is not a fallback.`;
}

export function defaultAvcSupportProbe(): AvcSupportProbe {
  return async (config) => {
    if (typeof VideoEncoder === "undefined" || typeof VideoEncoder.isConfigSupported !== "function") {
      return { supported: false };
    }
    const result = await VideoEncoder.isConfigSupported(config);
    return { supported: result.supported === true, config: result.config };
  };
}

function isAvc1Codec(codec: string | undefined): boolean {
  return typeof codec === "string" && codec.toLowerCase().startsWith("avc1.");
}

export async function selectAvcEncoderConfig(
  params: { width: number; height: number; fps: number; bitrate?: number },
  probe: AvcSupportProbe = defaultAvcSupportProbe(),
): Promise<AvcEncoderSelection> {
  const { width, height, fps } = params;
  const bitrate = params.bitrate ?? DEFAULT_AVC_BITRATE;
  const tried = avcEncoderCandidates(width, height, fps);
  if (tried.length === 0) {
    return { ok: false, error: unsupportedAvcEncoderMessage(width, height, fps, tried), tried };
  }

  for (const codec of tried) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      avc: { format: "avc" },
    };
    try {
      const result = await probe(config);
      if (!result.supported) continue;
      const chosen = result.config ?? config;
      const chosenCodec = chosen.codec ?? codec;
      if (!isAvc1Codec(chosenCodec)) continue;
      return {
        ok: true,
        codec: chosenCodec,
        tried,
        config: {
          codec: chosenCodec,
          width: chosen.width ?? width,
          height: chosen.height ?? height,
          bitrate: chosen.bitrate ?? bitrate,
          framerate: chosen.framerate ?? fps,
          avc: { format: "avc" },
        },
      };
    } catch {
      /* next candidate */
    }
  }

  return { ok: false, error: unsupportedAvcEncoderMessage(width, height, fps, tried), tried };
}
