import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { builtinScenes, createOfflineFeatureExtractor, waveformPeaks, type OfflineFeatureExtractor, type PcmBuffer } from "@ailexsi/visualz";
import {
  clampPlayhead,
  clearInOut,
  clipAtTime,
  clipEndMs,
  createEmptyProject,
  cycleScene,
  extractRange,
  featureTimeAt,
  liftRange,
  placeAudio,
  projectDurationMs,
  sceneAt,
  setInPoint,
  setOutPoint,
  setScene,
  sourceTimeAt,
  splitAtPlayhead,
  trimEdgeAt,
  trimInToPlayhead,
  trimOutToPlayhead,
  type Project,
} from "./model";
import { cycleProductionScreen, type ProductionScreen } from "./screens";
import { exportVisOnly } from "./export/vis-export";
import { isTauriRuntime } from "./tauri-runtime";
import { pickTauriSavePath, writeTauriFile } from "./tauri-save";
import { Cutter } from "./ui/Cutter";
import { ExportDialog } from "./ui/ExportDialog";
import { Preview } from "./ui/Preview";
import { Timeline } from "./ui/Timeline";
import { Toolbar } from "./ui/Toolbar";
import { Transport } from "./ui/Transport";

const SCENES = builtinScenes.map((s) => ({ id: s.id, name: s.name }));
const SCENE_IDS = SCENES.map((s) => s.id);

function nextClipAfter<T extends { startMs: number }>(clips: T[], fromStartMs: number): T | null {
  const later = clips.filter((c) => c.startMs >= fromStartMs - 0.001).sort((a, b) => a.startMs - b.startMs);
  return later[0] ?? null;
}

export function App() {
  const [project, setProject] = useState<Project>(() => createEmptyProject());
  const [screen, setScreen] = useState<ProductionScreen>("arrange");
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
  const projectRef = useRef(project);
  projectRef.current = project;
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
    audio.loop = false;
    audio.src = project.source?.objectUrl ?? "";
  }, [project.source?.objectUrl]);

  const syncAudio = useCallback((ms: number, p: Project) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clip = clipAtTime(p.audio, ms);
    if (!clip) {
      audio.pause();
      return;
    }
    const src = sourceTimeAt(clip, ms) / 1000;
    if (Math.abs(audio.currentTime - src) > 0.04) audio.currentTime = src;
  }, []);

  const seek = useCallback((ms: number) => {
    const p = projectRef.current;
    const next = clampPlayhead(ms, projectDurationMs(p));
    setProject((cur) => ({ ...cur, playheadMs: next }));
    syncAudio(next, { ...p, playheadMs: next });
  }, [syncAudio]);

  const play = useCallback(async () => {
    const p = projectRef.current;
    if (!p.source || !audioRef.current) {
      setStatus("Import audio first");
      return;
    }
    const audio = audioRef.current;
    let start = p.playheadMs;
    if (start >= projectDurationMs(p) - 10) start = 0;
    const clip = clipAtTime(p.audio, start) ?? nextClipAfter(p.audio, start);
    if (!clip) {
      setStatus("Nothing to play — timeline is empty");
      return;
    }
    if (clip.startMs > start) start = clip.startMs;
    setProject((cur) => ({ ...cur, playheadMs: start }));
    audio.currentTime = sourceTimeAt(clip, start) / 1000;
    try {
      await audio.play();
      setPlaying(true);
      setStatus(p.source.name);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Play failed");
    }
  }, []);

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
      const p = projectRef.current;
      const clip = clipAtTime(p.audio, p.playheadMs);
      const loopStart = p.loop && p.inPointMs != null && p.outPointMs != null && p.outPointMs > p.inPointMs
        ? p.inPointMs
        : 0;
      const loopEnd = p.loop && p.inPointMs != null && p.outPointMs != null && p.outPointMs > p.inPointMs
        ? p.outPointMs
        : projectDurationMs(p);

      if (!clip) {
        const nxt = nextClipAfter(p.audio, p.playheadMs + 0.5);
        if (nxt && nxt.startMs < loopEnd) {
          audio.currentTime = nxt.sourceInMs / 1000;
          if (audio.paused) void audio.play().catch(() => undefined);
          setProject((cur) => ({ ...cur, playheadMs: nxt.startMs }));
        } else if (p.loop) {
          seek(loopStart);
          void audio.play().catch(() => undefined);
        } else {
          audio.pause();
          setPlaying(false);
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const src = audio.currentTime * 1000;
      if (src >= clip.sourceOutMs - 12 || audio.ended) {
        const nxt = nextClipAfter(p.audio, clipEndMs(clip) + 0.5);
        if (nxt && clipEndMs(clip) < loopEnd - 1) {
          audio.currentTime = nxt.sourceInMs / 1000;
          if (audio.paused) void audio.play().catch(() => undefined);
          setProject((cur) => ({ ...cur, playheadMs: nxt.startMs }));
        } else if (p.loop) {
          const restart = clipAtTime(p.audio, loopStart) ?? nextClipAfter(p.audio, loopStart);
          if (restart) {
            audio.currentTime = sourceTimeAt(restart, Math.max(loopStart, restart.startMs)) / 1000;
            if (audio.paused) void audio.play().catch(() => undefined);
            setProject((cur) => ({ ...cur, playheadMs: Math.max(loopStart, restart.startMs) }));
          } else {
            setPlaying(false);
          }
        } else {
          audio.pause();
          setPlaying(false);
          setProject((cur) => ({ ...cur, playheadMs: projectDurationMs(cur) }));
        }
      } else {
        const mapped = clip.startMs + ((src - clip.sourceInMs) / Math.max(1, clip.sourceOutMs - clip.sourceInMs)) * clip.durationMs;
        if (p.loop && mapped >= loopEnd - 8) {
          const restart = clipAtTime(p.audio, loopStart) ?? nextClipAfter(p.audio, loopStart);
          if (restart) {
            audio.currentTime = sourceTimeAt(restart, Math.max(loopStart, restart.startMs)) / 1000;
            setProject((cur) => ({ ...cur, playheadMs: Math.max(loopStart, restart.startMs) }));
          }
        } else {
          setProject((cur) => ({ ...cur, playheadMs: mapped }));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [playing, seek]);

  const applyCut = useCallback((fn: (p: Project) => { project: Project; error?: string }, ok: string) => {
    setProject((p) => {
      const result = fn(p);
      if (result.error) setStatus(result.error);
      else setStatus(ok);
      return result.project;
    });
  }, []);

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
      } else if (e.code === "Tab") {
        e.preventDefault();
        setScreen((s) => cycleProductionScreen(s, e.shiftKey ? -1 : 1));
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setProject((p) => setInPoint(p));
        setStatus("IN");
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        setProject((p) => setOutPoint(p));
        setStatus("OUT");
      } else if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        setProject((p) => clearInOut(p));
        setStatus("IN/OUT cleared");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        applyCut((p) => splitAtPlayhead(p), "Split");
      } else if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        applyCut((p) => trimInToPlayhead(p, true), "Ripple trim IN");
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        applyCut((p) => trimOutToPlayhead(p, e.altKey), e.altKey ? "Ripple trim OUT" : "Trim OUT");
      } else if (e.key === "'") {
        e.preventDefault();
        applyCut((p) => extractRange(p), "Extract");
      } else if (e.key === ";") {
        e.preventDefault();
        applyCut((p) => liftRange(p), "Lift");
      } else if (e.key === "[" || e.key === "{") {
        e.preventDefault();
        setProject((p) => cycleScene(p, SCENE_IDS, -1));
      } else if (e.key === "]" || e.key === "}") {
        e.preventDefault();
        setProject((p) => cycleScene(p, SCENE_IDS, 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, pause, stop, playing, applyCut]);

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
    if (!project.vis.length) {
      setExportError("Import audio first — nothing to export");
      return;
    }
    const name = `${project.name || "visualz"}.mp4`;
    type SaveHandle = { createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> };
    let handle: SaveHandle | null = null;
    let tauriPath: string | null = null;
    if (isTauriRuntime()) {
      tauriPath = await pickTauriSavePath(name);
      if (!tauriPath) return;
    } else {
      const picker = (
        window as unknown as {
          showSaveFilePicker?: (opts: unknown) => Promise<SaveHandle>;
        }
      ).showSaveFilePicker;
      if (typeof picker === "function") {
        try {
          handle = await picker({
            suggestedName: name,
            types: [{ description: "MP4", accept: { "video/mp4": [".mp4"] } }],
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          handle = null;
        }
      }
    }

    setExporting(true);
    setExportError(null);
    setExportProgress("Starting encoder…");
    try {
      const snapshot = project;
      const result = await exportVisOnly({
        width: exportW,
        height: exportH,
        fps: exportFps,
        durationMs: projectDurationMs(snapshot),
        sceneId: sceneAt(snapshot, 0),
        sceneAt: (t) => sceneAt(snapshot, t),
        featureTimeAt: (t) => featureTimeAt(snapshot, t),
        pcm,
        onProgress: (ratio, frame, total) => {
          setExportProgress(`${frame}/${total} frames (${Math.round(ratio * 100)}%)`);
        },
      });
      const copy = new Uint8Array(result.bytes.byteLength);
      copy.set(result.bytes);
      if (tauriPath) {
        await writeTauriFile(tauriPath, copy);
      } else if (handle) {
        const blob = new Blob([copy.buffer], { type: "video/mp4" });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const blob = new Blob([copy.buffer], { type: "video/mp4" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
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

  const activeScene = sceneAt(project, project.playheadMs);

  return (
    <div className={`app screen-${screen}`} data-screen={screen} translate="no">
      <Toolbar
        projectName={project.name}
        sceneId={activeScene}
        scenes={scenes}
        screen={screen}
        exporting={exporting}
        canExport={project.vis.length > 0}
        onImport={() => fileRef.current?.click()}
        onExport={() => { setExportOpen(true); setExportError(null); }}
        onScene={(id) => setProject((p) => setScene(p, id))}
        onCycleScene={(d) => setProject((p) => cycleScene(p, SCENE_IDS, d))}
        onSelectScreen={setScreen}
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
        {screen === "cutter" ? (
          <Cutter
            project={project}
            onSeek={seek}
            onIn={() => { setProject((p) => setInPoint(p)); setStatus("IN"); }}
            onOut={() => { setProject((p) => setOutPoint(p)); setStatus("OUT"); }}
            onClear={() => { setProject((p) => clearInOut(p)); setStatus("IN/OUT cleared"); }}
            onSplit={() => applyCut((p) => splitAtPlayhead(p), "Split")}
            onTrimIn={(ripple) => applyCut((p) => trimInToPlayhead(p, ripple), ripple ? "Ripple trim IN" : "Trim IN")}
            onTrimOut={(ripple) => applyCut((p) => trimOutToPlayhead(p, ripple), ripple ? "Ripple trim OUT" : "Trim OUT")}
            onExtract={() => applyCut((p) => extractRange(p), "Extract")}
            onLift={() => applyCut((p) => liftRange(p), "Lift")}
          />
        ) : null}
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
          onIn={() => { setProject((p) => setInPoint(p)); setStatus("IN"); }}
          onOut={() => { setProject((p) => setOutPoint(p)); setStatus("OUT"); }}
          onSplit={() => applyCut((p) => splitAtPlayhead(p), "Split")}
        />
        <Timeline
          project={project}
          durationMs={durationMs}
          cutter={screen === "cutter"}
          onSeek={seek}
          onZoom={(z) => setProject((p) => ({ ...p, zoomPxPerSec: z }))}
          onTrimEdge={(edge, ms, ripple) => {
            applyCut((p) => trimEdgeAt(p, edge, ms, ripple), ripple ? "Ripple trim" : "Trim");
          }}
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
