/**
 * LEXI · Wave-History Evidence (`lexi-wave-history-evidence`).
 * Debug / evidence stage. Geometry-only gold lines from the shared FFT core.
 * Does not FFT, normalize, smooth, or invent energies. Other LEXI stages stay as-is.
 */

import type { AudioFeatures, Scene, SceneContext, SceneParams } from "../types";
import { CORE_BUILD_ID, createRing } from "../audio/wave-core";
import { drawWaveHistoryGeometry, evidenceLabel } from "./lexi-wave-history-draw";

export const LEXI_WAVE_HISTORY_EVIDENCE_ID = "lexi-wave-history-evidence";
export const LEXI_WAVE_HISTORY_EVIDENCE_FAMILY = "LEXI";
export const LEXI_WAVE_HISTORY_EVIDENCE_MODE = "evidence-debug";

export const LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS: SceneParams = {
  intensity: 1,
  colorPrimary: "#ffa840",
  colorSecondary: "#000000",
  speed: 1,
  complexity: 1,
  geometryOnly: true,
  bloom: 0,
  chroma: 0,
  grain: 0,
  vignette: 0,
  gpuFilaments: false,
  coreBuildId: CORE_BUILD_ID,
};

export const lexiWaveHistoryEvidenceScene: Scene = {
  id: LEXI_WAVE_HISTORY_EVIDENCE_ID,
  name: "LEXI · Wave-History Evidence",
  description: "Evidence / Debug — geometry-only Wave-History FFT (gold lines, no bloom)",
  defaultParams: LEXI_WAVE_HISTORY_EVIDENCE_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures) {
    const snap = features.waveHistory;
    const ring = snap?.ring ?? createRing();
    drawWaveHistoryGeometry(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      ring,
      evidenceLabel(snap),
    );
  },
};
