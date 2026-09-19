/**
 * LEXI Terrain Gold · Field Draw Plus (`lexi-terrain-gold-field-plus`).
 * Retention: does not overwrite MotionGate, Field Draw v1, or P12.
 *
 * PATH A compare variant — closer to the hero reference, still Field Draw law:
 * no filled dune skin, no mesh shade. Strokes + points + peak filaments only.
 *
 * LAW: Pose = landscape. Motion = 100% audio via motionGate (shared stepFieldMotion).
 * Gate=0 → freeze. timeMs is decay/integration only.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import {
  LEXI_TERRAIN_GOLD_CRESTS,
  LEXI_TERRAIN_GOLD_DEFAULTS,
  LEXI_TERRAIN_GOLD_FAMILY,
  LEXI_TERRAIN_GOLD_MODE,
  LEXI_TERRAIN_GOLD_PERIOD_SEC,
  LEXI_TERRAIN_GOLD_VOID,
  createTerrainMotionState,
  terrainCappedBloom,
  terrainHeight,
  terrainParx,
  terrainSurfaceHash,
  terrainSurfaceKey,
  type TerrainDeform,
} from "./lexi-terrain-gold";
import {
  LEXI_TERRAIN_GOLD_FIELD_KICK_TAU,
  fieldLowMid,
  fieldSparkBudget,
  stepFieldMotion,
} from "./lexi-terrain-gold-field";

export const LEXI_TERRAIN_GOLD_FIELD_PLUS_ID = "lexi-terrain-gold-field-plus";
export const LEXI_TERRAIN_GOLD_FIELD_PLUS_FAMILY = LEXI_TERRAIN_GOLD_FAMILY;
export const LEXI_TERRAIN_GOLD_FIELD_PLUS_MODE = LEXI_TERRAIN_GOLD_MODE;
export const LEXI_TERRAIN_GOLD_FIELD_PLUS_PERIOD_SEC = LEXI_TERRAIN_GOLD_PERIOD_SEC;
export const LEXI_TERRAIN_GOLD_FIELD_PLUS_KICK_TAU = LEXI_TERRAIN_GOLD_FIELD_KICK_TAU;

export const LEXI_TERRAIN_GOLD_FIELD_PLUS_DEFAULTS: SceneParams = {
  ...LEXI_TERRAIN_GOLD_DEFAULTS,
  surfaceDensity: 1.72,
  fogDensity: 0.82,
  mountainScale: 1.42,
};

export {
  terrainHeight,
  terrainSurfaceKey,
  terrainSurfaceHash,
  createTerrainMotionState,
  fieldLowMid,
  stepFieldMotion,
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Harder ridge vs valley than Field Draw v1.
 * v1 threshold 0.52 ** 1.6 — Plus uses 0.64 ** 2.8 so valleys stay almost dead.
 */
export function plusSampleBrightness(
  nx: number,
  z: number,
  u: number,
  deform: TerrainDeform,
  opts: { depthAttenuation: number; gate: number },
): { h: number; slope: number; ridgeMask: number; bright: number; crest: number } {
  const eps = 0.01;
  const h = terrainHeight(nx, z, u, deform);
  const hl = terrainHeight(nx - eps, z, u, deform);
  const hr = terrainHeight(nx + eps, z, u, deform);
  const slope = Math.min(1, Math.abs(hr - hl) / (2 * eps) * 0.2);
  const crest = clamp01((h + 1) * 0.5);
  const ridgeMask = Math.max(0, (crest - 0.64) / 0.36) ** 2.8;
  const depthAtten = (1 - opts.depthAttenuation) + opts.depthAttenuation * clamp01(z);
  const gateTerm = 0.18 + 0.82 * clamp01(opts.gate);
  const bright = slope * depthAtten * ridgeMask * gateTerm;
  return { h, slope, ridgeMask, bright, crest };
}

export function plusMatterPlan(
  width: number,
  height: number,
  params: Partial<SceneParams> = LEXI_TERRAIN_GOLD_FIELD_PLUS_DEFAULTS,
): { horizonY: number; slices: number; cols: number } {
  const density = num(params.surfaceDensity, 1.72);
  const area = Math.max(0.72, Math.min(1, Math.sqrt((width * height) / (1920 * 1080))));
  return {
    horizonY: num(params.horizonY, 0.42),
    slices: Math.max(68, Math.round(88 * density * area)),
    cols: Math.max(40, Math.round(56 * density * area)),
  };
}

function screenX(nx: number, z: number, width: number): number {
  const spread = 0.16 + z * 1.22;
  return width * 0.5 + (nx - 0.5) * width * spread;
}

function groundY(horizon: number, height: number, z: number): number {
  return horizon + z * z * (height - horizon);
}

/** Stronger Z: pack samples near the camera, thin the far field. */
function plusDepth(i: number, slices: number): number {
  const t = i / Math.max(1, slices);
  return t ** 2.55;
}

function plusCols(baseCols: number, z: number): number {
  return Math.max(8, Math.round(baseCols * (0.18 + 0.82 * z)));
}

function paintSky(ctx: CanvasRenderingContext2D, width: number, height: number, horizon: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#050301");
  sky.addColorStop(horizon / height, "#080502");
  sky.addColorStop(1, LEXI_TERRAIN_GOLD_VOID);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

/** Stronger dark mountain silhouette. Almost no motion. */
function paintHillSilhouette(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  parx: number,
  scale: number,
): void {
  const back: Array<[number, number]> = [
    [0.0, 8],
    [0.1, 28],
    [0.2, 18],
    [0.32, 62],
    [0.44, 22],
    [0.56, 48],
    [0.7, 72],
    [0.84, 30],
    [1.02, 10],
  ];
  const front: Array<[number, number]> = [
    [0.0, 3],
    [0.08, 16],
    [0.16, 10],
    [0.24, 46],
    [0.34, 28],
    [0.42, 38],
    [0.52, 8],
    [0.62, 24],
    [0.72, 56],
    [0.82, 26],
    [0.9, 40],
    [1.03, 6],
  ];
  ctx.beginPath();
  ctx.moveTo(-12, horizon);
  for (const [nx, rise] of back) ctx.lineTo(nx * width + parx * 0.4, horizon - rise * scale * 1.15);
  ctx.lineTo(width + 12, horizon);
  ctx.closePath();
  ctx.fillStyle = "#060402";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, horizon);
  for (const [nx, rise] of front) ctx.lineTo(nx * width + parx, horizon - rise * scale);
  ctx.lineTo(width + 12, horizon);
  ctx.closePath();
  ctx.fillStyle = "#090603";
  ctx.fill();
}

/** Fog banks that catch crest gold — no midframe sun disk. */
function paintCrestFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  y0: number,
  h: number,
  density: number,
  gold: number,
): void {
  const fog = ctx.createLinearGradient(0, y0, 0, y0 + h);
  fog.addColorStop(0, hexToRgba("#ffd27a", 0.055 * density * gold));
  fog.addColorStop(0.35, hexToRgba("#c47a12", 0.16 * density * gold));
  fog.addColorStop(0.72, `rgba(8,5,2,${0.4 * density})`);
  fog.addColorStop(1, `rgba(8,5,2,${0.08 * density})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, y0, width, h);
}

function strokeTint(bright: number): string {
  if (bright > 0.38) return LEXI_TERRAIN_GOLD_CRESTS.near;
  if (bright > 0.16) return LEXI_TERRAIN_GOLD_CRESTS.mid;
  return LEXI_TERRAIN_GOLD_CRESTS.deep;
}

type FieldHigh = { x: number; y: number; z: number; bright: number; crest: number; nx: number };

/**
 * PLUS DRAW PATH — polylines + dense crest points in the heightfield.
 * No dune fill. Valleys skipped (ridgeMask floor).
 */
function strokePlusRow(
  ctx: CanvasRenderingContext2D,
  z: number,
  u: number,
  cols: number,
  width: number,
  height: number,
  horizon: number,
  amp: number,
  deform: TerrainDeform,
  attK: number,
  gate: number,
  highs: FieldHigh[],
): void {
  const n = plusCols(cols, z);
  const yBase = groundY(horizon, height, z);
  let prevX = 0;
  let prevY = 0;
  let prevB = 0;
  for (let c = 0; c <= n; c++) {
    const nx = c / n;
    const sample = plusSampleBrightness(nx, z, u, deform, { depthAttenuation: attK, gate });
    const x = screenX(nx, z, width);
    const y = yBase - sample.h * amp * (0.18 + z * 0.86);
    if (c > 0 && (prevB >= 0.02 || sample.bright >= 0.02)) {
      const b = Math.max(prevB, sample.bright);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hexToRgba(strokeTint(b), Math.min(0.94, 0.14 + b * 0.82));
      ctx.lineWidth = (0.22 + z * 2.05) * (0.55 + b * 0.9);
      ctx.stroke();
    }
    if (sample.ridgeMask > 0.1 && sample.bright > 0.03) {
      const pr = 0.85 + z * 1.55;
      ctx.fillStyle = hexToRgba(LEXI_TERRAIN_GOLD_CRESTS.near, Math.min(0.8, 0.2 + sample.bright * 0.7));
      ctx.fillRect(x - pr * 0.5, y - pr * 0.5, pr, pr);
      if (c > 0 && prevB > 0.03) {
        const mx = (prevX + x) * 0.5;
        const my = (prevY + y) * 0.5;
        ctx.fillRect(mx - pr * 0.35, my - pr * 0.35, pr * 0.7, pr * 0.7);
      }
      highs.push({ x, y, z, bright: sample.bright, crest: sample.crest, nx });
    }
    prevX = x;
    prevY = y;
    prevB = sample.bright;
  }
}

/** Vertical filaments rising from peaks — readable, not frequency bars. */
function strokePeakFilaments(ctx: CanvasRenderingContext2D, highs: FieldHigh[]): void {
  const peaks = highs
    .filter((h) => h.crest > 0.74 && h.z > 0.28)
    .sort((a, b) => b.crest - a.crest)
    .slice(0, 14);
  for (const p of peaks) {
    const rise = 16 + p.z * 48;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - rise);
    ctx.strokeStyle = hexToRgba(LEXI_TERRAIN_GOLD_CRESTS.near, Math.min(0.55, 0.12 + p.bright * 0.42));
    ctx.lineWidth = 0.7 + p.z * 1.35;
    ctx.stroke();
  }
}

function paintSparks(ctx: CanvasRenderingContext2D, highs: FieldHigh[], budget: number): void {
  if (budget <= 0 || highs.length === 0) return;
  const ranked = highs.filter((h) => h.crest > 0.72 && h.z > 0.45).sort((a, b) => b.bright - a.bright);
  const n = Math.min(budget, ranked.length);
  for (let i = 0; i < n; i++) {
    const p = ranked[i]!;
    ctx.fillStyle = hexToRgba("#fff4d2", Math.min(0.5, 0.16 + p.bright * 0.32));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1 + p.z * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const plusMotion = createTerrainMotionState();

export const lexiTerrainGoldFieldPlusScene: Scene = {
  id: LEXI_TERRAIN_GOLD_FIELD_PLUS_ID,
  name: "Terrain Gold · Field Draw Plus",
  description: "Field Draw Plus — harder ridges, peak filaments, stronger Z. No dune fill.",
  defaultParams: LEXI_TERRAIN_GOLD_FIELD_PLUS_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const { ctx, width, height } = ctxWrap;
    const period = num(params.periodSec, LEXI_TERRAIN_GOLD_FIELD_PLUS_PERIOD_SEC);
    const flowSpeed = num(params.flowSpeed, 0.35);
    stepFieldMotion(plusMotion, features, { flowSpeed, periodSec: period, dt });
    const u = plusMotion.u;
    const gate = plusMotion.gate;
    const deform: TerrainDeform = { bass: features.bass ?? 0, kickEnv: plusMotion.kickEnv };
    const bloom = terrainCappedBloom(params);
    const fogAmt = num(params.fogDensity, 0.82);
    const fogH = num(params.fogHeight, 0.38);
    const attK = num(params.depthAttenuation, 0.62);
    const horizonY = num(params.horizonY, 0.42);
    const mountainScale = num(params.mountainScale, 1.42);
    const density = num(params.surfaceDensity, 1.72);
    const plan = plusMatterPlan(width, height, params);
    const horizon = height * horizonY;
    const parx = terrainParx(u) * 0.02;
    const slices = plan.slices;
    const cols = plan.cols;
    const amp = height * 0.08 * density * 0.7;
    const sparkN = fieldSparkBudget(features, num(params.complexity, 0.8));
    const fogGold = 0.28 + 0.72 * gate;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    paintSky(ctx, width, height, horizon);
    paintHillSilhouette(ctx, width, horizon, parx, mountainScale);

    const rim = ctx.createLinearGradient(0, horizon - 10, 0, horizon + 8);
    rim.addColorStop(0, hexToRgba("#c47a12", 0.04 * bloom * fogGold));
    rim.addColorStop(1, hexToRgba("#0a0602", 0));
    ctx.fillStyle = rim;
    ctx.fillRect(0, horizon - 10, width, 18);

    const highs: FieldHigh[] = [];
    for (let i = 1; i <= slices; i++) {
      const z = plusDepth(i, slices);
      if (z < 0.04 && i % 3 !== 0) continue;
      strokePlusRow(ctx, z, u, cols, width, height, horizon, amp, deform, attK, gate, highs);
      if (i === Math.round(slices * 0.58)) {
        paintCrestFog(ctx, width, horizon + (height - horizon) * 0.08, (height - horizon) * fogH * 0.48, fogAmt * 0.7, fogGold);
      }
      if (i === Math.round(slices * 0.84)) {
        paintCrestFog(ctx, width, horizon + (height - horizon) * 0.3, (height - horizon) * fogH, fogAmt, fogGold);
      }
    }

    strokePeakFilaments(ctx, highs);
    paintSparks(ctx, highs, sparkN);
    ctx.restore();
  },
};
