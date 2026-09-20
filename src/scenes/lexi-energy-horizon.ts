/**
 * LEXI · Energy Horizon (`lexi-energy-horizon`).
 * Primary energy-field look. New family LEXI Energy — not Terrain Gold, not Kaleido.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { paintEnergyField } from "./lexi-energy-draw";
import {
  ENERGY_HORIZON_DEFAULTS,
  LEXI_ENERGY_FAMILY,
  LEXI_ENERGY_MODE,
  LEXI_ENERGY_PERIOD_SEC,
  createEnergyMotionState,
  energyBands,
  stepEnergyMotion,
  type EnergyLookParams,
} from "./lexi-energy-math";

export const LEXI_ENERGY_HORIZON_ID = "lexi-energy-horizon";
export const LEXI_ENERGY_HORIZON_FAMILY = LEXI_ENERGY_FAMILY;
export const LEXI_ENERGY_HORIZON_MODE = LEXI_ENERGY_MODE;
export const LEXI_ENERGY_HORIZON_DEFAULTS = ENERGY_HORIZON_DEFAULTS;

export { createEnergyMotionState, stepEnergyMotion, energyBands };

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const motion = createEnergyMotionState();

export const lexiEnergyHorizonScene: Scene = {
  id: LEXI_ENERGY_HORIZON_ID,
  name: "LEXI · Energy Horizon",
  description: "Frontal gold energy field — horizon vanishing point, lines on black",
  defaultParams: LEXI_ENERGY_HORIZON_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const periodSec = num(params.periodSec, LEXI_ENERGY_PERIOD_SEC);
    const flowSpeed = num(params.flowSpeed, 0.55);
    stepEnergyMotion(motion, features, { flowSpeed, periodSec, dt });
    const bands = energyBands(features, motion.kickEnv, motion.gate);
    paintEnergyField(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      motion.u,
      bands,
      params as Partial<EnergyLookParams>,
      "horizon",
    );
  },
};
