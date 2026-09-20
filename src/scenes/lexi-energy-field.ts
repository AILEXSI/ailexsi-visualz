/**
 * LEXI · Energy Field (`lexi-energy-field`).
 * Denser converging line field. New family LEXI Energy.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { paintEnergyField } from "./lexi-energy-draw";
import {
  ENERGY_FIELD_DEFAULTS,
  LEXI_ENERGY_FAMILY,
  LEXI_ENERGY_MODE,
  LEXI_ENERGY_PERIOD_SEC,
  createEnergyMotionState,
  energyBands,
  stepEnergyMotion,
  type EnergyLookParams,
} from "./lexi-energy-math";

export const LEXI_ENERGY_FIELD_ID = "lexi-energy-field";
export const LEXI_ENERGY_FIELD_FAMILY = LEXI_ENERGY_FAMILY;
export const LEXI_ENERGY_FIELD_MODE = LEXI_ENERGY_MODE;
export const LEXI_ENERGY_FIELD_DEFAULTS = ENERGY_FIELD_DEFAULTS;

export { createEnergyMotionState, stepEnergyMotion, energyBands };

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const motion = createEnergyMotionState();

export const lexiEnergyFieldScene: Scene = {
  id: LEXI_ENERGY_FIELD_ID,
  name: "LEXI · Energy Field",
  description: "Denser energy line field — frontal VP, black gaps, gated travel",
  defaultParams: LEXI_ENERGY_FIELD_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const periodSec = num(params.periodSec, LEXI_ENERGY_PERIOD_SEC);
    const flowSpeed = num(params.flowSpeed, 0.5);
    stepEnergyMotion(motion, features, { flowSpeed, periodSec, dt });
    const bands = energyBands(features, motion.kickEnv, motion.gate);
    paintEnergyField(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      motion.u,
      bands,
      params as Partial<EnergyLookParams>,
      "field",
    );
  },
};
