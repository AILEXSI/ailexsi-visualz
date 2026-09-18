/** 1 visual track + 1 audio track. No V1/V2, no mixer collection. */

export const FRAME_MS = 1000 / 30;
export const DEFAULT_SCENE_ID = "resonance-wave";

export interface AudioClip {
  id: string;
  name: string;
  durationMs: number;
  startMs: number;
  mimeType: string;
  objectUrl: string;
  peaks: number[];
}

export interface VisClip {
  id: string;
  sceneId: string;
  startMs: number;
  durationMs: number;
}

export interface Project {
  name: string;
  playheadMs: number;
  loop: boolean;
  zoomPxPerSec: number;
  scrollMs: number;
  sceneId: string;
  audio: AudioClip | null;
  vis: VisClip | null;
}

export function createEmptyProject(name = "Untitled Visualz"): Project {
  return {
    name,
    playheadMs: 0,
    loop: false,
    zoomPxPerSec: 80,
    scrollMs: 0,
    sceneId: DEFAULT_SCENE_ID,
    audio: null,
    vis: null,
  };
}

export function projectDurationMs(project: Project): number {
  const a = project.audio;
  if (!a) return 0;
  return Math.max(0, a.startMs + a.durationMs);
}

export function clampPlayhead(ms: number, durationMs: number): number {
  if (!Number.isFinite(ms) || durationMs <= 0) return 0;
  return Math.max(0, Math.min(durationMs, ms));
}

export function formatTimecode(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((clamped % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Import audio → one audio clip + generated vis span on the single vis track. */
export function placeAudio(
  project: Project,
  audio: Omit<AudioClip, "id" | "startMs"> & { startMs?: number },
): Project {
  const startMs = audio.startMs ?? 0;
  const clip: AudioClip = {
    id: newId("aud"),
    name: audio.name,
    durationMs: Math.max(0, audio.durationMs),
    startMs,
    mimeType: audio.mimeType,
    objectUrl: audio.objectUrl,
    peaks: audio.peaks,
  };
  const vis: VisClip = {
    id: newId("vis"),
    sceneId: project.sceneId || DEFAULT_SCENE_ID,
    startMs,
    durationMs: clip.durationMs,
  };
  return {
    ...project,
    audio: clip,
    vis,
    playheadMs: startMs,
    name: project.audio ? project.name : stripExt(audio.name),
  };
}

export function setScene(project: Project, sceneId: string): Project {
  return {
    ...project,
    sceneId,
    vis: project.vis ? { ...project.vis, sceneId } : project.vis,
  };
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "") || name;
}
