import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { builtinScenes, createOfflineFeatureExtractor, waveformPeaks, type OfflineFeatureExtractor, type PcmBuffer } from "@ailexsi/visualz";
import {
  clampPlayhead,
  createEmptyProject,
  placeAudio,
  projectDurationMs,
  setScene,
  type Project,
} from "./model";
import { exportVisOnly } from "./export/vis-export";
import { ExportDialog } from "./ui/ExportDialog";
import { Preview } from "./ui/Preview";
import { Timeline } from "./ui/Timeline";
import { Toolbar } from "./ui/Toolbar";
import { Transport } from "./ui/Transport";

const SCENES = builtinScenes.map((s) => ({ id: s.id, name: s.name }));

export function App() {
  const [project, setProject] = useState<Project>(() => createEmptyProject());
  const [playing, setPlaying] = useState(false);
  const [pcm, setPcm] = useState<PcmBuffer | null>(null);
  const [status, setStatus] = useState("Import one audio file");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportW, setExportW] = useState(1280);
  const [exportH, setExportH] = useState(720);
  const [exportFps, setExportFps] = useState(30);
  const scenes = SCENES;
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const durationMs = projectDurationMs(project);
  const extractor = useMemo<OfflineFeatureExtractor | null>(
    () => (pcm ? createOfflineFeatureExtractor(pcm) : null),
    [pcm],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    setAudioEl(audio);
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = project.loop;
    audio.src = project.audio?.objectUrl ?? "";
  }, [project.audio?.objectUrl, project.loop]);

  const seek = useCallback((ms: number) => {
    const next = clampPlayhead(ms, projectDurationMs(project));
    setProject((p) => ({ ...p, playheadMs: next }));
    const audio = audioRef.current;
    if (audio && project.audio) audio.currentTime = next / 1000;
  }, [project]);

  const play = useCallback(async () => {
    if (!project.audio || !audioRef.current) {
      setStatus("Import audio first");
      return;
    }
    const audio = audioRef.current;
    if (audio.currentTime * 1000 >= projectDurationMs(project) - 10) {
      audio.currentTime = 0;
      setProject((p) => ({ ...p, playheadMs: 0 }));
    }
    try {
      await audio.play();
      setPlaying(true);
      setStatus(project.audio.name);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Play failed");
    }
  }, [project]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setProject((p) => ({ ...p, playheadMs: 0 }));
  }, []);

  useEffect(() => {
    if (!playing) return;
    const audio = audioRef.current;
    if (!audio) return;
    let raf = 0;
    const tick = () => {
      const ms = audio.currentTime * 1000;
      setProject((p) => ({ ...p, playheadMs: ms }));
      if (audio.ended && !audio.loop) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (playing) pause();
        else void play();
      } else if (e.code === "Home") {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, pause, stop, playing]);

  const importFile = useCallback(async (file: File) => {
    setStatus(`Decoding ${file.name}…`);
    setPlaying(false);
    audioRef.current?.pause();
    const url = URL.createObjectURL(file);
    const ctx = new AudioContext();
    try {
      const raw = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(raw.slice(0));
      const peaks = waveformPeaks(decoded.getChannelData(0), 240);
      const durationMs = (decoded.length / decoded.sampleRate) * 1000;
      setPcm(decoded);
      setProject((p) =>
        placeAudio(p, {
          name: file.name,
          durationMs,
          mimeType: file.type || "audio/*",
          objectUrl: url,
          peaks,
        }),
      );
      setStatus(`${file.name} · visuals generated`);
    } catch (err) {
      URL.revokeObjectURL(url);
      setStatus(err instanceof Error ? err.message : "Could not decode audio");
    } finally {
      await ctx.close().catch(() => undefined);
    }
  }, []);

  const onExport = useCallback(async () => {
    if (!project.vis) {
      setExportError("Import audio first — nothing to export");
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportProgress("Starting encoder…");
    try {
      const result = await exportVisOnly({
        width: exportW,
        height: exportH,
        fps: exportFps,
        durationMs: project.vis.durationMs,
        sceneId: project.sceneId,
        pcm,
        onProgress: (ratio, frame, total) => {
          setExportProgress(`${frame}/${total} frames (${Math.round(ratio * 100)}%)`);
        },
      });
      const copy = new Uint8Array(result.bytes.byteLength);
      copy.set(result.bytes);
      const blob = new Blob([copy.buffer], { type: "video/mp4" });
      const name = `${project.name || "visualz"}.mp4`;
      const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> })
        .showSaveFilePicker;
      if (typeof picker === "function") {
        const handle = await picker({
          suggestedName: name,
          types: [{ description: "MP4", accept: { "video/mp4": [".mp4"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setExportProgress(`Fertig · ${result.frames} frames · ${result.codec} · ${result.bytes.byteLength} bytes`);
      setStatus(`Exported ${name}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [project, pcm, exportW, exportH, exportFps]);

  return (
    <div className="app">
      <Toolbar
        projectName={project.name}
        sceneId={project.sceneId}
        scenes={scenes}
        exporting={exporting}
        canExport={!!project.vis}
        onImport={() => fileRef.current?.click()}
        onExport={() => { setExportOpen(true); setExportError(null); }}
        onScene={(id) => setProject((p) => setScene(p, id))}
      />
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
      <div className="stage">
        <Preview
          project={project}
          playing={playing}
          audioEl={audioEl}
          extractor={extractor}
        />
        <Transport
          project={project}
          playing={playing}
          durationMs={durationMs}
          onPlay={() => void play()}
          onPause={pause}
          onStop={stop}
          onStep={(d) => seek(project.playheadMs + d)}
          onToggleLoop={() => setProject((p) => ({ ...p, loop: !p.loop }))}
          onSeek={seek}
        />
        <Timeline
          project={project}
          durationMs={durationMs}
          onSeek={seek}
          onZoom={(z) => setProject((p) => ({ ...p, zoomPxPerSec: z }))}
        />
      </div>
      <footer className="status" data-testid="status">{status}</footer>
      <ExportDialog
        open={exportOpen}
        busy={exporting}
        progress={exportProgress}
        error={exportError}
        width={exportW}
        height={exportH}
        fps={exportFps}
        onWidth={setExportW}
        onHeight={setExportH}
        onFps={setExportFps}
        onExport={() => void onExport()}
        onClose={() => { if (!exporting) setExportOpen(false); }}
      />
    </div>
  );
}
