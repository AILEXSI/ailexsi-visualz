/** 1 visual track + 1 audio track. Clips on those lanes may split. Mixer is A1 + Master only. */

export const FRAME_MS = 1000 / 30;
export const DEFAULT_SCENE_ID = "resonance-wave";
export const SPLIT_EDGE_GUARD_MS = 50;
export const MIN_CLIP_MS = 50;

export type ScreenId = "arrange" | "cutter";

export interface AudioSource {
  name: string;
  mimeType: string;
  objectUrl: string;
  peaks: number[];
  sourceDurationMs: number;
}

export interface AudioClip {
  id: string;
  name: string;
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  sourceOutMs: number;
}

export interface VisClip {
  id: string;
  sceneId: string;
  styleId?: string;
  quelle?: string;
  params?: Record<string, number | string | boolean>;
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  sourceOutMs: number;
}

export interface Marker {
  id: string;
  timeMs: number;
  label: string;
}

export interface MixerState {
  a1Muted: boolean;
  a1Solo: boolean;
  masterMuted: boolean;
  a1Volume: number;
  masterVolume: number;
}

export function createMixer(): MixerState {
  return { a1Muted: false, a1Solo: false, masterMuted: false, a1Volume: 1, masterVolume: 1 };
}

export interface Project {
  name: string;
  playheadMs: number;
  loop: boolean;
  zoomPxPerSec: number;
  scrollMs: number;
  sceneId: string;
  styleId?: string;
  inPointMs: number | null;
  outPointMs: number | null;
  source: AudioSource | null;
  audio: AudioClip[];
  vis: VisClip[];
  markers: Marker[];
  mixer: MixerState;
  selectedVisId: string | null;
}

export type TimedClip = {
  id: string;
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  sourceOutMs: number;
};

export function createEmptyProject(name = "Untitled Visualz"): Project {
  return {
    name,
    playheadMs: 0,
    loop: false,
    zoomPxPerSec: 80,
    scrollMs: 0,
    sceneId: DEFAULT_SCENE_ID,
    inPointMs: null,
    outPointMs: null,
    source: null,
    audio: [],
    vis: [],
    markers: [],
    mixer: createMixer(),
    selectedVisId: null,
  };
}

export function clipEndMs(clip: { startMs: number; durationMs: number }): number {
  return clip.startMs + clip.durationMs;
}

export function clipAtTime<T extends { startMs: number; durationMs: number }>(
  clips: readonly T[],
  timeMs: number,
): T | null {
  const hits = clips.filter((c) => timeMs >= c.startMs && timeMs < clipEndMs(c));
  if (hits.length) return hits[0] ?? null;
  const ends = clips.filter((c) => timeMs === clipEndMs(c));
  return ends[ends.length - 1] ?? null;
}

export function projectDurationMs(project: Project): number {
  let max = 0;
  for (const c of project.audio) max = Math.max(max, clipEndMs(c));
  for (const c of project.vis) max = Math.max(max, clipEndMs(c));
  return Math.max(0, max);
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

function snapMs(n: number): number {
  return Math.round(n);
}

function sourceWindow(clip: TimedClip): number {
  return Math.max(1, clip.sourceOutMs - clip.sourceInMs);
}

/** Source (file) time for a timeline position on this clip. */
export function sourceTimeAt(clip: TimedClip, timelineMs: number): number {
  const t = (timelineMs - clip.startMs) / Math.max(1, clip.durationMs);
  const u = Math.max(0, Math.min(1, t));
  return clip.sourceInMs + u * sourceWindow(clip);
}

/** Timeline position for a source time on this clip. */
export function timelineTimeAt(clip: TimedClip, sourceMs: number): number {
  const t = (sourceMs - clip.sourceInMs) / sourceWindow(clip);
  const u = Math.max(0, Math.min(1, t));
  return clip.startMs + u * clip.durationMs;
}

export function featureTimeAt(project: Project, timelineMs: number): number {
  const clip = clipAtTime(project.audio, timelineMs);
  return clip ? sourceTimeAt(clip, timelineMs) : timelineMs;
}

export function sceneAt(project: Project, timelineMs: number): string {
  const clip = clipAtTime(project.vis, timelineMs);
  return clip?.sceneId ?? project.sceneId;
}

export function paramsAt(
  project: Project,
  timelineMs: number,
): Record<string, number | string | boolean> | undefined {
  return clipAtTime(project.vis, timelineMs)?.params;
}

export function editRangeOf(project: Project): { inMs: number; outMs: number } | null {
  const inMs = project.inPointMs;
  const outMs = project.outPointMs;
  if (inMs == null || outMs == null || outMs <= inMs) return null;
  return { inMs, outMs };
}

/** IN/OUT window used as the loop region (Studio). */
export function loopRangeOf(project: Project): { inMs: number; outMs: number } | null {
  return editRangeOf(project);
}

export type ExportRangeKind = "loop" | "full";

export interface ExportRange {
  startMs: number;
  endMs: number;
  durationMs: number;
  kind: ExportRangeKind;
  warning?: string;
}

export function exportFrameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.round((Math.max(0, durationMs) / 1000) * fps));
}

export function visFileDurationSec(frames: number, fps: number): number {
  return frames / Math.max(1, fps);
}

/** Shared by preview loop bounds and Export MP4 (vis + A1). Does not invent a region. */
export function resolveExportRange(project: Project): ExportRange {
  const fullEnd = projectDurationMs(project);
  const region = loopRangeOf(project);
  if (project.loop && region) {
    const durationMs = Math.max(0, region.outMs - region.inMs);
    return { startMs: region.inMs, endMs: region.outMs, durationMs, kind: "loop" };
  }
  if (project.loop && !region) {
    return {
      startMs: 0,
      endMs: fullEnd,
      durationMs: fullEnd,
      kind: "full",
      warning: "Loop on but no IN/OUT region — exporting FULL. Set Loop to export a region.",
    };
  }
  return { startMs: 0, endMs: fullEnd, durationMs: fullEnd, kind: "full" };
}

export function formatExportRangeLine(range: ExportRange, fps: number): string {
  const frames = exportFrameCount(range.durationMs, fps);
  if (range.kind === "loop") {
    return `Range: LOOP ${formatTimecode(range.startMs)}–${formatTimecode(range.endMs)} · ${frames} frames`;
  }
  return `Range: FULL · ${frames} frames`;
}

/**
 * Transport window. Same resolve as export: Loop + IN/OUT → region; otherwise full.
 * Loop off plays 0 → timeline end; marks stay visible but do not stop play.
 */
export function playbackBounds(project: Project): { startMs: number; endMs: number } {
  const range = resolveExportRange(project);
  if (range.kind === "loop") {
    return { startMs: range.startMs, endMs: Math.max(range.startMs + FRAME_MS, range.endMs) };
  }
  return { startMs: 0, endMs: Math.max(0, range.endMs) };
}

export function toggleLoop(project: Project): Project {
  return { ...project, loop: !project.loop };
}

/** Set IN/OUT as a loop region and turn Loop on. */
export function setLoopRange(project: Project, aMs: number, bMs: number): Project {
  const a = Math.max(0, snapMs(aMs));
  const b = Math.max(0, snapMs(bMs));
  const inMs = Math.min(a, b);
  const outMs = Math.max(a, b);
  if (outMs <= inMs) {
    return { ...project, inPointMs: inMs, outPointMs: inMs + Math.round(FRAME_MS), loop: true };
  }
  return { ...project, inPointMs: inMs, outPointMs: outMs, loop: true };
}

/**
 * Operator "Loop setzen": enable loop on the current IN/OUT, or fill the
 * missing edge from the playhead / timeline so a region exists.
 */
export function setLoopHere(project: Project): Project {
  const range = loopRangeOf(project);
  if (range) return { ...project, loop: true };
  const dur = projectDurationMs(project);
  if (project.inPointMs != null) {
    const out = project.playheadMs > project.inPointMs ? project.playheadMs : Math.max(dur, project.inPointMs + FRAME_MS);
    return setLoopRange(project, project.inPointMs, out);
  }
  if (project.outPointMs != null) {
    const inn = project.playheadMs < project.outPointMs ? project.playheadMs : 0;
    return setLoopRange(project, inn, project.outPointMs);
  }
  if (dur <= 0) return { ...project, loop: true };
  if (project.playheadMs > 0 && project.playheadMs < dur) {
    return setLoopRange(project, project.playheadMs, dur);
  }
  return setLoopRange(project, 0, dur);
}

export function moveLoopRange(
  project: Project,
  deltaMs: number,
): { project: Project; error?: string } {
  const range = loopRangeOf(project);
  if (!range) return { project, error: "No loop range" };
  const span = range.outMs - range.inMs;
  const inMs = Math.max(0, snapMs(range.inMs + deltaMs));
  return { project: { ...project, inPointMs: inMs, outPointMs: inMs + span } };
}

function armLoopIfComplete(project: Project): Project {
  return loopRangeOf(project) ? { ...project, loop: true } : project;
}

export function editPointsOf(project: Project): number[] {
  const pts = new Set<number>([0, projectDurationMs(project)]);
  for (const c of project.audio) {
    pts.add(c.startMs);
    pts.add(clipEndMs(c));
  }
  for (const c of project.vis) {
    pts.add(c.startMs);
    pts.add(clipEndMs(c));
  }
  if (project.inPointMs != null) pts.add(project.inPointMs);
  if (project.outPointMs != null) pts.add(project.outPointMs);
  return [...pts].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

/** Import audio → one audio clip + generated vis span on the single vis track. */
export function placeAudio(
  project: Project,
  audio: {
    name: string;
    durationMs: number;
    mimeType: string;
    objectUrl: string;
    peaks: number[];
    startMs?: number;
  },
): Project {
  const startMs = snapMs(audio.startMs ?? 0);
  const durationMs = Math.max(0, snapMs(audio.durationMs));
  const source: AudioSource = {
    name: audio.name,
    mimeType: audio.mimeType,
    objectUrl: audio.objectUrl,
    peaks: audio.peaks,
    sourceDurationMs: durationMs,
  };
  const clip: AudioClip = {
    id: newId("aud"),
    name: audio.name,
    startMs,
    durationMs,
    sourceInMs: 0,
    sourceOutMs: durationMs,
  };
  const vis: VisClip = {
    id: newId("vis"),
    sceneId: project.sceneId || DEFAULT_SCENE_ID,
    styleId: project.styleId || project.sceneId || DEFAULT_SCENE_ID,
    quelle: "A1",
    startMs,
    durationMs,
    sourceInMs: 0,
    sourceOutMs: durationMs,
  };
  return {
    ...project,
    source,
    audio: [clip],
    vis: [vis],
    playheadMs: startMs,
    inPointMs: null,
    outPointMs: null,
    name: project.source ? project.name : stripExt(audio.name),
  };
}

function targetVis(project: Project): VisClip | null {
  if (project.selectedVisId) {
    return project.vis.find((c) => c.id === project.selectedVisId) ?? null;
  }
  return clipAtTime(project.vis, project.playheadMs);
}

/** Apply scene/style to the selected vis clip, else the clip under the playhead. */
export function setScene(
  project: Project,
  sceneId: string,
  extra?: { styleId?: string; params?: Record<string, number | string | boolean> },
): Project {
  const hit = targetVis(project);
  const styleId = extra?.styleId ?? sceneId;
  const patch = (c: VisClip): VisClip => ({
    ...c,
    sceneId,
    styleId,
    params: extra?.params ?? c.params,
    quelle: c.quelle ?? "A1",
  });
  let vis = project.vis;
  if (hit) vis = project.vis.map((c) => (c.id === hit.id ? patch(c) : c));
  else if (project.vis.length <= 1) vis = project.vis.map(patch);
  return { ...project, sceneId, styleId, vis, selectedVisId: hit?.id ?? project.selectedVisId };
}

export function applyStyle(
  project: Project,
  style: { id: string; renderer: string; params?: Record<string, number | string | boolean> },
): Project {
  return setScene(project, style.renderer, { styleId: style.id, params: style.params });
}

export function setVisQuelle(project: Project, quelle: string): Project {
  const hit = targetVis(project);
  if (!hit) return project;
  return {
    ...project,
    vis: project.vis.map((c) => (c.id === hit.id ? { ...c, quelle } : c)),
  };
}

export function selectVis(project: Project, id: string | null): Project {
  return { ...project, selectedVisId: id };
}

export function addMarker(project: Project, timeMs = project.playheadMs): Project {
  const n = project.markers.length + 1;
  return {
    ...project,
    markers: [...project.markers, { id: newId("mk"), timeMs: Math.max(0, snapMs(timeMs)), label: `M${n}` }],
  };
}

export function removeMarker(project: Project, id: string): Project {
  return { ...project, markers: project.markers.filter((m) => m.id !== id) };
}

export function fitZoomPxPerSec(durationMs: number, viewPx = 720): number {
  if (durationMs <= 0) return 80;
  const z = viewPx / (durationMs / 1000);
  return Math.max(20, Math.min(400, z));
}

export function effectiveGain(mixer: MixerState): number {
  if (mixer.masterMuted || mixer.a1Muted) return 0;
  return Math.max(0, Math.min(2, mixer.a1Volume * mixer.masterVolume));
}

export function cycleScene(project: Project, sceneIds: readonly string[], delta: number): Project {
  if (!sceneIds.length) return project;
  const hit = clipAtTime(project.vis, project.playheadMs);
  const current = hit?.sceneId ?? project.sceneId;
  const i = sceneIds.indexOf(current);
  const base = i < 0 ? 0 : i;
  const next = sceneIds[((base + delta) % sceneIds.length + sceneIds.length) % sceneIds.length]!;
  return setScene({ ...project, selectedVisId: hit?.id ?? null }, next);
}

export function setInPoint(project: Project, timeMs = project.playheadMs): Project {
  const t = Math.max(0, snapMs(timeMs));
  if (project.outPointMs != null && t > project.outPointMs) {
    return armLoopIfComplete({ ...project, inPointMs: project.outPointMs, outPointMs: t });
  }
  return armLoopIfComplete({ ...project, inPointMs: t });
}

export function setOutPoint(project: Project, timeMs = project.playheadMs): Project {
  const t = Math.max(0, snapMs(timeMs));
  if (project.inPointMs != null && t < project.inPointMs) {
    return armLoopIfComplete({ ...project, inPointMs: t, outPointMs: project.inPointMs });
  }
  return armLoopIfComplete({ ...project, outPointMs: t });
}

export function clearInOut(project: Project): Project {
  return { ...project, inPointMs: null, outPointMs: null };
}

function splitOne<T extends TimedClip>(
  clip: T,
  timeMs: number,
  newIdValue: string,
  edgeGuardMs: number,
): { left: T; right: T } | { error: string } {
  const offset = timeMs - clip.startMs;
  if (offset < edgeGuardMs || clip.durationMs - offset < edgeGuardMs) {
    return { error: "Split too close to clip edge" };
  }
  const cutSource = sourceTimeAt(clip, timeMs);
  const left = { ...clip, durationMs: offset, sourceOutMs: cutSource };
  const right = {
    ...clip,
    id: newIdValue,
    startMs: timeMs,
    durationMs: clip.durationMs - offset,
    sourceInMs: cutSource,
    sourceOutMs: clip.sourceOutMs,
  };
  return { left, right };
}

function splitLane<T extends TimedClip>(
  clips: T[],
  timeMs: number,
  idPrefix: string,
  edgeGuardMs: number,
): { clips: T[]; error?: string; changed: boolean } {
  const hit = clips.find((c) => timeMs > c.startMs && timeMs < clipEndMs(c));
  if (!hit) return { clips, changed: false };
  const parts = splitOne(hit, timeMs, newId(idPrefix), edgeGuardMs);
  if ("error" in parts) return { clips, error: parts.error, changed: false };
  return {
    clips: clips.flatMap((c) => (c.id === hit.id ? [parts.left, parts.right] : [c])),
    changed: true,
  };
}

/** Split audio + vis under the playhead (linked 1+1 dual-write). */
export function splitAtPlayhead(
  project: Project,
  edgeGuardMs = SPLIT_EDGE_GUARD_MS,
): { project: Project; error?: string } {
  const t = project.playheadMs;
  const audio = splitLane(project.audio, t, "aud", edgeGuardMs);
  const vis = splitLane(project.vis, t, "vis", edgeGuardMs);
  if (!audio.changed && !vis.changed) {
    return { project, error: audio.error ?? vis.error ?? "No clip under playhead" };
  }
  if (audio.error && vis.error) return { project, error: audio.error };
  return {
    project: {
      ...project,
      audio: audio.clips,
      vis: vis.clips,
    },
    error: audio.error ?? vis.error,
  };
}

function shiftAfter<T extends { startMs: number }>(clips: T[], fromMs: number, deltaMs: number): T[] {
  if (deltaMs === 0) return clips;
  return clips.map((c) => (c.startMs >= fromMs - 0.001 ? { ...c, startMs: c.startMs + deltaMs } : c));
}

function trimInClip<T extends TimedClip>(clip: T, timeMs: number): T | { error: string } {
  const end = clipEndMs(clip);
  if (timeMs <= clip.startMs + MIN_CLIP_MS || timeMs >= end) {
    return { error: "Trim in rejected" };
  }
  const src = sourceTimeAt(clip, timeMs);
  return {
    ...clip,
    startMs: timeMs,
    durationMs: end - timeMs,
    sourceInMs: src,
  };
}

function trimOutClip<T extends TimedClip>(clip: T, timeMs: number): T | { error: string } {
  if (timeMs >= clipEndMs(clip) - MIN_CLIP_MS || timeMs <= clip.startMs) {
    return { error: "Trim out rejected" };
  }
  const src = sourceTimeAt(clip, timeMs);
  return {
    ...clip,
    durationMs: timeMs - clip.startMs,
    sourceOutMs: src,
  };
}

function mapClip<T extends TimedClip>(clips: T[], id: string, next: T): T[] {
  return clips.map((c) => (c.id === id ? next : c));
}

/**
 * Trim IN of the clip under the playhead to the playhead.
 * Ripple closes the hole and shifts later clips left (Studio Q).
 */
export function trimInToPlayhead(
  project: Project,
  ripple = false,
): { project: Project; error?: string } {
  const t = project.playheadMs;
  const a = clipAtTime(project.audio, t);
  const v = clipAtTime(project.vis, t);
  if (!a && !v) return { project, error: "No clip under playhead" };

  let audio = project.audio;
  let vis = project.vis;
  let delta = 0;

  if (a) {
    const next = trimInClip(a, t);
    if ("error" in next) return { project, error: next.error };
    delta = next.startMs - a.startMs;
    audio = mapClip(audio, a.id, ripple ? { ...next, startMs: a.startMs } : next);
    if (ripple) {
      audio = audio.map((c) =>
        c.id === a.id ? c : c.startMs >= t ? { ...c, startMs: c.startMs - delta } : c,
      );
    }
  }
  if (v) {
    const next = trimInClip(v, t);
    if ("error" in next) return { project, error: next.error };
    const d = next.startMs - v.startMs;
    vis = mapClip(vis, v.id, ripple ? { ...next, startMs: v.startMs } : next);
    if (ripple) {
      vis = vis.map((c) =>
        c.id === v.id ? c : c.startMs >= t ? { ...c, startMs: c.startMs - d } : c,
      );
    }
  }
  return { project: { ...project, audio, vis } };
}

/** Trim OUT of the clip under the playhead. Ripple packs later clips (Studio W). */
export function trimOutToPlayhead(
  project: Project,
  ripple = false,
): { project: Project; error?: string } {
  const t = project.playheadMs;
  const a = clipAtTime(project.audio, t);
  const v = clipAtTime(project.vis, t);
  if (!a && !v) return { project, error: "No clip under playhead" };

  let audio = project.audio;
  let vis = project.vis;

  if (a) {
    const next = trimOutClip(a, t);
    if ("error" in next) return { project, error: next.error };
    const removed = clipEndMs(a) - clipEndMs(next);
    audio = mapClip(audio, a.id, next);
    if (ripple) audio = shiftAfter(audio, clipEndMs(a) - 0.001, -removed);
  }
  if (v) {
    const next = trimOutClip(v, t);
    if ("error" in next) return { project, error: next.error };
    const removed = clipEndMs(v) - clipEndMs(next);
    vis = mapClip(vis, v.id, next);
    if (ripple) vis = shiftAfter(vis, clipEndMs(v) - 0.001, -removed);
  }
  return { project: { ...project, audio, vis } };
}

/** Drag a clip edge. `nextEdgeMs` is the new IN (left) or OUT (right) time. Dual-writes both lanes. */
export function trimEdgeAt(
  project: Project,
  edge: "in" | "out",
  nextEdgeMs: number,
  ripple = false,
): { project: Project; error?: string } {
  const parked = { ...project, playheadMs: nextEdgeMs };
  return edge === "in" ? trimInToPlayhead(parked, ripple) : trimOutToPlayhead(parked, ripple);
}

function deleteFullyInside<T extends TimedClip>(clips: T[], inMs: number, outMs: number): T[] {
  return clips.filter((c) => !(c.startMs >= inMs && clipEndMs(c) <= outMs));
}

function splitAtTime(project: Project, timeMs: number): Project {
  const audio = splitLane(project.audio, timeMs, "aud", SPLIT_EDGE_GUARD_MS);
  const vis = splitLane(project.vis, timeMs, "vis", SPLIT_EDGE_GUARD_MS);
  return { ...project, audio: audio.clips, vis: vis.clips };
}

/** Split at IN/OUT, remove the middle, leave a hole. */
export function liftRange(project: Project): { project: Project; error?: string } {
  const range = editRangeOf(project);
  if (!range) return { project, error: "Set IN and OUT first" };
  let next = splitAtTime(splitAtTime(project, range.inMs), range.outMs);
  next = {
    ...next,
    audio: deleteFullyInside(next.audio, range.inMs, range.outMs),
    vis: deleteFullyInside(next.vis, range.inMs, range.outMs),
  };
  return { project: next };
}

/** Split at IN/OUT, remove the middle, ripple later clips left (Studio extract). */
export function extractRange(project: Project): { project: Project; error?: string } {
  const range = editRangeOf(project);
  if (!range) return { project, error: "Set IN and OUT first" };
  const lifted = liftRange(project);
  if (lifted.error) return lifted;
  const delta = range.inMs - range.outMs;
  return {
    project: {
      ...lifted.project,
      audio: shiftAfter(lifted.project.audio, range.outMs, delta),
      vis: shiftAfter(lifted.project.vis, range.outMs, delta),
      playheadMs: range.inMs,
    },
  };
}

export function peaksForWindow(
  peaks: number[],
  sourceInMs: number,
  sourceOutMs: number,
  sourceDurationMs: number,
): number[] {
  if (!peaks.length || sourceDurationMs <= 0) return peaks;
  const a = Math.max(0, Math.floor((sourceInMs / sourceDurationMs) * peaks.length));
  const b = Math.min(peaks.length, Math.ceil((sourceOutMs / sourceDurationMs) * peaks.length));
  return peaks.slice(a, Math.max(a + 1, b));
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "") || name;
}
