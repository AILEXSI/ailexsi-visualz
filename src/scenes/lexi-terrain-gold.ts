/**
 * LEXI Terrain Gold — own family. Not Kaleido, not resonance-wave.
 * Gold particle/wire dunes, horizon mountains, fog, bokeh. Loop-safe phase.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";

export const LEXI_TERRAIN_GOLD_ID = "lexi-terrain-gold";
export const LEXI_TERRAIN_GOLD_FAMILY = "LEXI Terrain Gold";
export const LEXI_TERRAIN_GOLD_MODE = "loop-seamless";
export const LEXI_TERRAIN_GOLD_PERIOD_SEC = 8;

export const LEXI_TERRAIN_GOLD_DEFAULTS: SceneParams = {
  intensity: 0.88,
  colorPrimary: "#d4b45a",
  colorSecondary: "#08070a",
  speed: 1,
  complexity: 0.72,
  bloom: 0.78,
  periodSec: LEXI_TERRAIN_GOLD_PERIOD_SEC,
  waveHeight: 0.55,
  fog: 0.42,
  sparkle: 0.34,
};

export function terrainPhase(timeSec: number, periodSec = LEXI_TERRAIN_GOLD_PERIOD_SEC): number {
  const T = Math.max(1e-6, periodSec);
  const u = timeSec / T;
  return u - Math.floor(u);
}

function heroDensity(width: number, height: number, complexity: number): number {
  const area = width * height;
  const hero = area >= 1280 * 640 ? 1 : 0.55;
  return hero * (0.65 + complexity * 0.55);
}

export const lexiTerrainGoldScene: Scene = {
  id: LEXI_TERRAIN_GOLD_ID,
  name: "Terrain Gold",
  description: "Gold particle dunes to a dark horizon — LEXI Terrain Gold, not Kaleido",
  defaultParams: LEXI_TERRAIN_GOLD_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams) {
    const { ctx, width, height } = ctxWrap;
    const timeSec = (features.timeMs ?? 0) / 1000;
    const period = Number(params.periodSec) || LEXI_TERRAIN_GOLD_PERIOD_SEC;
    const u = terrainPhase(timeSec, period);
    const tau = u * Math.PI * 2;
    const intensity = Number(params.intensity) || 1;
    const gold = String(params.colorPrimary || "#d4b45a");
    const fogAmt = Number(params.fog) || 0.42;
    const waveBase = Number(params.waveHeight) || 0.55;
    const sparkleAmt = Number(params.sparkle) || 0.34;
    const bass = features.bass ?? 0;
    const mid = features.mid ?? 0;
    const high = features.treble ?? 0;
    const dens = heroDensity(width, height, Number(params.complexity) || 0.7);
    const waveH = waveBase * (0.72 + bass * 0.55 * intensity);
    const lineGlow = 0.22 + mid * 0.55 * intensity;
    const spike = high * sparkleAmt * intensity;

    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#05040a");
    sky.addColorStop(0.42, "#0c0a12");
    sky.addColorStop(0.62, "#141018");
    sky.addColorStop(1, "#07060a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const horizon = height * 0.46;
    const parx = Math.sin(tau) * 5;

    ctx.beginPath();
    ctx.moveTo(0, horizon + 8);
    const peaks = 7;
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * width + parx;
      const y = horizon - (18 + (i % 3) * 14 + Math.sin(i * 1.7) * 10);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = "#06050a";
    ctx.fill();

    ctx.strokeStyle = hexToRgba(gold, 0.12 * intensity);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.stroke();

    const rows = Math.round(10 + dens * 10);
    const cols = Math.round(14 + dens * 12);
    const flow = u;
    for (let r = 0; r < rows; r++) {
      const z = (r + flow * rows) % rows;
      const t = z / rows;
      const y = horizon + t * t * (height - horizon);
      const spread = 0.18 + t * 0.92;
      const amp = (1 - t) * 22 * waveH * (0.35 + t);
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const nx = c / cols;
        const x = width * 0.5 + (nx - 0.5) * width * spread;
        const dune = Math.sin(nx * Math.PI * 3 + t * 7 + tau) * amp;
        const yy = y + dune;
        if (c === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = hexToRgba(gold, (0.05 + (1 - t) * 0.22) * lineGlow);
      ctx.lineWidth = 0.7 + (1 - t) * 1.1;
      ctx.stroke();

      if (dens > 0.7) {
        ctx.strokeStyle = hexToRgba(gold, 0.04 * lineGlow);
        ctx.beginPath();
        const x0 = width * 0.5 + (-0.5) * width * spread;
        const x1 = width * 0.5 + 0.5 * width * spread;
        ctx.moveTo(width / 2, horizon);
        ctx.lineTo(x0, y);
        ctx.moveTo(width / 2, horizon);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
    }

    const particles = Math.round(40 * dens);
    for (let i = 0; i < particles; i++) {
      const seed = (i * 17 + 3) / particles;
      const zt = (seed + flow) % 1;
      const x = width * 0.5 + (Math.sin(i * 2.3) * 0.48) * width * (0.2 + zt);
      const y = horizon + zt * zt * (height - horizon) * 0.95;
      const s = 0.6 + (1 - zt) * 1.8 + spike * 1.4;
      ctx.fillStyle = hexToRgba(gold, (0.15 + (1 - zt) * 0.45) * intensity);
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }

    const bokeh = Math.round((dens > 0.8 ? 18 : 8) * dens);
    for (let i = 0; i < bokeh; i++) {
      const bx = ((i * 97) % 1000) / 1000 * width;
      const by = horizon + ((i * 53) % 700) / 700 * (height - horizon);
      const br = 3 + (i % 5) * 2.2;
      ctx.fillStyle = hexToRgba(gold, 0.04 + spike * 0.08);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    const fog = ctx.createLinearGradient(0, horizon, 0, height);
    const drift = 0.5 + 0.5 * Math.sin(tau);
    fog.addColorStop(0, `rgba(12,10,14,${0.08 * fogAmt})`);
    fog.addColorStop(0.45 + drift * 0.08, `rgba(20,16,12,${0.28 * fogAmt})`);
    fog.addColorStop(1, `rgba(6,5,8,${0.55 * fogAmt})`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 4, width, height - horizon + 4);

    if (spike > 0.05) {
      const sparks = Math.round(8 + spike * 20 * dens);
      for (let i = 0; i < sparks; i++) {
        const sx = width * (0.15 + ((i * 0.137 + u) % 0.7));
        const sy = horizon + 20 + ((i * 41) % (height * 0.4));
        ctx.fillStyle = hexToRgba("#ffe6a8", 0.25 + spike * 0.4);
        ctx.fillRect(sx, sy, 1.2, 1.2 + spike * 3);
      }
    }
    ctx.restore();
  },
};
