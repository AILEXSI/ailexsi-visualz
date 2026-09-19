/**
 * LEXI Terrain Gold — quality language (Pass 1 landscape + Pass 2 depth/atmosphere).
 * Gold Terrain is the reference, not a texture to copy. Not Kaleido / radar / scope.
 * Pass 3+ (kick fireworks, transient bursts) is deferred. Audio is a light field influence.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba, mixHex } from "../draw/color";

export const LEXI_TERRAIN_GOLD_ID = "lexi-terrain-gold";
export const LEXI_TERRAIN_GOLD_FAMILY = "LEXI Terrain Gold";
export const LEXI_TERRAIN_GOLD_MODE = "loop-seamless";
export const LEXI_TERRAIN_GOLD_PERIOD_SEC = 12;

export const LEXI_TERRAIN_GOLD_CRESTS = {
  deep: "#c47a12",
  mid: "#ffd27a",
  near: "#fff4d2",
} as const;

export const LEXI_TERRAIN_GOLD_VOID = "#0a0602";

/** Pass 1+2 implemented. Pass 3+ (heavy audio fireworks) deferred. */
export const LEXI_TERRAIN_GOLD_PASS = { implemented: [1, 2] as const, deferred: [3] as const };

/** Named defaults — mapped into SceneParams and the catalog entry. */
export const LEXI_TERRAIN_GOLD_DEFAULTS: SceneParams = {
  intensity: 0.86,
  colorPrimary: LEXI_TERRAIN_GOLD_CRESTS.mid,
  colorSecondary: LEXI_TERRAIN_GOLD_VOID,
  speed: 1,
  complexity: 0.8,
  surfaceDensity: 1.4,
  depthAttenuation: 0.62,
  flowSpeed: 0.35,
  fogDensity: 0.78,
  fogHeight: 0.38,
  bloomCap: 0.55,
  bloom: 0.55,
  horizonY: 0.42,
  mountainScale: 1.15,
  periodSec: LEXI_TERRAIN_GOLD_PERIOD_SEC,
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function terrainPhase(timeSec: number, periodSec = LEXI_TERRAIN_GOLD_PERIOD_SEC): number {
  const T = Math.max(1e-6, periodSec);
  const u = timeSec / T;
  return u - Math.floor(u);
}

export function terrainCappedBloom(params: Partial<SceneParams> = LEXI_TERRAIN_GOLD_DEFAULTS): number {
  const cap = num(params.bloomCap, 0.55);
  return Math.min(cap, num(params.bloom, cap));
}

/**
 * Multi-scale dune height. Function of space + loop phase only — holds at ~0 audio.
 * `u` appears only inside 2π-periodic terms so frame 0 == period end.
 */
export function terrainHeight(nx: number, z: number, u: number, flowSpeed = 0.35): number {
  const zw = z - Math.floor(z);
  const tau = u * Math.PI * 2;
  const travel = 0.75 + flowSpeed;
  const roll = Math.sin((nx * 0.7 + zw * 1.05) * Math.PI * 2 + tau);
  const dune = Math.sin((nx * 1.45 + zw * 2.15) * Math.PI * 2 + tau);
  const ridge = Math.sin((nx * 2.55 - zw * 3.05) * Math.PI * 2 + 0.9);
  const grain = Math.sin((nx * 4.2 + zw * 1.7) * Math.PI * 2 + tau);
  const peak = Math.max(0, dune * 0.62 + ridge * 0.38);
  return roll * 0.22 + (dune * 0.36 + ridge * 0.22) * travel + grain * 0.08 + peak * peak * 0.2;
}

export function terrainSurfaceKey(u: number, rows = 24, cols = 16): number[] {
  const phase = u - Math.floor(u);
  const out: number[] = [];
  for (let r = 0; r < rows; r++) {
    const z = (r / rows + phase) % 1;
    for (let c = 0; c <= cols; c++) out.push(terrainHeight(c / cols, z, phase));
  }
  return out;
}

export function terrainMatterPlan(
  width: number,
  height: number,
  params: Partial<SceneParams> = LEXI_TERRAIN_GOLD_DEFAULTS,
): {
  horizonY: number;
  slices: number;
  cols: number;
  layers: number;
  particles: number;
  bloomCap: number;
  periodSec: number;
  voidHex: string;
  audioListen: number;
} {
  const density = num(params.surfaceDensity, 1.4);
  const area = Math.max(0.72, Math.min(1, Math.sqrt((width * height) / (1920 * 1080))));
  const slices = Math.round(52 * density * area);
  const cols = Math.round(36 * density * area);
  return {
    horizonY: num(params.horizonY, 0.42),
    slices: Math.max(40, slices),
    cols: Math.max(28, cols),
    layers: 4,
    particles: Math.round(10 + 6 * area),
    bloomCap: num(params.bloomCap, 0.55),
    periodSec: num(params.periodSec, LEXI_TERRAIN_GOLD_PERIOD_SEC),
    voidHex: LEXI_TERRAIN_GOLD_VOID,
    audioListen: 0.07,
  };
}

function depthBright(z: number, attenuation: number): number {
  return (1 - attenuation) + attenuation * Math.max(0, Math.min(1, z));
}

function screenX(nx: number, z: number, width: number): number {
  const spread = 0.2 + z * 1.08;
  return width * 0.5 + (nx - 0.5) * width * spread;
}

function groundY(horizon: number, height: number, z: number): number {
  return horizon + z * z * (height - horizon);
}

function surfaceTint(crest: number, z: number): string {
  const t = Math.max(0, Math.min(1, crest));
  if (t < 0.28) return mixHex(LEXI_TERRAIN_GOLD_VOID, LEXI_TERRAIN_GOLD_CRESTS.deep, t / 0.28);
  if (t < 0.62) {
    const u = (t - 0.28) / 0.34;
    return mixHex(LEXI_TERRAIN_GOLD_CRESTS.deep, LEXI_TERRAIN_GOLD_CRESTS.mid, u);
  }
  const nearMix = Math.max(0, (z - 0.35) / 0.65);
  return mixHex(LEXI_TERRAIN_GOLD_CRESTS.mid, LEXI_TERRAIN_GOLD_CRESTS.near, (t - 0.62) / 0.38 * (0.35 + nearMix * 0.65));
}

function paintSky(ctx: CanvasRenderingContext2D, width: number, height: number, horizon: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#070502");
  sky.addColorStop(horizon / height, "#0a0602");
  sky.addColorStop(1, LEXI_TERRAIN_GOLD_VOID);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function paintMidGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  bloom: number,
): void {
  const rx = width * 0.36;
  const ry = Math.max(18, horizon * 0.42);
  const g = ctx.createRadialGradient(width * 0.5, horizon, 2, width * 0.5, horizon, rx);
  const a = 0.14 + bloom * 0.22;
  g.addColorStop(0, hexToRgba("#fff4d2", Math.min(0.42, a + 0.06)));
  g.addColorStop(0.4, hexToRgba("#ffd27a", a * 0.45));
  g.addColorStop(1, hexToRgba("#c47a12", 0));
  ctx.save();
  ctx.translate(width * 0.5, horizon);
  ctx.scale(1, ry / rx);
  ctx.translate(-width * 0.5, -horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon - ry, width, ry * 2);
  ctx.restore();
}

function paintHills(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  parx: number,
  scale: number,
): void {
  const peaks: Array<[number, number]> = [
    [0.0, 3],
    [0.08, 14],
    [0.14, 8],
    [0.22, 40],
    [0.3, 24],
    [0.36, 34],
    [0.44, 9],
    [0.5, 5],
    [0.58, 20],
    [0.66, 48],
    [0.74, 22],
    [0.8, 36],
    [0.88, 12],
    [0.95, 20],
    [1.03, 4],
  ];
  ctx.beginPath();
  ctx.moveTo(-10, horizon);
  for (const [nx, rise] of peaks) {
    ctx.lineTo(nx * width + parx, horizon - rise * scale);
  }
  ctx.lineTo(width + 10, horizon);
  ctx.closePath();
  ctx.fillStyle = "#0d0804";
  ctx.fill();
}

function paintFogBank(
  ctx: CanvasRenderingContext2D,
  width: number,
  y0: number,
  h: number,
  density: number,
  gold: number,
): void {
  const fog = ctx.createLinearGradient(0, y0, 0, y0 + h);
  fog.addColorStop(0, hexToRgba("#ffd27a", 0.03 * density * gold));
  fog.addColorStop(0.28, hexToRgba("#c47a12", 0.14 * density));
  fog.addColorStop(0.7, `rgba(10,6,2,${0.38 * density})`);
  fog.addColorStop(1, `rgba(10,6,2,${0.12 * density})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, y0, width, h);
}

function sampleRow(
  z: number,
  u: number,
  cols: number,
  width: number,
  horizon: number,
  height: number,
  amp: number,
  flowSpeed = 0.35,
): { xs: number[]; ys: number[]; crests: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const crests: number[] = [];
  const yBase = groundY(horizon, height, z);
  for (let c = 0; c <= cols; c++) {
    const nx = c / cols;
    const h = terrainHeight(nx, z + u, u, flowSpeed);
    const crest = Math.max(0, Math.min(1, (h + 1) * 0.5));
    xs.push(screenX(nx, z, width));
    ys.push(yBase - h * amp * (0.2 + z * 0.8));
    crests.push(crest);
  }
  return { xs, ys, crests };
}

function fillRibbon(
  ctx: CanvasRenderingContext2D,
  a: { xs: number[]; ys: number[]; crests: number[] },
  b: { xs: number[]; ys: number[]; crests: number[] },
  z: number,
  att: number,
): void {
  const n = a.xs.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(a.xs[0]!, a.ys[0]!);
  for (let i = 1; i < n; i++) ctx.lineTo(a.xs[i]!, a.ys[i]!);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(b.xs[i]!, b.ys[i]!);
  ctx.closePath();
  let crest = 0;
  for (let i = 0; i < n; i++) crest += a.crests[i]!;
  crest /= n;
  const tint = surfaceTint(crest, z);
  const alpha = (0.2 + crest * 0.42 + z * 0.18) * att;
  ctx.fillStyle = hexToRgba(tint, Math.min(0.82, alpha));
  ctx.fill();
}

function paintCrestGlow(
  ctx: CanvasRenderingContext2D,
  row: { xs: number[]; ys: number[]; crests: number[] },
  z: number,
  att: number,
): void {
  if (z < 0.22) return;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < row.xs.length; i++) {
    if ((row.crests[i] ?? 0) < 0.58) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(row.xs[i]!, row.ys[i]!);
      started = true;
    } else ctx.lineTo(row.xs[i]!, row.ys[i]!);
  }
  ctx.strokeStyle = hexToRgba(
    z > 0.55 ? LEXI_TERRAIN_GOLD_CRESTS.near : LEXI_TERRAIN_GOLD_CRESTS.mid,
    (0.08 + z * 0.2) * att,
  );
  ctx.lineWidth = 1.1 + z * 1.8;
  ctx.stroke();
}

export const lexiTerrainGoldScene: Scene = {
  id: LEXI_TERRAIN_GOLD_ID,
  name: "Terrain Gold",
  description: "Continuous gold dunes, depth fog — LEXI Terrain Gold, not Kaleido",
  defaultParams: LEXI_TERRAIN_GOLD_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams) {
    const { ctx, width, height } = ctxWrap;
    const timeSec = (features.timeMs ?? 0) / 1000;
    const period = num(params.periodSec, LEXI_TERRAIN_GOLD_PERIOD_SEC);
    const u = terrainPhase(timeSec, period);
    const tau = u * Math.PI * 2;
    const bloom = terrainCappedBloom(params);
    const fogAmt = num(params.fogDensity, 0.78);
    const fogH = num(params.fogHeight, 0.38);
    const attK = num(params.depthAttenuation, 0.62);
    const horizonY = num(params.horizonY, 0.42);
    const mountainScale = num(params.mountainScale, 1.15);
    const density = num(params.surfaceDensity, 1.4);
    const flowSpeed = num(params.flowSpeed, 0.35);
    const listen = 0.07;
    const ampLift = 1 + (features.bass ?? 0) * listen;
    const plan = terrainMatterPlan(width, height, params);
    const horizon = height * horizonY;
    const parx = Math.sin(tau) * 3.2;
    const slices = plan.slices;
    const cols = plan.cols;
    const amp = height * 0.078 * density * 0.72 * ampLift;

    ctx.save();
    paintSky(ctx, width, height, horizon);
    paintMidGlow(ctx, width, horizon, bloom);
    paintHills(ctx, width, horizon, parx, mountainScale);

    const haze = ctx.createLinearGradient(0, horizon - 28, 0, horizon + height * 0.12);
    haze.addColorStop(0, hexToRgba("#c47a12", 0.04 * fogAmt));
    haze.addColorStop(1, hexToRgba("#0a0602", 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 28, width, height * 0.16);

    let prev = sampleRow(0, u, cols, width, horizon, height, amp, flowSpeed);
    for (let i = 1; i <= slices; i++) {
      const z = i / slices;
      const row = sampleRow(z, u, cols, width, horizon, height, amp, flowSpeed);
      const att = depthBright(z, attK);
      fillRibbon(ctx, prev, row, z, att);
      if (i % 2 === 0) paintCrestGlow(ctx, row, z, att);
      prev = row;
      if (i === Math.round(slices * 0.34)) {
        paintFogBank(ctx, width, horizon + (height - horizon) * 0.08, (height - horizon) * fogH * 0.55, fogAmt * 0.7, 0.8);
      }
      if (i === Math.round(slices * 0.68)) {
        paintFogBank(ctx, width, horizon + (height - horizon) * 0.28, (height - horizon) * fogH, fogAmt, 1);
      }
    }

    const motes = plan.particles;
    for (let i = 0; i < motes; i++) {
      const seed = (i * 19 + 5) / motes;
      const z = 0.55 + 0.42 * seed;
      const x = width * (0.12 + ((i * 0.173 + u * 0.02) % 0.76));
      const y = groundY(horizon, height, z) - 10 - (i % 5) * 7;
      ctx.fillStyle = hexToRgba("#fff4d2", 0.06 + z * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + z * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};
