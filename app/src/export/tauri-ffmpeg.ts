import { isTauriRuntime } from "../tauri-runtime";

export type TauriFfmpegMuxResult = {
  bytes: Uint8Array;
  command: string;
  probeJson: string;
  writtenPath?: string;
};

type InvokeMux = {
  command: string;
  probeJson: string;
  hasAudio: boolean;
  audioCodec?: string | null;
};

/**
 * Write vis-only temp + A1 range WAV, invoke the Tauri `ffmpeg_mux_vis_a1` command,
 * probe, then delete temps. Hard-fails if ffmpeg is missing or the mux has no audio.
 */
export async function muxVisA1WithFfmpeg(opts: {
  visBytes: Uint8Array;
  wavBytes: Uint8Array;
  outPath?: string;
}): Promise<TauriFfmpegMuxResult> {
  if (!isTauriRuntime()) {
    throw new Error("FAIL: ffmpeg mux is the Tauri/Windows primary path. Not a browser runtime.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const { tempDir, join } = await import("@tauri-apps/api/path");
  const fs = await import("@tauri-apps/plugin-fs");
  const dir = await tempDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const visPath = await join(dir, `visualz-vis-${id}.mp4`);
  const wavPath = await join(dir, `visualz-a1-${id}.wav`);
  const outPath = opts.outPath ?? (await join(dir, `visualz-mux-${id}.mp4`));
  const temps = [visPath, wavPath];
  if (!opts.outPath) temps.push(outPath);
  await invoke("allow_user_paths", { paths: [visPath, wavPath, outPath] });
  await fs.writeFile(visPath, opts.visBytes);
  await fs.writeFile(wavPath, opts.wavBytes);
  try {
    const muxed = await invoke<InvokeMux>("ffmpeg_mux_vis_a1", {
      visPath,
      wavPath,
      outPath,
    });
    console.log("[visualz-export] ffmpeg", muxed.command);
    if (!muxed.hasAudio) {
      throw new Error(
        `FAIL: Export MP4 has no audio stream (ffprobe). Silent vis-only is not a success. command: ${muxed.command}`,
      );
    }
    const bytes = await fs.readFile(outPath);
    return {
      bytes,
      command: muxed.command,
      probeJson: muxed.probeJson,
      writtenPath: opts.outPath ? outPath : undefined,
    };
  } finally {
    for (const p of temps) {
      await fs.remove(p).catch(() => undefined);
    }
  }
}
