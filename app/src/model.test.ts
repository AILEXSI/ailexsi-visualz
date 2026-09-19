import { describe, expect, it } from "vitest";
import {
  addMarker,
  applyStyle,
  clipEndMs,
  createEmptyProject,
  cycleScene,
  effectiveGain,
  exportFrameCount,
  extractRange,
  featureTimeAt,
  fitZoomPxPerSec,
  formatExportRangeLine,
  liftRange,
  resolveExportRange,
  visFileDurationSec,
  selectVis,
  setVisQuelle,
  moveLoopRange,
  placeAudio,
  playbackBounds,
  projectDurationMs,
  sceneAt,
  setInPoint,
  setLoopHere,
  setLoopRange,
  setOutPoint,
  setScene,
  sourceTimeAt,
  splitAtPlayhead,
  toggleLoop,
  trimInToPlayhead,
  trimOutToPlayhead,
} from "./model";

const SAMPLE = {
  name: "kick.wav",
  durationMs: 12_500,
  mimeType: "audio/wav",
  objectUrl: "blob:test",
  peaks: [0.2, 0.8],
};

function placed() {
  return placeAudio(createEmptyProject(), SAMPLE);
}

describe("1+1 project model", () => {
  it("empty project has both lanes empty", () => {
    const p = createEmptyProject();
    expect(p.audio).toEqual([]);
    expect(p.vis).toEqual([]);
    expect(p.source).toBeNull();
    expect(p.sceneId).toBe("resonance-wave");
    expect(p.markers).toEqual([]);
    expect(p.mixer.masterVolume).toBe(1);
    expect(projectDurationMs(p)).toBe(0);
  });

  it("audio import generates a vis clip of the same span", () => {
    const p = placed();
    expect(p.source?.name).toBe("kick.wav");
    expect(p.audio).toHaveLength(1);
    expect(p.vis).toHaveLength(1);
    expect(p.vis[0]?.sceneId).toBe("resonance-wave");
    expect(p.vis[0]?.startMs).toBe(0);
    expect(p.vis[0]?.durationMs).toBe(12_500);
    expect(p.audio[0]?.sourceInMs).toBe(0);
    expect(p.audio[0]?.sourceOutMs).toBe(12_500);
    expect(projectDurationMs(p)).toBe(12_500);
  });

  it("setScene updates the vis clip under the playhead, not a second track", () => {
    const placedP = placed();
    const next = setScene(placedP, "aurora-ribbon");
    expect(next.vis[0]?.sceneId).toBe("aurora-ribbon");
    expect(next.sceneId).toBe("aurora-ribbon");
    expect(next.audio[0]?.id).toBe(placedP.audio[0]?.id);
    expect(next.audio).toHaveLength(1);
    expect(next.vis).toHaveLength(1);
  });
});

describe("scene cycle", () => {
  const ids = ["resonance-wave", "aurora-ribbon", "kick-sun"];

  it("cycles forward and wraps", () => {
    const a = cycleScene(placed(), ids, 1);
    expect(a.sceneId).toBe("aurora-ribbon");
    expect(a.vis[0]?.sceneId).toBe("aurora-ribbon");
    const b = cycleScene(a, ids, 1);
    expect(b.sceneId).toBe("kick-sun");
    const c = cycleScene(b, ids, 1);
    expect(c.sceneId).toBe("resonance-wave");
  });

  it("cycles backward", () => {
    const a = cycleScene(placed(), ids, -1);
    expect(a.sceneId).toBe("kick-sun");
  });

  it("after split, cycle only changes the vis clip under the playhead", () => {
    const split = splitAtPlayhead({ ...placed(), playheadMs: 4_000 }).project;
    expect(split.vis).toHaveLength(2);
    const left = cycleScene({ ...split, playheadMs: 1_000 }, ids, 1);
    expect(sceneAt(left, 1_000)).toBe("aurora-ribbon");
    expect(sceneAt(left, 8_000)).toBe("resonance-wave");
    const right = cycleScene({ ...left, playheadMs: 8_000 }, ids, 1);
    expect(sceneAt(right, 1_000)).toBe("aurora-ribbon");
    expect(sceneAt(right, 8_000)).toBe("aurora-ribbon");
  });
});

describe("cutter 1+1", () => {
  it("splitAtPlayhead dual-writes audio and vis", () => {
    const { project, error } = splitAtPlayhead({ ...placed(), playheadMs: 5_000 });
    expect(error).toBeUndefined();
    expect(project.audio).toHaveLength(2);
    expect(project.vis).toHaveLength(2);
    expect(project.audio[0]?.durationMs).toBe(5_000);
    expect(project.audio[0]?.sourceOutMs).toBe(5_000);
    expect(project.audio[1]?.startMs).toBe(5_000);
    expect(project.audio[1]?.sourceInMs).toBe(5_000);
    expect(project.vis[0]?.durationMs).toBe(5_000);
    expect(project.vis[1]?.startMs).toBe(5_000);
    expect(projectDurationMs(project)).toBe(12_500);
  });

  it("refuses a split too close to an edge", () => {
    const { project, error } = splitAtPlayhead({ ...placed(), playheadMs: 20 });
    expect(error).toMatch(/edge/i);
    expect(project.audio).toHaveLength(1);
  });

  it("trim in / out keep source windows aligned", () => {
    const inCut = trimInToPlayhead({ ...placed(), playheadMs: 2_000 });
    expect(inCut.error).toBeUndefined();
    expect(inCut.project.audio[0]?.startMs).toBe(2_000);
    expect(inCut.project.audio[0]?.sourceInMs).toBe(2_000);
    expect(inCut.project.vis[0]?.startMs).toBe(2_000);
    expect(projectDurationMs(inCut.project)).toBe(12_500);

    const outCut = trimOutToPlayhead({ ...placed(), playheadMs: 10_000 });
    expect(outCut.project.audio[0]?.durationMs).toBe(10_000);
    expect(outCut.project.audio[0]?.sourceOutMs).toBe(10_000);
    expect(outCut.project.vis[0]?.durationMs).toBe(10_000);
    expect(projectDurationMs(outCut.project)).toBe(10_000);
  });

  it("ripple trim in closes the hole", () => {
    const { project } = rippleReadySplit();
    const next = trimInToPlayhead({ ...project, playheadMs: 6_000 }, true);
    expect(next.error).toBeUndefined();
    expect(next.project.audio[1]?.startMs).toBe(5_000);
    expect(next.project.audio[1]?.sourceInMs).toBe(6_000);
    expect(next.project.vis[1]?.startMs).toBe(5_000);
    expect(projectDurationMs(next.project)).toBe(11_500);
  });

  it("extract range removes IN/OUT and ripples", () => {
    const marked = setOutPoint(setInPoint({ ...placed(), playheadMs: 2_000 }, 2_000), 4_000);
    const { project, error } = extractRange(marked);
    expect(error).toBeUndefined();
    expect(project.audio).toHaveLength(2);
    expect(project.audio[0]?.durationMs).toBe(2_000);
    expect(project.audio[1]?.startMs).toBe(2_000);
    expect(project.audio[1]?.sourceInMs).toBe(4_000);
    expect(project.vis[1]?.sourceInMs).toBe(4_000);
    expect(projectDurationMs(project)).toBe(10_500);
    expect(featureTimeAt(project, 2_500)).toBe(4_500);
  });

  it("lift range leaves a hole", () => {
    const marked = setOutPoint(setInPoint({ ...placed(), playheadMs: 2_000 }, 2_000), 4_000);
    const { project } = liftRange(marked);
    expect(project.audio[1]?.startMs).toBe(4_000);
    expect(projectDurationMs(project)).toBe(12_500);
  });

  it("sourceTimeAt maps trimmed clips", () => {
    const clip = placed().audio[0]!;
    expect(sourceTimeAt(clip, 0)).toBe(0);
    expect(sourceTimeAt(clip, 6_250)).toBe(6_250);
    const trimmed = trimInToPlayhead({ ...placed(), playheadMs: 2_000 }).project.audio[0]!;
    expect(sourceTimeAt(trimmed, 2_000)).toBe(2_000);
    expect(sourceTimeAt(trimmed, 12_500)).toBe(12_500);
    expect(clipEndMs(trimmed)).toBe(12_500);
  });
});

function rippleReadySplit() {
  return splitAtPlayhead({ ...placed(), playheadMs: 5_000 });
}

describe("loop setzen", () => {
  it("completing IN then OUT arms loop", () => {
    const marked = setOutPoint(setInPoint({ ...placed(), playheadMs: 1_000 }, 1_000), 4_000);
    expect(marked.inPointMs).toBe(1_000);
    expect(marked.outPointMs).toBe(4_000);
    expect(marked.loop).toBe(true);
    expect(playbackBounds(marked)).toEqual({ startMs: 1_000, endMs: 4_000 });
  });

  it("loop off plays the full timeline; marks stay", () => {
    const ranged = setLoopRange(placed(), 2_000, 5_000);
    const off = toggleLoop(ranged);
    expect(off.loop).toBe(false);
    expect(off.inPointMs).toBe(2_000);
    expect(off.outPointMs).toBe(5_000);
    expect(playbackBounds(off)).toEqual({ startMs: 0, endMs: 12_500 });
  });

  it("setLoopHere fills from playhead to end when unmarked", () => {
    const next = setLoopHere({ ...placed(), playheadMs: 3_000 });
    expect(next.loop).toBe(true);
    expect(next.inPointMs).toBe(3_000);
    expect(next.outPointMs).toBe(12_500);
  });

  it("moveLoopRange keeps duration", () => {
    const ranged = setLoopRange(placed(), 1_000, 3_000);
    const moved = moveLoopRange(ranged, 500);
    expect(moved.error).toBeUndefined();
    expect(moved.project.inPointMs).toBe(1_500);
    expect(moved.project.outPointMs).toBe(3_500);
  });
});

describe("style / mixer / timeline helpers", () => {
  it("applyStyle writes renderer + style id on the selected VIS clip", () => {
    const next = applyStyle(placed(), {
      id: "kaleido-loop-gold-gate",
      renderer: "kaleido-loop",
      params: { mirrors: 8, periodBeats: 8 },
    });
    expect(next.vis[0]?.sceneId).toBe("kaleido-loop");
    expect(next.vis[0]?.styleId).toBe("kaleido-loop-gold-gate");
    expect(next.vis[0]?.params?.mirrors).toBe(8);
    expect(next.vis[0]?.quelle).toBe("A1");
  });

  it("selectVis + setVisQuelle write Quelle on that clip", () => {
    const p = placed();
    const id = p.vis[0]!.id;
    const next = setVisQuelle(selectVis(p, id), "A1");
    expect(next.selectedVisId).toBe(id);
    expect(next.vis[0]?.quelle).toBe("A1");
  });

  it("addMarker and Fit stay on the 1+1 timeline", () => {
    const marked = addMarker({ ...placed(), playheadMs: 2_000 });
    expect(marked.markers).toHaveLength(1);
    expect(marked.markers[0]?.timeMs).toBe(2_000);
    expect(marked.markers[0]?.label).toBe("M1");
    expect(fitZoomPxPerSec(12_500, 720)).toBeCloseTo(57.6, 5);
  });

  it("mute A1 or Master zeros gain; solo is stored with one track", () => {
    const p = placed();
    expect(effectiveGain(p.mixer)).toBe(1);
    expect(effectiveGain({ ...p.mixer, a1Muted: true })).toBe(0);
    expect(effectiveGain({ ...p.mixer, masterMuted: true })).toBe(0);
    expect(effectiveGain({ ...p.mixer, a1Solo: true, a1Volume: 0.5, masterVolume: 0.8 })).toBe(0.4);
  });
});

describe("resolveExportRange", () => {
  it("Loop 01:29.88–02:19.91 → ~50s window (OUT-IN)", () => {
    const song = placeAudio(createEmptyProject(), { ...SAMPLE, durationMs: 180_000, name: "song.wav" });
    const p = setLoopRange(song, 89_880, 139_910);
    const range = resolveExportRange(p);
    expect(range.kind).toBe("loop");
    expect(range.startMs).toBe(89_880);
    expect(range.endMs).toBe(139_910);
    expect(range.durationMs).toBe(50_030);
    expect(exportFrameCount(range.durationMs, 30)).toBe(1501);
    expect(visFileDurationSec(1501, 30)).toBeCloseTo(50.03, 2);
    expect(formatExportRangeLine(range, 30)).toBe("Range: LOOP 01:29.88–02:19.91 · 1501 frames");
  });

  it("Loop ON + IN/OUT → only that window; frames and file duration match OUT-IN", () => {
    const p = setLoopRange(placed(), 1_000, 4_000);
    const range = resolveExportRange(p);
    expect(range.kind).toBe("loop");
    expect(range.startMs).toBe(1_000);
    expect(range.endMs).toBe(4_000);
    expect(range.durationMs).toBe(3_000);
    expect(range.warning).toBeUndefined();
    const fps = 30;
    const frames = exportFrameCount(range.durationMs, fps);
    expect(frames).toBe(90);
    expect(visFileDurationSec(frames, fps)).toBeCloseTo((4_000 - 1_000) / 1000, 6);
    expect(formatExportRangeLine(range, fps)).toBe("Range: LOOP 00:01.00–00:04.00 · 90 frames");
    expect(playbackBounds(p)).toEqual({ startMs: 1_000, endMs: 4_000 });
  });

  it("Loop OFF → full A1/timeline length", () => {
    const ranged = setLoopRange(placed(), 2_000, 5_000);
    const off = toggleLoop(ranged);
    const range = resolveExportRange(off);
    expect(range.kind).toBe("full");
    expect(range.startMs).toBe(0);
    expect(range.durationMs).toBe(12_500);
    expect(exportFrameCount(range.durationMs, 30)).toBe(375);
    expect(formatExportRangeLine(range, 30)).toBe("Range: FULL · 375 frames");
  });

  it("muxed Export MP4 uses the same range as picture (loop vs full)", () => {
    const looped = setLoopRange(placed(), 1_000, 4_000);
    const full = toggleLoop(looped);
    expect(resolveExportRange(looped).durationMs).toBe(3_000);
    expect(exportFrameCount(resolveExportRange(looped).durationMs, 30)).toBe(90);
    expect(visFileDurationSec(90, 30)).toBeCloseTo(3, 6);
    expect(resolveExportRange(full).durationMs).toBe(12_500);
    expect(exportFrameCount(resolveExportRange(full).durationMs, 30)).toBe(375);
    expect(visFileDurationSec(375, 30)).toBeCloseTo(12.5, 6);
  });

  it("Loop ON without IN/OUT does not invent a region — FULL + warning", () => {
    const p = { ...placed(), loop: true, inPointMs: null, outPointMs: null };
    const range = resolveExportRange(p);
    expect(range.kind).toBe("full");
    expect(range.durationMs).toBe(12_500);
    expect(range.warning).toMatch(/Set Loop/i);
  });
});
