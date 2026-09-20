/**
 * Kaleido · Crystal (`kaleido-crystal`).
 * Hard geometric facets / prism wedges. Cool-white + ice-gold.
 * New id — does not overwrite kaleido-loop presets.
 *
 * AUDIO: rotation/pulse via bass+rms gate. Kick = brief mirror flash (no hard cut).
 * mid/treble = edge sparkle density only.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import {
  KALEIDO_LOOK_FAMILY,
  KALEIDO_LOOK_MODE,
  type KaleidoLookParams,
  kaleidoBeatsToSec,
  kaleidoCappedBloom,
  kaleidoFract,
  createKaleidoMotionState,
  stepKaleidoMotion,
} from "./kaleido-math";

export const KALEIDO_CRYSTAL_ID = "kaleido-crystal";
export const KALEIDO_CRYSTAL_FAMILY = KALEIDO_LOOK_FAMILY;
export const KALEIDO_CRYSTAL_MODE = KALEIDO_LOOK_MODE;

export const KALEIDO_CRYSTAL_DEFAULTS: KaleidoLookParams = {
  intensity: 0.9,
  colorPrimary: "#e8f4ff",
  colorSecondary: "#d4c48a",
  speed: 1,
  complexity: 0.72,
  mirrors: 10,
  periodBeats: 8,
  rotSpeed: 0.9,
  bloom: 0.48,
  hueDrift: 8,
  pulseAmount: 0.22,
};

export { createKaleidoMotionState, stepKaleidoMotion, kaleidoFract };

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function sparkleBudget(mid: number, treble: number, complexity: number): number {
  return Math.round(clamp01(mid * 0.5 + treble * 0.5) * 14 * Math.max(0.2, complexity));
}

const crystalMotion = createKaleidoMotionState();

/**
 * CRYSTAL DRAW PATH — sharp prism wedges + edge sparkle.
 * Kick flashes mirror edges only (no full-frame fill).
 */
export function paintKaleidoCrystal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  u: number,
  gate: number,
  kickEnv: number,
  features: Pick<AudioFeatures, "mid" | "treble" | "rms" | "bass">,
  params: Partial<KaleidoLookParams>,
): void {
  const mirrors = Math.max(4, Math.round(num(params.mirrors, 10)));
  const rotSpeed = num(params.rotSpeed, 0.9);
  const bloom = kaleidoCappedBloom(num(params.bloom, 0.48), 0.5);
  const pulseAmount = num(params.pulseAmount, 0.22);
  const intensity = num(params.intensity, 0.9);
  const ice = String(params.colorPrimary || "#e8f4ff");
  const gold = String(params.colorSecondary || "#d4c48a");
  const uu = kaleidoFract(u);
  const tau = uu * Math.PI * 2;
  const pulse = 1 + gate * pulseAmount * 0.18 + kickEnv * pulseAmount * 0.35;
  const slice = (Math.PI * 2) / mirrors;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(width, height) * 0.5 * pulse;
  const layers = 6 + Math.floor(num(params.complexity, 0.72) * 5);
  const sparks = sparkleBudget(features.mid ?? 0, features.treble ?? 0, num(params.complexity, 0.72));
  const flash = 0.12 + kickEnv * 0.45;

  ctx.save();
  ctx.fillStyle = "#03060a";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(cx, cy);
  ctx.rotate(tau * rotSpeed);

  for (let i = layers; i >= 1; i--) {
    const t = i / layers;
    const r = maxR * t * (0.78 + 0.06 * Math.sin(tau + i * 0.4));
    for (let m = 0; m < mirrors; m++) {
      ctx.save();
      ctx.rotate(m * slice);
      if (m % 2) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(r * 0.08, 0);
      ctx.lineTo(Math.cos(slice * 0.08) * r, Math.sin(slice * 0.08) * r);
      ctx.lineTo(Math.cos(slice * 0.92) * r * 0.94, Math.sin(slice * 0.92) * r * 0.94);
      ctx.closePath();
      ctx.strokeStyle = hexToRgba(t > 0.55 ? ice : gold, (0.16 + (1 - t) * 0.38 + flash * 0.25) * intensity);
      ctx.lineWidth = 1.05 + (1 - t) * 1.4 + kickEnv * 0.8;
      ctx.shadowColor = hexToRgba(ice, 0.18 * bloom);
      ctx.shadowBlur = 4 + bloom * 10;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.22, 0);
      ctx.lineTo(Math.cos(slice * 0.5) * r * 0.72, Math.sin(slice * 0.5) * r * 0.72);
      ctx.strokeStyle = hexToRgba(ice, (0.1 + flash * 0.35) * intensity);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let s = 0; s < sparks; s++) {
    const a = ((s * 2.399 + uu * 0) % 1) * slice;
    const rr = maxR * (0.35 + ((s * 0.173) % 0.55));
    ctx.fillStyle = hexToRgba(ice, 0.22 + (s % 3) * 0.08);
    ctx.fillRect(Math.cos(a) * rr - 0.7, Math.sin(a) * rr - 0.7, 1.4, 1.4);
  }

  ctx.restore();
}

export const kaleidoCrystalScene: Scene = {
  id: KALEIDO_CRYSTAL_ID,
  name: "Kaleido · Crystal",
  description: "Hard prism kaleidoscope — ice-white facets, gated spin",
  defaultParams: KALEIDO_CRYSTAL_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const periodBeats = num(params.periodBeats, 8);
    const periodSec = num(params.periodSec, kaleidoBeatsToSec(periodBeats));
    const rotSpeed = num(params.rotSpeed, 0.9);
    stepKaleidoMotion(crystalMotion, features, { flowSpeed: rotSpeed, periodSec, dt });
    paintKaleidoCrystal(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      crystalMotion.u,
      crystalMotion.gate,
      crystalMotion.kickEnv,
      features,
      params as Partial<KaleidoLookParams>,
    );
  },
};
