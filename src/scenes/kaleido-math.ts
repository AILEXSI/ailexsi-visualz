/**
 * Shared Kaleido Loop math for new looks (Crystal / Petal / Tunnel).
 * Does not change the original kaleido-loop clock-travel renderer.
 *
 * LAW: Pose idles when gate≈0. Primary motion (spin / travel / breathe amp)
 * is gated by audio energy. timeMs is decay/integration only.
 * u wraps fract so the pose is loop-seamless at any frozen phase.
 */

import type { AudioFeatures } from "../types";
import type { SceneParams } from "../types";

export const KALEIDO_LOOK_FAMILY = "Kaleido Loop";
export const KALEIDO_LOOK_MODE = "loop-seamless";
export const KALEIDO_LOOK_BPM = 120;

export type KaleidoLookParams = SceneParams & {
  mirrors: number;
  periodBeats: number;
  rotSpeed: number;
  bloom: number;
  hueDrift: number;
  pulseAmount: number;
};

export type KaleidoMotionState = {
  u: number;
  gate: number;
  kickEnv: number;
  lastTimeMs: number | null;
};

export function createKaleidoMotionState(u = 0): KaleidoMotionState {
  return { u, gate: 0, kickEnv: 0, lastTimeMs: null };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function kaleidoFract(u: number): number {
  return u - Math.floor(u);
}

export function kaleidoBeatsToSec(periodBeats: number, bpm = KALEIDO_LOOK_BPM): number {
  return (Math.max(1, periodBeats) * 60) / Math.max(1, bpm);
}

/** Fold a world angle into a mirrored kaleido sector. */
export function kaleidoFoldAngle(angle: number, mirrors: number): {
  slice: number;
  folded: number;
  sector: number;
} {
  const n = Math.max(2, Math.round(mirrors));
  const slice = (Math.PI * 2) / n;
  const twoPi = Math.PI * 2;
  const a = ((angle % twoPi) + twoPi) % twoPi;
  const sector = Math.floor(a / slice);
  let local = a - sector * slice;
  if (sector % 2 === 1) local = slice - local;
  if (local > slice * 0.5) local = slice - local;
  return { slice, folded: local, sector };
}

/**
 * motionGate: rms + bass + kickEnv. mid/treble are not travel drivers.
 * raw := clamp01(rms*0.45 + bass*0.40 + kickEnv*0.55)
 */
export function kaleidoMotionEnergy(
  features: Pick<AudioFeatures, "rms" | "bass" | "kick" | "beatPulse">,
  kickEnv: number,
): number {
  const rms = clamp01(features.rms ?? 0);
  const bass = clamp01(features.bass ?? 0);
  const env = clamp01(Math.max(features.kick ?? features.beatPulse ?? 0, kickEnv));
  return clamp01(rms * 0.45 + bass * 0.4 + env * 0.55);
}

/**
 * du = gate * flowSpeed * dt / periodSec. Gate=0 ⇒ u freezes.
 * Kick decays via dt; never resets u.
 */
export function stepKaleidoMotion(
  state: KaleidoMotionState,
  features: Pick<AudioFeatures, "timeMs" | "rms" | "bass" | "kick" | "beatPulse">,
  opts: { flowSpeed?: number; periodSec?: number; dt?: number; kickTau?: number } = {},
): KaleidoMotionState {
  const periodSec = Math.max(1e-6, opts.periodSec ?? 4);
  const flowSpeed = Number.isFinite(opts.flowSpeed) ? Math.max(0, opts.flowSpeed as number) : 0.9;
  const kickTau = Math.max(0.05, opts.kickTau ?? 0.22);
  let dt = opts.dt;
  if (dt == null) {
    dt =
      state.lastTimeMs == null ? 1 / 30 : (features.timeMs - state.lastTimeMs) / 1000;
  }
  dt = Math.max(0, Math.min(0.05, dt));
  state.lastTimeMs = features.timeMs;

  const kickIn = clamp01(features.kick ?? features.beatPulse ?? 0);
  state.kickEnv = Math.max(kickIn, state.kickEnv * Math.exp(-dt / kickTau));
  if (state.kickEnv < 1e-4) state.kickEnv = 0;

  const raw = kaleidoMotionEnergy(features, state.kickEnv);
  const smooth = 1 - Math.exp(-dt / 0.07);
  state.gate = state.gate + (raw - state.gate) * smooth;
  if (state.gate < 1e-4) state.gate = 0;

  state.u += state.gate * flowSpeed * dt / periodSec;
  state.u = kaleidoFract(state.u);
  return state;
}

/** Periodic pose terms — identical at u and u+1. */
export function kaleidoPoseKey(u: number): number[] {
  const uu = kaleidoFract(u);
  const tau = uu * Math.PI * 2;
  return [Math.sin(tau), Math.cos(tau), Math.sin(tau * 2), Math.cos(tau * 3)];
}

export function kaleidoPoseHash(key: readonly number[]): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= Math.round((key[i] ?? 0) * 1e6);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export function kaleidoCappedBloom(bloom: number, cap = 0.65): number {
  return Math.min(cap, Math.max(0, bloom));
}
