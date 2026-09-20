/**
 * Kaleido Loop — own family, not a LEXI variant.
 * Seamless period: phase = fract(timeSec / T). Rotation, zoom, and hue close.
 * Audio drives intensity only (bass→bloom/core, mid→edges, beat→pulse).
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";

export const KALEIDO_LOOP_ID = "kaleido-loop";
export const KALEIDO_LOOP_FAMILY = "Kaleido Loop";
export const KALEIDO_LOOP_MODE = "loop-seamless";
export const KALEIDO_LOOP_BPM = 120;

export type KaleidoPresetId = "gold-gate" | "pink-core" | "cyan-pulse";

export type KaleidoLoopParams = SceneParams & {
  mirrors: number;
  periodBeats: number;
  rotSpeed: number;
  bloom: number;
  hueDrift: number;
  pulseAmount: number;
};

export const KALEIDO_LOOP_PRESETS: Record<KaleidoPresetId, KaleidoLoopParams> = {
  "gold-gate": {
    intensity: 0.9,
    colorPrimary: "#d4b45a",
    colorSecondary: "#ff6ec7",
    speed: 1,
    complexity: 0.7,
    mirrors: 8,
    periodBeats: 8,
    rotSpeed: 1,
    bloom: 0.85,
    hueDrift: 14,
    pulseAmount: 0.32,
  },
  "pink-core": {
    intensity: 0.92,
    colorPrimary: "#ff6ec7",
    colorSecondary: "#d4b45a",
    speed: 1,
    complexity: 0.75,
    mirrors: 8,
    periodBeats: 8,
    rotSpeed: 1.15,
    bloom: 0.92,
    hueDrift: 18,
    pulseAmount: 0.42,
  },
  "cyan-pulse": {
    intensity: 0.88,
    colorPrimary: "#3de0ff",
    colorSecondary: "#ff6ec7",
    speed: 1,
    complexity: 0.65,
    mirrors: 4,
    periodBeats: 16,
    rotSpeed: 0.85,
    bloom: 0.8,
    hueDrift: 22,
    pulseAmount: 0.5,
  },
};

export function kaleidoPeriodSec(periodBeats: number, bpm = KALEIDO_LOOP_BPM): number {
  const beats = periodBeats === 16 ? 16 : 8;
  return (beats * 60) / bpm;
}

export function kaleidoLoopPhase(timeSec: number, periodSec: number): number {
  const T = Math.max(1e-6, periodSec);
  const u = timeSec / T;
  return u - Math.floor(u);
}

/** Closed-loop visual state. u=0 and u=1 (next period) are identical. */
export function kaleidoLoopState(timeSec: number, params: Partial<KaleidoLoopParams>) {
  const periodBeats = Number(params.periodBeats) === 16 ? 16 : 8;
  const T = kaleidoPeriodSec(periodBeats);
  const u = kaleidoLoopPhase(timeSec, T);
  const rotSpeed = Number(params.rotSpeed) || 1;
  const hueDrift = Number(params.hueDrift) || 0;
  const pulseAmount = Number(params.pulseAmount) || 0;
  const tau = u * Math.PI * 2;
  return {
    u,
    periodSec: T,
    rot: tau * rotSpeed,
    zoom: 1 + pulseAmount * 0.22 * Math.sin(tau),
    hue: hueDrift * Math.sin(tau),
    mirrors: Number(params.mirrors) === 4 ? 4 : 8,
  };
}

function hsl(h: number, s: number, l: number, a: number): string {
  return `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
}

export const kaleidoLoopScene: Scene = {
  id: KALEIDO_LOOP_ID,
  name: "Kaleido Loop",
  description: "Seamless neon kaleidoscope tunnel — Kaleido Loop family, not LEXI",
  defaultParams: KALEIDO_LOOP_PRESETS["gold-gate"],
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams) {
    const { ctx, width, height } = ctxWrap;
    const timeSec = (features.timeMs ?? 0) / 1000;
    const state = kaleidoLoopState(timeSec, params as Partial<KaleidoLoopParams>);
    const intensity = Number(params.intensity) || 1;
    const bloom = Number(params.bloom) || 0.8;
    const bass = features.bass ?? 0;
    const mid = features.mid ?? 0;
    const beat = features.beatPulse ?? features.kick ?? 0;
    const coreBoost = 1 + bass * 0.55 * intensity;
    const edgeBoost = 1 + mid * 0.4 * intensity;
    const pulse = 1 + beat * (Number(params.pulseAmount) || 0.3);

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(width, height) * 0.52 * state.zoom;

    ctx.save();
    ctx.fillStyle = "#040308";
    ctx.fillRect(0, 0, width, height);
    ctx.translate(cx, cy);
    ctx.rotate(state.rot);
    ctx.scale(state.zoom, state.zoom);

    const gold = String(params.colorPrimary || "#d4b45a");
    const pink = String(params.colorSecondary || "#ff6ec7");
    const layers = 10 + Math.floor(Number(params.complexity) * 8);
    const slice = (Math.PI * 2) / state.mirrors;

    for (let i = layers; i >= 1; i--) {
      const t = i / layers;
      const r = maxR * t * (0.72 + 0.12 * Math.sin(state.u * Math.PI * 2 + i * 0.35));
      const sides = 6;
      for (let m = 0; m < state.mirrors; m++) {
        ctx.save();
        ctx.rotate(m * slice);
        if (m % 2) ctx.scale(1, -1);
        ctx.beginPath();
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * slice;
          const wobble = 1 + Math.sin(a * 5 + state.u * Math.PI * 2) * 0.04 * edgeBoost;
          const x = Math.cos(a) * r * wobble;
          const y = Math.sin(a) * r * wobble * 0.92;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const hue = 38 + state.hue + t * 40;
        ctx.strokeStyle = hsl(hue, 85, 62, (0.07 + (1 - t) * 0.16) * intensity * edgeBoost);
        ctx.lineWidth = (1.1 + (1 - t) * 1.6) * pulse;
        ctx.shadowColor = hexToRgba(m % 2 ? pink : gold, 0.35 * bloom * coreBoost);
        ctx.shadowBlur = 8 + bloom * 18 * coreBoost;
        ctx.stroke();
        ctx.restore();
      }
    }

    const coreR = (18 + bass * 28 * intensity) * pulse;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 3.2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.18, hexToRgba(gold, 0.85 * coreBoost));
    g.addColorStop(0.42, hexToRgba(pink, 0.35 * bloom));
    g.addColorStop(0.7, "rgba(61,224,255,0.16)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    const poly = state.mirrors === 4 ? 4 : 8;
    for (let i = 0; i <= poly; i++) {
      const a = (i / poly) * Math.PI * 2 + state.rot * 0;
      const rr = coreR * (0.55 + 0.08 * Math.sin(state.u * Math.PI * 2));
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = hexToRgba("#3de0ff", 0.55 * pulse);
    ctx.lineWidth = 1.4 + beat * 2;
    ctx.shadowColor = "#3de0ff";
    ctx.shadowBlur = 10 * bloom;
    ctx.stroke();
    ctx.restore();
  },
};

/** Software frame for seamless tests (no DOM). After a 3×3 bloom, period wrap ≤ 1 LSB. */
export function renderKaleidoLoopPixels(
  width: number,
  height: number,
  timeSec: number,
  params: Partial<KaleidoLoopParams> = KALEIDO_LOOP_PRESETS["gold-gate"],
  audio: { bass?: number; mid?: number; beat?: number; intensity?: number } = {},
): Uint8ClampedArray {
  const state = kaleidoLoopState(timeSec, params);
  const intensity = audio.intensity ?? Number(params.intensity) ?? 1;
  const bloom = Number(params.bloom) ?? 0.85;
  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const beat = audio.beat ?? 0;
  const raw = new Uint8ClampedArray(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxR = Math.hypot(width, height) * 0.5;
  const slice = (Math.PI * 2) / state.mirrors;
  const coreBoost = 1 + bass * 0.55 * intensity;
  const edgeBoost = 1 + mid * 0.4 * intensity;
  const pulse = 1 + beat * (Number(params.pulseAmount) || 0.3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx = (x - cx) / state.zoom;
      let dy = (y - cy) / state.zoom;
      const c = Math.cos(-state.rot);
      const s = Math.sin(-state.rot);
      const rx = dx * c - dy * s;
      const ry = dx * s + dy * c;
      let ang = Math.atan2(ry, rx);
      const rad = Math.hypot(rx, ry);
      ang = ((ang % slice) + slice) % slice;
      if (ang > slice * 0.5) ang = slice - ang;
      const tunnel = 0.5 + 0.5 * Math.sin(rad / maxR * 14 + state.u * Math.PI * 2);
      const edge = Math.pow(ang / (slice * 0.5), 1.4) * edgeBoost;
      const core = Math.max(0, 1 - rad / (maxR * 0.22 * pulse)) * coreBoost;
      const gold = 212 + state.hue * 0.4;
      const pink = 180 - state.hue * 0.3;
      const r = Math.min(255, 8 + gold * (0.15 + tunnel * 0.35 * intensity) + core * 180 + edge * 40);
      const g = Math.min(255, 6 + 140 * tunnel * intensity * 0.35 + core * 140 + pink * 0.15);
      const b = Math.min(255, 14 + 80 * edge + core * 90 + 40 * bloom);
      const i = (y * width + x) * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }
  return boxBlur(raw, width, height, bloom > 0.5 ? 1 : 0);
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return src;
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let oy = -radius; oy <= radius; oy++) {
        const yy = Math.min(h - 1, Math.max(0, y + oy));
        for (let ox = -radius; ox <= radius; ox++) {
          const xx = Math.min(w - 1, Math.max(0, x + ox));
          const i = (yy * w + xx) * 4;
          r += src[i]!;
          g += src[i + 1]!;
          b += src[i + 2]!;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return out;
}

export function maxChannelDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let max = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    if (d > max) max = d;
  }
  return max;
}
