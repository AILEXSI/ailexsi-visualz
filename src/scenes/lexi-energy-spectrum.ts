/**
 * LEXI · Energy Spectrum (`lexi-energy-spectrum`).
 * Stronger irregular vertical energy above the horizon. Not EQ bars.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { paintEnergyField } from "./lexi-energy-draw";
import {
  ENERGY_SPECTRUM_DEFAULTS,
  LEXI_ENERGY_FAMILY,
  LEXI_ENERGY_MODE,
  LEXI_ENERGY_PERIOD_SEC,
  createEnergyMotionState,
  energyBands,
  stepEnergyMotion,
  type EnergyLookParams,
} from "./lexi-energy-math";

export const LEXI_ENERGY_SPECTRUM_ID = "lexi-energy-spectrum";
export const LEXI_ENERGY_SPECTRUM_FAMILY = LEXI_ENERGY_FAMILY;
export const LEXI_ENERGY_SPECTRUM_MODE = LEXI_ENERGY_MODE;
export const LEXI_ENERGY_SPECTRUM_DEFAULTS = ENERGY_SPECTRUM_DEFAULTS;

export { createEnergyMotionState, stepEnergyMotion, energyBands };

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const motion = createEnergyMotionState();

export const lexiEnergySpectrumScene: Scene = {
  id: LEXI_ENERGY_SPECTRUM_ID,
  name: "LEXI · Energy Spectrum",
  description: "Energy field + irregular spectral wisps above the horizon",
  defaultParams: LEXI_ENERGY_SPECTRUM_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const periodSec = num(params.periodSec, LEXI_ENERGY_PERIOD_SEC);
    const flowSpeed = num(params.flowSpeed, 0.48);
    stepEnergyMotion(motion, features, { flowSpeed, periodSec, dt });
    const bands = energyBands(features, motion.kickEnv, motion.gate);
    paintEnergyField(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      motion.u,
      bands,
      params as Partial<EnergyLookParams>,
      "spectrum",
    );
  },
};
