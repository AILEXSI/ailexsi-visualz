import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CORE_BUILD_ID } from "../audio/wave-core";
import { createWaveHistoryAnalyzer } from "../audio/wave-history-analyzer";
import { createWaveHistoryMusicBuffer } from "../audio/wave-history-music-fixture";
import { getCatalogEntry } from "./catalog";
import { builtinScenes } from "./index";
import {
  LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS,
  LEXI_WAVE_HISTORY_EVIDENCE_FAMILY,
  LEXI_WAVE_HISTORY_EVIDENCE_ID,
  lexiWaveHistoryEvidenceScene,
} from "./lexi-wave-history-evidence";

const here = dirname(fileURLToPath(import.meta.url));

function source(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("LEXI Wave-History Evidence stage", () => {
  it("registers a new evidence id and keeps prior LEXI / Kaleido stages", () => {
    expect(LEXI_WAVE_HISTORY_EVIDENCE_ID).toBe("lexi-wave-history-evidence");
    expect(lexiWaveHistoryEvidenceScene.id).toBe(LEXI_WAVE_HISTORY_EVIDENCE_ID);
    expect(getCatalogEntry(LEXI_WAVE_HISTORY_EVIDENCE_ID)).toMatchObject({
      id: LEXI_WAVE_HISTORY_EVIDENCE_ID,
      family: LEXI_WAVE_HISTORY_EVIDENCE_FAMILY,
      renderer: LEXI_WAVE_HISTORY_EVIDENCE_ID,
      displayName: "Wave-History · Evidence (Debug)",
      params: LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS,
    });
    expect(LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS.geometryOnly).toBe(true);
    expect(LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS.gpuFilaments).toBe(false);
    expect(LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS.bloom).toBe(0);
    expect(LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS.coreBuildId).toBe(CORE_BUILD_ID);
    expect(builtinScenes.some((s) => s.id === LEXI_WAVE_HISTORY_EVIDENCE_ID)).toBe(true);
    for (const id of [
      "lexi-terrain-gold",
      "lexi-terrain-gold-field",
      "lexi-terrain-gold-field-plus",
      "lexi-terrain-gold-hero",
      "lexi-terrain-gold-p12",
      "lexi-energy-horizon",
      "lexi-energy-field",
      "lexi-energy-spectrum",
      "kaleido-loop",
      "kaleido-crystal",
      "kaleido-petal",
      "kaleido-tunnel",
    ]) {
      expect(builtinScenes.some((s) => s.id === id)).toBe(true);
      expect(getCatalogEntry(id)?.id).toBe(id);
    }
  });

  it("scene consumes ring rows only — no second analysis path", () => {
    const sceneSrc = source("lexi-wave-history-evidence.ts");
    const drawSrc = source("lexi-wave-history-draw.ts");
    for (const src of [sceneSrc, drawSrc]) {
      expect(src).not.toMatch(/fftMags|fftInPlace|normalizeBands|smoothBands|analyzePcmToRing/);
      expect(src).not.toMatch(/createAnalyser|getByteFrequency|AnalyserNode/);
      expect(src).not.toMatch(/energyBands|spectrumSinus|horizonY|applyBloom|createAnalyser/);
    }
    expect(sceneSrc).toMatch(/features\.waveHistory/);
    expect(drawSrc).toMatch(/ringRow/);
  });

  it("render uses attached history, not silent fake energies", () => {
    const calls: string[] = [];
    const ctx = {
      save() {},
      restore() {},
      setTransform() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() { calls.push("stroke"); },
      fillRect() { calls.push("fill"); },
      fillText(text: string) { calls.push(text); },
    } as unknown as CanvasRenderingContext2D;
    Object.assign(ctx, { fillStyle: "", strokeStyle: "", lineWidth: 0, lineJoin: "", font: "", globalAlpha: 1 });
    const snap = createWaveHistoryAnalyzer(createWaveHistoryMusicBuffer()).sampleAt(2500);
    lexiWaveHistoryEvidenceScene.render(
      { width: 640, height: 360, ctx },
      {
        timeMs: 2500,
        rms: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        spectrum: new Float32Array(64),
        onset: false,
        beatPulse: 0,
        waveHistory: snap,
      },
      LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS,
      1 / 30,
    );
    expect(calls.some((c) => c.includes("EVIDENCE"))).toBe(true);
    expect(calls.some((c) => c.includes(CORE_BUILD_ID))).toBe(true);
    expect(calls).toContain("stroke");
  });
});
