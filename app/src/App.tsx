import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  builtinScenes,
  catalogRendererIds,
  createOfflineFeatureExtractor,
  getCatalogEntry,
  waveformPeaks,
  type OfflineFeatureExtractor,
  type PcmBuffer,
  type SceneCatalogEntry,
  type VisFamilyId,
} from "@ailexsi/visualz";
import {
  addMarker,
  applyStyle,
  clampPlayhead,
  clearInOut,
  clipAtTime,
  clipEndMs,
  createEmptyProject,
  cycleScene,
  extractRange,
  featureTimeAt,
  fitZoomPxPerSec,
  formatExportRangeLine,
  liftRange,
  loopRangeOf,
  paramsAt,
  resolveExportRange,
  placeAudio,
  playbackBounds,
  projectDurationMs,
  sceneAt,
  selectVis,
  setInPoint,
  setLoopHere,
  setLoopRange,
  setOutPoint,
  setScene,
  setVisQuelle,
  toggleLoop,
  sourceTimeAt,
  splitAtPlayhead,
  trimEdgeAt,
  trimInToPlayhead,
  trimOutToPlayhead,
  type Project,
} from "./model";
import { deserializeProject, loadRecents, pushRecent, serializeProject, VISUALZ_EXT, type RecentFile } from "./persist";
import { cycleProductionScreen, type ProductionScreen } from "./screens";
import { exportVisOnly } from "./export/vis-export";
import { clampTimelineHeight, defaultTimelineHeight } from "./layout";
import { isTauriRuntime } from "./tauri-runtime";
import { pickTauriOpenPath, pickTauriSavePath, readTauriFileText, writeTauriFile } from "./tauri-save";
import { Cutter } from "./ui/Cutter";
import { ExportDialog } from "./ui/ExportDialog";
import { Inspector } from "./ui/Inspector";
import { Mixer } from "./ui/Mixer";
import { Preview } from "./ui/Preview";
import { Timeline } from "./ui/Timeline";
import { Toolbar } from "./ui/Toolbar";
import { Transport } from "./ui/Transport";

const SCENES = builtinScenes.map((s) => ({ id: s.id, name: s.name }));
const SCENE_IDS = catalogRendererIds();

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
  const [exportW, setExportW] = useState(1920);
  const [exportH, setExportH] = useState(1080);
  const [exportFps, setExportFps] = useState(30);
  const [winH, setWinH] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const [timelineUserH, setTimelineUserH] = useState<number | null>(null);
  const scenes = SCENES;
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [fileOpen, setFileOpen] = useState(false);
  const [visOpen, setVisOpen] = useState(false);
  const [visFamily, setVisFamily] = useState<VisFamilyId | null>("Kaleido Loop");
  const [recents, setRecents] = useState<RecentFile[]>(() => loadRecents());
  const [a1Peak, setA1Peak] = useState(0);
  const [masterPeak, setMasterPeak] = useState(0);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const lastProjectPath = useRef<string | null>(null);
  const lastProjectHandle = useRef<{
    createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
  } | null>(null);

  const durationMs = projectDurationMs(project);
  const timelineH = timelineUserH ?? defaultTimelineHeight(winH);
  const exportRange = resolveExportRange(project);

  useEffect(() => {
    const onResize = () => setWinH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
    const bounds = playbackBounds(p);
    let start = p.playheadMs;
    if (p.loop && (start < bounds.startMs || start >= bounds.endMs - 10)) start = bounds.startMs;
    else if (start >= bounds.endMs - 10) start = bounds.startMs;
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
    setProject((p) => ({ ...p, playheadMs: playbackBounds(p).startMs }));
  }, []);

  useEffect(() => {
    if (!playing) return;
    const audio = audioRef.current;
    if (!audio) return;
    let raf = 0;
    const tick = () => {
      const p = projectRef.current;
      const clip = clipAtTime(p.audio, p.playheadMs);
      const bounds = playbackBounds(p);
      const loopStart = bounds.startMs;
      const loopEnd = bounds.endMs;

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

  const remember = useCallback((name: string, json: string) => {
    setRecents(pushRecent(name.endsWith(".json") ? name : `${name}${VISUALZ_EXT}`, json));
  }, []);

  const applyLoaded = useCallback((p: Project, label: string) => {
    setPlaying(false);
    audioRef.current?.pause();
    setPcm(null);
    setProject(p);
    setStatus(p.source && !p.source.objectUrl ? `${label} — Audio erneut importieren` : label);
  }, []);

  const saveJsonToPath = useCallback(async (json: string, name: string, asNew: boolean) => {
    const fileName = name.endsWith(".json") ? name : `${name}${VISUALZ_EXT}`;
    if (isTauriRuntime()) {
      let path = !asNew ? lastProjectPath.current : null;
      if (!path) {
        path = await pickTauriSavePath(fileName, [{ name: "Visualz", extensions: ["json"] }]);
        if (!path) return;
      }
      lastProjectPath.current = path;
      await writeTauriFile(path, new TextEncoder().encode(json));
      remember(fileName, json);
      setStatus(`Gespeichert · ${path}`);
      return;
    }
    type SaveHandle = { createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> };
    let handle = !asNew ? lastProjectHandle.current : null;
    const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<SaveHandle> }).showSaveFilePicker;
    if (!handle && typeof picker === "function") {
      try {
        handle = await picker({
          suggestedName: fileName,
          types: [{ description: "Visualz", accept: { "application/json": [".json"] } }],
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (handle) {
      lastProjectHandle.current = handle;
      const blob = new Blob([json], { type: "application/json" });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      remember(fileName, json);
      setStatus(`Gespeichert · ${fileName}`);
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    remember(fileName, json);
    setStatus(`Gespeichert · ${fileName}`);
  }, [remember]);

  const saveProject = useCallback(async (asNew: boolean) => {
    const p = projectRef.current;
    const json = serializeProject(p);
    await saveJsonToPath(json, p.name || "untitled", asNew);
  }, [saveJsonToPath]);

  const openProjectText = useCallback((text: string, label: string) => {
    try {
      const loaded = deserializeProject(text);
      applyLoaded(loaded, `Laden · ${label}`);
      remember(label, serializeProject(loaded));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Laden failed");
    }
  }, [applyLoaded, remember]);

  const openProject = useCallback(async () => {
    if (isTauriRuntime()) {
      const path = await pickTauriOpenPath([{ name: "Visualz", extensions: ["json"] }]);
      if (!path) return;
      lastProjectPath.current = path;
      openProjectText(await readTauriFileText(path), path);
      return;
    }
    const picker = (window as unknown as { showOpenFilePicker?: (opts: unknown) => Promise<Array<{ getFile: () => Promise<File> }>> }).showOpenFilePicker;
    if (typeof picker === "function") {
      try {
        const [h] = await picker({ types: [{ description: "Visualz", accept: { "application/json": [".json"] } }] });
        if (!h) return;
        openProjectText(await (await h.getFile()).text(), "project");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    projectFileRef.current?.click();
  }, [openProjectText]);

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        lastProjectPath.current = null;
        lastProjectHandle.current = null;
        applyLoaded(createEmptyProject(), "Neu");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void openProject();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (playing) pause();
        else void play();
      } else if (e.code === "Home" && !e.shiftKey) {
        e.preventDefault();
        stop();
      } else if (e.code === "Tab") {
        e.preventDefault();
        setScreen((s) => cycleProductionScreen(s, e.shiftKey ? -1 : 1));
      } else if (e.key === "Home" && e.shiftKey) {
        e.preventDefault();
        const inn = projectRef.current.inPointMs;
        if (inn != null) seek(inn);
      } else if (e.key === "End" && e.shiftKey) {
        e.preventDefault();
        const out = projectRef.current.outPointMs;
        if (out != null) seek(out);
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setProject((p) => setInPoint(p));
        setStatus("IN");
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        setProject((p) => {
          const next = setOutPoint(p);
          setStatus(loopRangeOf(next) ? "Loop range set" : "OUT");
          return next;
        });
      } else if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        setProject((p) => clearInOut(p));
        setStatus("IN/OUT cleared");
      } else if (e.key === "s" || e.key === "S" || e.key === "v" || e.key === "V") {
        e.preventDefault();
        applyCut((p) => splitAtPlayhead(p), "Split");
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setProject((p) => ({ ...p, zoomPxPerSec: fitZoomPxPerSec(projectDurationMs(p)), scrollMs: 0 }));
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setProject((p) => addMarker(p));
        setStatus("Marker");
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
      const range = resolveExportRange(snapshot);
      const result = await exportVisOnly({
        width: exportW,
        height: exportH,
        fps: exportFps,
        startMs: range.startMs,
        durationMs: range.durationMs,
        sceneId: sceneAt(snapshot, range.startMs),
        sceneAt: (t) => sceneAt(snapshot, t),
        paramsAt: (t) => paramsAt(snapshot, t),
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
  const inspectClip =
    project.vis.find((c) => c.id === project.selectedVisId) ?? clipAtTime(project.vis, project.playheadMs);
  const styleId = inspectClip?.styleId ?? project.styleId ?? activeScene;

  const pickStyle = useCallback((entry: SceneCatalogEntry) => {
    setProject((p) =>
      applyStyle(p, {
        id: entry.id,
        renderer: entry.renderer,
        params: entry.params as Record<string, number | string | boolean> | undefined,
      }),
    );
    setStatus(`Style · ${entry.displayName}`);
  }, []);

  const onLevels = useCallback((a1: number, master: number) => {
    setA1Peak(a1);
    setMasterPeak(master);
  }, []);

  useEffect(() => {
    if (!fileOpen && !visOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".menu-wrap")) return;
      setFileOpen(false);
      setVisOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [fileOpen, visOpen]);

  return (
    <div className={`app screen-${screen}`} data-screen={screen} translate="no">
      <Toolbar
        projectName={project.name}
        sceneId={activeScene}
        styleId={styleId}
        scenes={scenes}
        screen={screen}
        exporting={exporting}
        canExport={project.vis.length > 0}
        fileOpen={fileOpen}
        visOpen={visOpen}
        visFamily={visFamily}
        recents={recents}
        onToggleFile={() => {
          setFileOpen((o) => !o);
          setVisOpen(false);
        }}
        onToggleVis={() => {
          setVisOpen((o) => !o);
          setFileOpen(false);
        }}
        onVisFamily={setVisFamily}
        onPickStyle={pickStyle}
        onNew={() => {
          lastProjectPath.current = null;
          lastProjectHandle.current = null;
          applyLoaded(createEmptyProject(), "Neu");
          setFileOpen(false);
        }}
        onOpen={() => {
          setFileOpen(false);
          void openProject();
        }}
        onSave={() => {
          setFileOpen(false);
          void saveProject(false);
        }}
        onSaveAs={() => {
          setFileOpen(false);
          void saveProject(true);
        }}
        onOpenRecent={(r) => {
          setFileOpen(false);
          openProjectText(r.json, r.name);
        }}
        onImport={() => fileRef.current?.click()}
        onExport={() => { setExportOpen(true); setExportError(null); setFileOpen(false); }}
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
      <input
        ref={projectFileRef}
        type="file"
        accept=".json,.visualz.json,application/json"
        hidden
        data-testid="project-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void f.text().then((text) => openProjectText(text, f.name));
        }}
      />
      <div className="workspace">
        <Inspector
          project={project}
          clip={inspectClip}
          onStyle={pickStyle}
          onQuelle={(quelle) => setProject((p) => setVisQuelle(p, quelle))}
        />
        <div className="stage" style={{ ["--timeline-h" as string]: `${timelineH}px` }}>
        <Preview
          project={project}
          playing={playing}
          audioEl={audioEl}
          extractor={extractor}
          mixer={project.mixer}
          onLevels={onLevels}
        />
        {screen === "cutter" ? (
          <Cutter
            project={project}
            onSeek={seek}
            onIn={() => { setProject((p) => setInPoint(p)); setStatus("IN"); }}
            onOut={() => {
              setProject((p) => {
                const next = setOutPoint(p);
                setStatus(loopRangeOf(next) ? "Loop range set" : "OUT");
                return next;
              });
            }}
            onClear={() => { setProject((p) => clearInOut(p)); setStatus("IN/OUT cleared"); }}
            onSetLoop={() => { setProject((p) => setLoopHere(p)); setStatus("Loop range set"); }}
            onToggleLoop={() => setProject((p) => toggleLoop(p))}
            onSplit={() => applyCut((p) => splitAtPlayhead(p), "Split")}
            onTrimIn={(ripple) => applyCut((p) => trimInToPlayhead(p, ripple), ripple ? "Ripple trim IN" : "Trim IN")}
            onTrimOut={(ripple) => applyCut((p) => trimOutToPlayhead(p, ripple), ripple ? "Ripple trim OUT" : "Trim OUT")}
            onExtract={() => applyCut((p) => extractRange(p), "Extract")}
            onLift={() => applyCut((p) => liftRange(p), "Lift")}
          />
        ) : null}
        <div
          className="stage-split"
          data-testid="timeline-split"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
          onMouseDown={(e) => {
            e.preventDefault();
            const originY = e.clientY;
            const originH = timelineH;
            const move = (ev: MouseEvent) => {
              setTimelineUserH(clampTimelineHeight(originH - (ev.clientY - originY)));
            };
            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        />
        <Transport
          project={project}
          playing={playing}
          durationMs={durationMs}
          onPlay={() => void play()}
          onPause={pause}
          onStop={stop}
          onStep={(d) => seek(project.playheadMs + d)}
          onToggleLoop={() => setProject((p) => toggleLoop(p))}
          onSetLoop={() => { setProject((p) => setLoopHere(p)); setStatus("Loop range set"); }}
          onSeek={seek}
          onIn={() => { setProject((p) => setInPoint(p)); setStatus("IN"); }}
          onOut={() => {
            setProject((p) => {
              const next = setOutPoint(p);
              setStatus(loopRangeOf(next) ? "Loop range set" : "OUT");
              return next;
            });
          }}
          onClear={() => { setProject((p) => clearInOut(p)); setStatus("IN/OUT cleared"); }}
          onSplit={() => applyCut((p) => splitAtPlayhead(p), "Split")}
        />
        <Timeline
          project={project}
          durationMs={durationMs}
          cutter={screen === "cutter"}
          onSeek={seek}
          onZoom={(z) => setProject((p) => ({ ...p, zoomPxPerSec: z }))}
          onScroll={(ms) => setProject((p) => ({ ...p, scrollMs: Math.max(0, ms) }))}
          onFit={() => setProject((p) => ({ ...p, zoomPxPerSec: fitZoomPxPerSec(projectDurationMs(p)), scrollMs: 0 }))}
          onMarker={() => {
            setProject((p) => addMarker(p));
            setStatus("Marker");
          }}
          onSelectVis={(id) => setProject((p) => selectVis(p, id))}
          onVisStyle={(id) => {
            setProject((p) => selectVis(p, id));
            setVisOpen(true);
            setFileOpen(false);
            const entry = getCatalogEntry(projectRef.current.vis.find((c) => c.id === id)?.styleId ?? "");
            if (entry) setVisFamily(entry.family);
          }}
          onVisQuelle={(id) => setProject((p) => setVisQuelle(selectVis(p, id), "A1"))}
          onTrimEdge={(edge, ms, ripple) => {
            applyCut((p) => trimEdgeAt(p, edge, ms, ripple), ripple ? "Ripple trim" : "Trim");
          }}
          onLoopIn={(ms) => setProject((p) => setInPoint(p, ms))}
          onLoopOut={(ms) => setProject((p) => setOutPoint(p, ms))}
          onLoopRange={(a, b) => setProject((p) => setLoopRange(p, a, b))}
          onRulerMark={(ms) => {
            setProject((p) => {
              if (loopRangeOf(p)) {
                setStatus("IN");
                return setInPoint({ ...p, inPointMs: null, outPointMs: null, playheadMs: ms }, ms);
              }
              if (p.inPointMs == null) {
                setStatus("IN");
                return setInPoint({ ...p, playheadMs: ms }, ms);
              }
              const next = setOutPoint({ ...p, playheadMs: ms }, ms);
              setStatus(loopRangeOf(next) ? "Loop range set" : "OUT");
              return next;
            });
          }}
        />
        </div>
        <Mixer
          mixer={project.mixer}
          a1Peak={a1Peak}
          masterPeak={masterPeak}
          onChange={(patch) => setProject((p) => ({ ...p, mixer: { ...p.mixer, ...patch } }))}
        />
      </div>
      <footer className="status" data-testid="status">{status}</footer>
      <ExportDialog
        open={exportOpen}
        busy={exporting}
        progress={exportProgress}
        error={exportError}
        rangeLine={formatExportRangeLine(exportRange, exportFps)}
        warning={exportRange.warning}
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
