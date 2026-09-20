/**
 * Kaleido · Petal (`kaleido-petal`).
 * Soft organic petal / flower kaleidoscope. Warmer pink-gold.
 * New id — does not overwrite kaleido-loop presets.
 *
 * AUDIO: petal breathe = rms. hue drift *= gate. kick = soft radial pulse.
 * Bloom-friendly but capped. Gate=0 → still flower, no spin/hue travel.
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

export const KALEIDO_PETAL_ID = "kaleido-petal";
export const KALEIDO_PETAL_FAMILY = KALEIDO_LOOK_FAMILY;
export const KALEIDO_PETAL_MODE = KALEIDO_LOOK_MODE;

export const KALEIDO_PETAL_DEFAULTS: KaleidoLookParams = {
  intensity: 0.88,
  colorPrimary: "#ff8ec8",
  colorSecondary: "#e0b45a",
  speed: 1,
  complexity: 0.7,
  mirrors: 8,
  periodBeats: 8,
  rotSpeed: 0.55,
  bloom: 0.62,
  hueDrift: 16,
  pulseAmount: 0.38,
};

export { createKaleidoMotionState, stepKaleidoMotion, kaleidoFract };

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const petalMotion = createKaleidoMotionState();

function hsl(h: number, s: number, l: number, a: number): string {
  return `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
}

/**
 * PETAL DRAW PATH — soft mirrored petals. Breathe from rms; hue frozen at gate=0.
 * Kick is a soft radial pulse, not a cut or full-frame flash.
 */
export function paintKaleidoPetal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  u: number,
  gate: number,
  kickEnv: number,
  features: Pick<AudioFeatures, "rms">,
  params: Partial<KaleidoLookParams>,
): void {
  const mirrors = Math.max(4, Math.round(num(params.mirrors, 8)));
  const rotSpeed = num(params.rotSpeed, 0.55);
  const bloom = kaleidoCappedBloom(num(params.bloom, 0.62), 0.65);
  const pulseAmount = num(params.pulseAmount, 0.38);
  const hueDrift = num(params.hueDrift, 16);
  const intensity = num(params.intensity, 0.88);
  const pink = String(params.colorPrimary || "#ff8ec8");
  const gold = String(params.colorSecondary || "#e0b45a");
  const uu = kaleidoFract(u);
  const tau = uu * Math.PI * 2;
  const rms = Math.max(0, Math.min(1, features.rms ?? 0));
  const breathe = 1 + rms * pulseAmount * 0.28;
  const kickPulse = 1 + kickEnv * pulseAmount * 0.22;
  const hue = hueDrift * Math.sin(tau) * gate;
  const slice = (Math.PI * 2) / mirrors;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(width, height) * 0.42 * breathe * kickPulse;
  const layers = 5 + Math.floor(num(params.complexity, 0.7) * 4);

  ctx.save();
  ctx.fillStyle = "#0a0608";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(cx, cy);
  ctx.rotate(tau * rotSpeed);

  for (let i = layers; i >= 1; i--) {
    const t = i / layers;
    const r = maxR * t;
    for (let m = 0; m < mirrors; m++) {
      ctx.save();
      ctx.rotate(m * slice);
      if (m % 2) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(r * 0.06, 0);
      ctx.quadraticCurveTo(r * 0.55, r * 0.08, Math.cos(slice * 0.42) * r, Math.sin(slice * 0.42) * r);
      ctx.quadraticCurveTo(r * 0.38, r * 0.02, r * 0.08, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(m % 2 ? gold : pink, (0.07 + (1 - t) * 0.16) * intensity);
      ctx.fill();
      ctx.strokeStyle = hsl(330 + hue + t * 18, 70, 72, (0.1 + (1 - t) * 0.2) * intensity);
      ctx.lineWidth = 1.1 + (1 - t) * 1.2;
      ctx.shadowColor = hexToRgba(pink, 0.22 * bloom);
      ctx.shadowBlur = 6 + bloom * 14;
      ctx.stroke();
      ctx.restore();
    }
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.22);
  core.addColorStop(0, hexToRgba("#fff4e8", 0.28 * intensity));
  core.addColorStop(0.4, hexToRgba(gold, 0.16 * bloom));
  core.addColorStop(1, hexToRgba(pink, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, maxR * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const kaleidoPetalScene: Scene = {
  id: KALEIDO_PETAL_ID,
  name: "Kaleido · Petal",
  description: "Soft petal kaleidoscope — pink-gold, gated hue and breathe",
  defaultParams: KALEIDO_PETAL_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const periodBeats = num(params.periodBeats, 8);
    const periodSec = num(params.periodSec, kaleidoBeatsToSec(periodBeats));
    const rotSpeed = num(params.rotSpeed, 0.55);
    stepKaleidoMotion(petalMotion, features, { flowSpeed: rotSpeed, periodSec, dt });
    paintKaleidoPetal(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      petalMotion.u,
      petalMotion.gate,
      petalMotion.kickEnv,
      features,
      params as Partial<KaleidoLookParams>,
    );
  },
};
