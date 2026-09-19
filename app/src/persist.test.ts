import { describe, expect, it } from "vitest";
import { addMarker, applyStyle, createEmptyProject, placeAudio, setInPoint, setOutPoint } from "./model";
import { deserializeProject, pushRecent, serializeProject, VISUALZ_KIND } from "./persist";

function placed() {
  return placeAudio(createEmptyProject(), {
    name: "kick.wav",
    durationMs: 8000,
    mimeType: "audio/wav",
    objectUrl: "blob:roundtrip",
    peaks: [0.2, 0.9],
  });
}

describe(".visualz.json persist", () => {
  it("roundtrips VIS+A1, loop, marker, mixer, kaleido style", () => {
    let p = placed();
    p = setOutPoint(setInPoint({ ...p, playheadMs: 500 }, 500), 3000);
    p = addMarker(p, 1200);
    p = applyStyle(p, {
      id: "kaleido-loop-gold-gate",
      renderer: "kaleido-loop",
      params: { mirrors: 8, periodBeats: 8 },
    });
    p = { ...p, mixer: { ...p.mixer, a1Muted: true, masterVolume: 0.8 } };
    const json = serializeProject(p);
    expect(json).toContain(VISUALZ_KIND);
    expect(json).not.toContain("blob:roundtrip");
    const loaded = deserializeProject(json);
    expect(loaded.name).toBe("kick");
    expect(loaded.audio).toHaveLength(1);
    expect(loaded.vis).toHaveLength(1);
    expect(loaded.vis[0]?.sceneId).toBe("kaleido-loop");
    expect(loaded.vis[0]?.styleId).toBe("kaleido-loop-gold-gate");
    expect(loaded.markers).toHaveLength(1);
    expect(loaded.markers[0]?.label).toBe("M1");
    expect(loaded.loop).toBe(true);
    expect(loaded.inPointMs).toBe(500);
    expect(loaded.mixer.a1Muted).toBe(true);
    expect(loaded.mixer.masterVolume).toBe(0.8);
    expect(loaded.source?.name).toBe("kick.wav");
    expect(loaded.source?.objectUrl).toBe("");
  });

  it("reads a Resonance schemaVersion 5 VIS+A1 subset", () => {
    const studio = {
      schemaVersion: 5,
      name: "Studio Cut",
      playheadMs: 100,
      loop: false,
      zoomPxPerSec: 90,
      inPointMs: null,
      outPointMs: null,
      masterVolume: 0.5,
      assets: [{ id: "a1", name: "song.wav", kind: "audio", mimeType: "audio/wav", durationMs: 4000 }],
      clips: [
        {
          id: "c1",
          assetId: "a1",
          trackId: "A1",
          startMs: 0,
          durationMs: 4000,
          sourceInMs: 0,
          sourceOutMs: 4000,
        },
      ],
      markers: [{ id: "m1", timeMs: 800, label: "M1" }],
      visualizer: {
        sceneId: "resonance-wave",
        events: [{ id: "ve1", sceneId: "aurora-ribbon", startMs: 0, durationMs: 4000 }],
      },
    };
    const p = deserializeProject(JSON.stringify(studio));
    expect(p.name).toBe("Studio Cut");
    expect(p.audio[0]?.name).toBe("song.wav");
    expect(p.vis[0]?.sceneId).toBe("aurora-ribbon");
    expect(p.markers[0]?.timeMs).toBe(800);
    expect(p.mixer.masterVolume).toBe(0.5);
  });

  it("keeps letzte Dateien (max 8)", () => {
    const store: Record<string, string> = {};
    const memory = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
    for (let i = 0; i < 10; i++) pushRecent(`p${i}.visualz.json`, `{"n":${i}}`, memory);
    const recents = JSON.parse(store["ailexsi.visualz.recents"]!);
    expect(recents).toHaveLength(8);
    expect(recents[0].name).toBe("p9.visualz.json");
  });
});
