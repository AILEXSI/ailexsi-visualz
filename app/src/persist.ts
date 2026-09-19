/** .visualz.json persist. Also reads a Resonance schemaVersion 5 VIS+A1 subset. */

import {
  createEmptyProject,
  createMixer,
  type AudioClip,
  type Marker,
  type MixerState,
  type Project,
  type VisClip,
} from "./model";

export const VISUALZ_KIND = "ailexsi-visualz";
export const VISUALZ_SCHEMA = 1;
export const VISUALZ_EXT = ".visualz.json";

export type VisualzFile = {
  kind: typeof VISUALZ_KIND;
  schemaVersion: typeof VISUALZ_SCHEMA;
  name: string;
  playheadMs: number;
  loop: boolean;
  zoomPxPerSec: number;
  scrollMs: number;
  sceneId: string;
  styleId?: string;
  inPointMs: number | null;
  outPointMs: number | null;
  audio: AudioClip[];
  vis: VisClip[];
  markers: Marker[];
  mixer: MixerState;
  source: {
    name: string;
    mimeType: string;
    sourceDurationMs: number;
    peaks: number[];
  } | null;
};

export function serializeProject(project: Project): string {
  const doc: VisualzFile = {
    kind: VISUALZ_KIND,
    schemaVersion: VISUALZ_SCHEMA,
    name: project.name,
    playheadMs: project.playheadMs,
    loop: project.loop,
    zoomPxPerSec: project.zoomPxPerSec,
    scrollMs: project.scrollMs,
    sceneId: project.sceneId,
    styleId: project.styleId,
    inPointMs: project.inPointMs,
    outPointMs: project.outPointMs,
    audio: project.audio,
    vis: project.vis,
    markers: project.markers,
    mixer: project.mixer,
    source: project.source
      ? {
          name: project.source.name,
          mimeType: project.source.mimeType,
          sourceDurationMs: project.source.sourceDurationMs,
          peaks: project.source.peaks,
        }
      : null,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function deserializeProject(text: string): Project {
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (raw && raw.kind === VISUALZ_KIND) return fromVisualz(raw);
  if (raw && Number(raw.schemaVersion) === 5) return fromResonanceSubset(raw);
  throw new Error("Unrecognized project file");
}

function fromVisualz(raw: Record<string, unknown>): Project {
  const base = createEmptyProject(String(raw.name ?? "Untitled Visualz"));
  const sourceRaw = raw.source as VisualzFile["source"] | null;
  return {
    ...base,
    name: String(raw.name ?? base.name),
    playheadMs: num(raw.playheadMs, 0),
    loop: Boolean(raw.loop),
    zoomPxPerSec: num(raw.zoomPxPerSec, 80),
    scrollMs: num(raw.scrollMs, 0),
    sceneId: String(raw.sceneId ?? base.sceneId),
    styleId: raw.styleId != null ? String(raw.styleId) : undefined,
    inPointMs: raw.inPointMs == null ? null : num(raw.inPointMs, 0),
    outPointMs: raw.outPointMs == null ? null : num(raw.outPointMs, 0),
    audio: Array.isArray(raw.audio) ? (raw.audio as AudioClip[]) : [],
    vis: Array.isArray(raw.vis) ? (raw.vis as VisClip[]) : [],
    markers: Array.isArray(raw.markers) ? (raw.markers as Marker[]) : [],
    mixer: { ...createMixer(), ...(raw.mixer as Partial<MixerState> | undefined) },
    selectedVisId: null,
    source: sourceRaw
      ? {
          name: sourceRaw.name,
          mimeType: sourceRaw.mimeType,
          sourceDurationMs: sourceRaw.sourceDurationMs,
          peaks: sourceRaw.peaks ?? [],
          objectUrl: "",
        }
      : null,
  };
}

/** Resonance 5.6 subset: visualizer.events → vis, A1 clips → audio, markers, master. */
function fromResonanceSubset(raw: Record<string, unknown>): Project {
  const base = createEmptyProject(String(raw.name ?? "Untitled Visualz"));
  const visualizer = (raw.visualizer ?? {}) as {
    sceneId?: string;
    events?: Array<{ id: string; sceneId: string; startMs: number; durationMs: number }>;
  };
  const clips = Array.isArray(raw.clips) ? (raw.clips as Array<Record<string, unknown>>) : [];
  const a1 = clips.filter((c) => c.trackId === "A1" || c.trackId == null);
  const assets = Array.isArray(raw.assets) ? (raw.assets as Array<Record<string, unknown>>) : [];
  const firstAsset = assets[0];
  const visEvents = visualizer.events ?? [];
  return {
    ...base,
    name: String(raw.name ?? base.name),
    playheadMs: num(raw.playheadMs, 0),
    loop: Boolean(raw.loop),
    zoomPxPerSec: num(raw.zoomPxPerSec, 80),
    scrollMs: num(raw.scrollMs, 0),
    sceneId: String(visualizer.sceneId ?? base.sceneId),
    inPointMs: raw.inPointMs == null ? null : num(raw.inPointMs, 0),
    outPointMs: raw.outPointMs == null ? null : num(raw.outPointMs, 0),
    audio: a1.map((c, i) => ({
      id: String(c.id ?? `aud_${i}`),
      name: String(firstAsset?.name ?? "A1"),
      startMs: num(c.startMs, 0),
      durationMs: num(c.durationMs, 0),
      sourceInMs: num(c.sourceInMs, 0),
      sourceOutMs: num(c.sourceOutMs, num(c.durationMs, 0)),
    })),
    vis: visEvents.map((e) => ({
      id: e.id,
      sceneId: e.sceneId,
      styleId: e.sceneId,
      quelle: "A1",
      startMs: e.startMs,
      durationMs: e.durationMs,
      sourceInMs: 0,
      sourceOutMs: e.durationMs,
    })),
    markers: Array.isArray(raw.markers) ? (raw.markers as Marker[]) : [],
    mixer: {
      ...createMixer(),
      masterVolume: num(raw.masterVolume, 1),
    },
    source: firstAsset
      ? {
          name: String(firstAsset.name ?? "audio"),
          mimeType: String(firstAsset.mimeType ?? "audio/*"),
          sourceDurationMs: num(firstAsset.durationMs, 0),
          peaks: [],
          objectUrl: "",
        }
      : null,
  };
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const RECENTS_KEY = "ailexsi.visualz.recents";
export const MAX_RECENTS = 8;

export type RecentFile = { name: string; at: string; json: string };

export function loadRecents(storage: Pick<Storage, "getItem"> | null = defaultStorage()): RecentFile[] {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(RECENTS_KEY) || "[]") as RecentFile[];
    return Array.isArray(raw) ? raw.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export function pushRecent(
  name: string,
  json: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
): RecentFile[] {
  if (!storage) return [];
  const next = [{ name, at: new Date().toISOString(), json }, ...loadRecents(storage).filter((r) => r.name !== name)].slice(
    0,
    MAX_RECENTS,
  );
  storage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
