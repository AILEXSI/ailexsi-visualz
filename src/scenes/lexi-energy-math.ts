/**
 * LEXI Energy — shared motion + perspective (not Terrain Gold dunes).
 *
 * Phase-1 ownership:
 *   geometry/camera — this file (1-pt perspective into horizon VP)
 *   color           — ENERGY_VOID / GOLD / ORANGE (thin light, black space)
 *   particles/bloom — lexi-energy-draw.ts (selective, never full-frame fog)
 *   audio           — stepEnergyMotion + band maps below
 *
 * Why the old look was dune-like: side-profile heightfield +
 * filled ribbons/hills read as a sand hill. Those stay on Terrain Gold ids.
 * Keep: audio-gated travel, timeMs decay only, canvas stack, gold-orange.
 */

import type { AudioFeatures } from "../types";
import type { SceneParams } from "../types";

export const LEXI_ENERGY_FAMILY = "LEXI Energy";
export const LEXI_ENERGY_MODE = "loop-seamless";
export const LEXI_ENERGY_PERIOD_SEC = 8;
export const ENERGY_VOID = "#000000";
export const ENERGY_GOLD = "#e8a428";
export const ENERGY_ORANGE = "#ff8a1a";
export const ENERGY_HOT = "#fff1c4";
/** Horizon band target — X 50%, Y 48–55%. */
export const ENERGY_HORIZON_Y = 0.51;

export type EnergyMotionState = {
  u: number;
  gate: number;
  kickEnv: number;
  lastTimeMs: number | null;
};

export type EnergyBands = {
  kickEnv: number;
  bass: number;
  mid: number;
  high: number;
  harmonic: number;
  gate: number;
};

export type EnergyLookParams = SceneParams & {
  horizonY: number;
  flowSpeed: number;
  bloomCap: number;
  bloom: number;
  periodSec: number;
  lineDensity: number;
  spectrumAmount: number;
};

export function createEnergyMotionState(u = 0): EnergyMotionState {
  return { u, gate: 0, kickEnv: 0, lastTimeMs: null };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function energyFract(u: number): number {
  return u - Math.floor(u);
}

/**
 * motionGate: rms + bass + kickEnv. Highs are not travel drivers.
 * raw := clamp01(rms*0.42 + bass*0.38 + kickEnv*0.50)
 */
export function energyMotionEnergy(
  features: Pick<AudioFeatures, "rms" | "bass" | "kick" | "beatPulse">,
  kickEnv: number,
): number {
  const rms = clamp01(features.rms ?? 0);
  const bass = clamp01(features.bass ?? 0);
  const env = clamp01(Math.max(features.kick ?? features.beatPulse ?? 0, kickEnv));
  return clamp01(rms * 0.42 + bass * 0.38 + env * 0.5);
}

export function energyBands(
  features: Pick<AudioFeatures, "bass" | "mid" | "treble" | "hat" | "vocal">,
  kickEnv: number,
  gate: number,
): EnergyBands {
  const high = clamp01((features.treble ?? 0) * 0.7 + (features.hat ?? 0) * 0.45);
  const harmonic = clamp01((features.mid ?? 0) * 0.62 + (features.vocal ?? 0) * 0.28);
  return {
    kickEnv: clamp01(kickEnv),
    bass: clamp01(features.bass ?? 0),
    mid: clamp01(features.mid ?? 0),
    high,
    harmonic,
    gate: clamp01(gate),
  };
}

/**
 * Primary travel *= gate. Gate≈0 → tiny idle drift only (not wall-clock travel).
 * timeMs → dt for decay/integration. Kick never resets u. No camera shake.
 */
export function stepEnergyMotion(
  state: EnergyMotionState,
  features: Pick<AudioFeatures, "timeMs" | "rms" | "bass" | "kick" | "beatPulse">,
  opts: { flowSpeed?: number; periodSec?: number; dt?: number; kickTau?: number; idleDrift?: number } = {},
): EnergyMotionState {
  const periodSec = Math.max(1e-6, opts.periodSec ?? LEXI_ENERGY_PERIOD_SEC);
  const flowSpeed = Math.max(0, opts.flowSpeed ?? 0.55);
  const kickTau = Math.max(0.05, opts.kickTau ?? 0.28);
  const idleDrift = Math.max(0, opts.idleDrift ?? 0.02);
  let dt = opts.dt;
  if (dt == null) {
    dt = state.lastTimeMs == null ? 1 / 30 : (features.timeMs - state.lastTimeMs) / 1000;
  }
  dt = Math.max(0, Math.min(0.05, dt));
  state.lastTimeMs = features.timeMs;

  const kickIn = clamp01(features.kick ?? features.beatPulse ?? 0);
  state.kickEnv = Math.max(kickIn, state.kickEnv * Math.exp(-dt / kickTau));
  if (state.kickEnv < 1e-4) state.kickEnv = 0;

  const raw = energyMotionEnergy(features, state.kickEnv);
  const smooth = 1 - Math.exp(-dt / 0.08);
  state.gate = state.gate + (raw - state.gate) * smooth;
  if (state.gate < 1e-4) state.gate = 0;

  const drive = state.gate * flowSpeed + (state.gate < 1e-4 ? idleDrift : 0);
  state.u += drive * dt / periodSec;
  state.u = energyFract(state.u);
  return state;
}

export function energyPoseKey(u: number, bands: Partial<EnergyBands> = {}): number[] {
  const uu = energyFract(u);
  const tau = uu * Math.PI * 2;
  return [
    Math.sin(tau),
    Math.cos(tau),
    bands.bass ?? 0,
    bands.mid ?? 0,
    bands.kickEnv ?? 0,
    bands.harmonic ?? 0,
  ];
}

export function energyPoseHash(key: readonly number[]): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= Math.round((key[i] ?? 0) * 1e6);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export function energyCappedBloom(bloom: number, cap = 0.42): number {
  return Math.min(cap, Math.max(0, bloom));
}

/** 1-point perspective. z=0 far (VP), z=1 near (camera). */
export function energyProject(
  nx: number,
  z: number,
  width: number,
  height: number,
  horizonY: number,
  side: 1 | -1,
): { x: number; y: number; vpX: number; vpY: number } {
  const zz = clamp01(z);
  const vpX = width * 0.5;
  const vpY = height * horizonY;
  const spread = 0.06 + zz * 1.18;
  const x = vpX + (nx - 0.5) * width * spread;
  const run = zz ** 1.65;
  const y = side === 1 ? vpY + run * (height - vpY) * 0.94 : vpY - run * vpY * 0.72;
  return { x, y, vpX, vpY };
}

/** Line displacement — waves on strokes, never a filled heightfield. */
export function energyLineOffset(
  nx: number,
  z: number,
  u: number,
  bands: EnergyBands,
  side: 1 | -1,
): number {
  const uu = energyFract(u);
  const tau = uu * Math.PI * 2;
  const bass = Math.sin(nx * Math.PI * 1.1 + tau) * bands.bass * 16 * z;
  const mid = Math.sin(nx * Math.PI * 4.2 + tau * 2) * bands.mid * 6 * z;
  const kick = side === 1 ? bands.kickEnv * z * z * 22 : bands.kickEnv * z * 6;
  const harm = Math.sin(nx * Math.PI * 0.55 + tau * 0.5) * bands.harmonic * 8 * z;
  return (bass + mid + kick + harm) * (0.25 + 0.75 * bands.gate);
}

export const ENERGY_HORIZON_DEFAULTS: EnergyLookParams = {
  intensity: 0.88,
  colorPrimary: ENERGY_GOLD,
  colorSecondary: ENERGY_ORANGE,
  speed: 1,
  complexity: 0.62,
  horizonY: ENERGY_HORIZON_Y,
  flowSpeed: 0.55,
  bloomCap: 0.42,
  bloom: 0.4,
  periodSec: LEXI_ENERGY_PERIOD_SEC,
  lineDensity: 1,
  spectrumAmount: 0.55,
};

export const ENERGY_FIELD_DEFAULTS: EnergyLookParams = {
  ...ENERGY_HORIZON_DEFAULTS,
  complexity: 0.78,
  lineDensity: 1.55,
  spectrumAmount: 0.28,
  flowSpeed: 0.5,
};

export const ENERGY_SPECTRUM_DEFAULTS: EnergyLookParams = {
  ...ENERGY_HORIZON_DEFAULTS,
  complexity: 0.7,
  lineDensity: 0.72,
  spectrumAmount: 1.15,
  flowSpeed: 0.48,
};
