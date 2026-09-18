import { describe, expect, it } from "vitest";
import { createEmptyProject, placeAudio, projectDurationMs, setScene } from "./model";

describe("1+1 project model", () => {
  it("empty project has both lanes empty", () => {
    const p = createEmptyProject();
    expect(p.audio).toBeNull();
    expect(p.vis).toBeNull();
    expect(p.sceneId).toBe("resonance-wave");
    expect(projectDurationMs(p)).toBe(0);
  });

  it("audio import generates a vis clip of the same span", () => {
    const p = placeAudio(createEmptyProject(), {
      name: "kick.wav",
      durationMs: 12_500,
      mimeType: "audio/wav",
      objectUrl: "blob:test",
      peaks: [0.2, 0.8],
    });
    expect(p.audio?.name).toBe("kick.wav");
    expect(p.vis?.sceneId).toBe("resonance-wave");
    expect(p.vis?.startMs).toBe(0);
    expect(p.vis?.durationMs).toBe(12_500);
    expect(projectDurationMs(p)).toBe(12_500);
  });

  it("setScene updates the vis clip, not a second track", () => {
    const placed = placeAudio(createEmptyProject(), {
      name: "a.mp3",
      durationMs: 1000,
      mimeType: "audio/mpeg",
      objectUrl: "blob:a",
      peaks: [],
    });
    const next = setScene(placed, "aurora-ribbon");
    expect(next.vis?.sceneId).toBe("aurora-ribbon");
    expect(next.audio?.id).toBe(placed.audio?.id);
  });
});
