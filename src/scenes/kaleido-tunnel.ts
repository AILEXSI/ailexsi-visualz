/**
 * Kaleido · Tunnel (`kaleido-tunnel`).
 * Deep Z tunnel of mirrored rings / segments racing inward.
 * Neon cyan-magenta-gold. New id — does not overwrite kaleido-loop presets.
 *
 * AUDIO: travel speed *= motionGate (silence freezes depth). Kick = ring impulse.
 * Bass = tunnel warp. mid/treble unused for travel.
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

export const KALEIDO_TUNNEL_ID = "kaleido-tunnel";
export const KALEIDO_TUNNEL_FAMILY = KALEIDO_LOOK_FAMILY;
export const KALEIDO_TUNNEL_MODE = KALEIDO_LOOK_MODE;

export const KALEIDO_TUNNEL_DEFAULTS: KaleidoLookParams = {
  intensity: 0.9,
  colorPrimary: "#3de0ff",
  colorSecondary: "#ff6ec7",
  speed: 1,
  complexity: 0.68,
  mirrors: 12,
  periodBeats: 16,
  rotSpeed: 0.7,
  bloom: 0.55,
  hueDrift: 20,
  pulseAmount: 0.4,
};

export { createKaleidoMotionState, stepKaleidoMotion, kaleidoFract };

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const tunnelMotion = createKaleidoMotionState();

/**
 * TUNNEL DRAW PATH — perspective mirrored rings. z = fract(row + u).
 * Gate=0 freezes inward travel. Kick impulses ring scale; bass warps radius.
 */
export function paintKaleidoTunnel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  u: number,
  gate: number,
  kickEnv: number,
  features: Pick<AudioFeatures, "bass">,
  params: Partial<KaleidoLookParams>,
): void {
  const mirrors = Math.max(6, Math.round(num(params.mirrors, 12)));
  const rotSpeed = num(params.rotSpeed, 0.7);
  const bloom = kaleidoCappedBloom(num(params.bloom, 0.55), 0.58);
  const pulseAmount = num(params.pulseAmount, 0.4);
  const hueDrift = num(params.hueDrift, 20);
  const intensity = num(params.intensity, 0.9);
  const cyan = String(params.colorPrimary || "#3de0ff");
  const magenta = String(params.colorSecondary || "#ff6ec7");
  const uu = kaleidoFract(u);
  const tau = uu * Math.PI * 2;
  const bass = clamp01(features.bass ?? 0);
  const rings = 10 + Math.floor(num(params.complexity, 0.68) * 8);
  const slice = (Math.PI * 2) / mirrors;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(width, height) * 0.56;
  const kickZ = kickEnv * 0.07;
  const gold = "#d4b45a";

  ctx.save();
  ctx.fillStyle = "#02030a";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(cx, cy);
  ctx.rotate(tau * rotSpeed * 0.35);

  for (let i = rings; i >= 1; i--) {
    const z = kaleidoFract(i / rings + uu + kickZ);
    const persp = 0.08 + z * z * 0.92;
    const warp = 1 + bass * 0.14 * Math.sin(tau + i * 0.5);
    const r = maxR * persp * warp * (1 + kickEnv * pulseAmount * 0.08);
    const lw = (0.45 + z * 2.1) * (0.7 + gate * 0.4);
    const tint = z > 0.66 ? cyan : z > 0.36 ? magenta : gold;
    const huePush = hueDrift * Math.sin(tau) * gate * 0.01;
    for (let m = 0; m < mirrors; m++) {
      const a0 = m * slice + huePush;
      const a1 = a0 + slice * 0.78;
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a1);
      ctx.strokeStyle = hexToRgba(tint, (0.08 + z * 0.42) * intensity);
      ctx.lineWidth = lw;
      ctx.shadowColor = hexToRgba(tint, 0.2 * bloom * z);
      ctx.shadowBlur = 3 + bloom * 8 * z;
      ctx.stroke();
    }
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.12);
  core.addColorStop(0, hexToRgba("#fff4d2", 0.18 * intensity));
  core.addColorStop(0.45, hexToRgba(cyan, 0.12 * bloom));
  core.addColorStop(1, hexToRgba(magenta, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, maxR * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const kaleidoTunnelScene: Scene = {
  id: KALEIDO_TUNNEL_ID,
  name: "Kaleido · Tunnel",
  description: "Perspective kaleido tunnel — gated inward travel, neon rings",
  defaultParams: KALEIDO_TUNNEL_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const periodBeats = num(params.periodBeats, 16);
    const periodSec = num(params.periodSec, kaleidoBeatsToSec(periodBeats));
    const rotSpeed = num(params.rotSpeed, 0.7);
    stepKaleidoMotion(tunnelMotion, features, { flowSpeed: rotSpeed, periodSec, dt });
    paintKaleidoTunnel(
      ctxWrap.ctx,
      ctxWrap.width,
      ctxWrap.height,
      tunnelMotion.u,
      tunnelMotion.gate,
      tunnelMotion.kickEnv,
      features,
      params as Partial<KaleidoLookParams>,
    );
  },
};
