/**
 * LEXI Terrain Gold · Hero Look (`lexi-terrain-gold-hero`).
 * Retention: does not overwrite MotionGate, Field Draw, Field Draw Plus, or P12.
 *
 * PATH B canvas preview of a Cycles-class look. Not Blender.
 * Thick emissive ridge ribbons, volume-ish fog, sparse bokeh, dark mountain
 * silhouette, small warm horizon area light. Ridge-only emission.
 *
 * LAW: Pose = landscape. Motion = 100% audio via motionGate (shared stepFieldMotion).
 * Gate=0 → freeze. timeMs is decay/integration only. No camera shake. No EQ coloring.
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

export const LEXI_TERRAIN_GOLD_HERO_ID = "lexi-terrain-gold-hero";
export const LEXI_TERRAIN_GOLD_HERO_FAMILY = LEXI_TERRAIN_GOLD_FAMILY;
export const LEXI_TERRAIN_GOLD_HERO_MODE = LEXI_TERRAIN_GOLD_MODE;
export const LEXI_TERRAIN_GOLD_HERO_PERIOD_SEC = LEXI_TERRAIN_GOLD_PERIOD_SEC;
export const LEXI_TERRAIN_GOLD_HERO_KICK_TAU = LEXI_TERRAIN_GOLD_FIELD_KICK_TAU;

export const LEXI_TERRAIN_GOLD_HERO_DEFAULTS: SceneParams = {
  ...LEXI_TERRAIN_GOLD_DEFAULTS,
  surfaceDensity: 1.48,
  fogDensity: 0.88,
  fogHeight: 0.44,
  bloomCap: 0.5,
  bloom: 0.5,
  mountainScale: 1.38,
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

/** Ridge-only emission. Valleys return ~0 mask. */
export function heroSampleBrightness(
  nx: number,
  z: number,
  u: number,
  deform: TerrainDeform,
  opts: { depthAttenuation: number; gate: number },
): { h: number; slope: number; ridgeMask: number; bright: number; crest: number } {
  const eps = 0.011;
  const h = terrainHeight(nx, z, u, deform);
  const hl = terrainHeight(nx - eps, z, u, deform);
  const hr = terrainHeight(nx + eps, z, u, deform);
  const slope = Math.min(1, Math.abs(hr - hl) / (2 * eps) * 0.16);
  const crest = clamp01((h + 1) * 0.5);
  const ridgeMask = Math.max(0, (crest - 0.6) / 0.4) ** 2.2;
  const depthAtten = (1 - opts.depthAttenuation) + opts.depthAttenuation * clamp01(z);
  const gateTerm = 0.22 + 0.78 * clamp01(opts.gate);
  const bright = slope * depthAtten * ridgeMask * gateTerm;
  return { h, slope, ridgeMask, bright, crest };
}

export function heroMatterPlan(
  width: number,
  height: number,
  params: Partial<SceneParams> = LEXI_TERRAIN_GOLD_HERO_DEFAULTS,
): { horizonY: number; slices: number; cols: number } {
  const density = num(params.surfaceDensity, 1.48);
  const area = Math.max(0.72, Math.min(1, Math.sqrt((width * height) / (1920 * 1080))));
  return {
    horizonY: num(params.horizonY, 0.42),
    slices: Math.max(48, Math.round(58 * density * area)),
    cols: Math.max(32, Math.round(42 * density * area)),
  };
}

function screenX(nx: number, z: number, width: number): number {
  const spread = 0.18 + z * 1.12;
  return width * 0.5 + (nx - 0.5) * width * spread;
}

function groundY(horizon: number, height: number, z: number): number {
  return horizon + z * z * (height - horizon);
}

function heroDepth(i: number, slices: number): number {
  const t = i / Math.max(1, slices);
  return t ** 2.2;
}

function paintSky(ctx: CanvasRenderingContext2D, width: number, height: number, horizon: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#040301");
  sky.addColorStop(horizon / Math.max(1, height), "#070502");
  sky.addColorStop(1, LEXI_TERRAIN_GOLD_VOID);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

/** Small warm horizon area light — not a sun disk. */
function paintHorizonAreaLight(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  bloom: number,
): void {
  const hw = width * 0.22;
  const hh = Math.max(8, horizon * 0.08);
  const g = ctx.createRadialGradient(width * 0.5, horizon, 1, width * 0.5, horizon, hw);
  const a = 0.07 + bloom * 0.1;
  g.addColorStop(0, hexToRgba("#ffd27a", Math.min(0.2, a)));
  g.addColorStop(0.55, hexToRgba("#c47a12", a * 0.35));
  g.addColorStop(1, hexToRgba("#c47a12", 0));
  ctx.save();
  ctx.translate(width * 0.5, horizon);
  ctx.scale(1, hh / hw);
  ctx.translate(-width * 0.5, -horizon);
  ctx.fillStyle = g;
  ctx.fillRect(width * 0.5 - hw, horizon - hh, hw * 2, hh * 2);
  ctx.restore();
}

/** Dark mountain mesh silhouette behind the field. Almost no motion. */
function paintMountainMesh(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  parx: number,
  scale: number,
): void {
  const peaks: Array<[number, number]> = [
    [0.0, 6],
    [0.07, 18],
    [0.14, 12],
    [0.22, 52],
    [0.3, 30],
    [0.38, 44],
    [0.48, 10],
    [0.56, 26],
    [0.66, 64],
    [0.76, 28],
    [0.84, 46],
    [0.93, 16],
    [1.03, 7],
  ];
  ctx.beginPath();
  ctx.moveTo(-14, horizon + 4);
  for (const [nx, rise] of peaks) ctx.lineTo(nx * width + parx, horizon - rise * scale);
  ctx.lineTo(width + 14, horizon + 4);
  ctx.closePath();
  ctx.fillStyle = "#050302";
  ctx.fill();
  ctx.strokeStyle = "rgba(18,12,6,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const [nx, rise] of peaks) {
    if (rise < 28) continue;
    const x = nx * width + parx;
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x - 10, horizon - rise * scale * 0.55);
    ctx.lineTo(x, horizon - rise * scale);
    ctx.lineTo(x + 12, horizon - rise * scale * 0.5);
    ctx.strokeStyle = "rgba(12,8,4,0.45)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function paintVolumeFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  y0: number,
  h: number,
  density: number,
  gold: number,
): void {
  const fog = ctx.createLinearGradient(0, y0, 0, y0 + h);
  fog.addColorStop(0, hexToRgba("#ffd27a", 0.06 * density * gold));
  fog.addColorStop(0.22, hexToRgba("#e0a43a", 0.11 * density * gold));
  fog.addColorStop(0.5, hexToRgba("#c47a12", 0.18 * density * gold));
  fog.addColorStop(0.78, `rgba(8,5,2,${0.42 * density})`);
  fog.addColorStop(1, `rgba(6,4,2,${0.06 * density})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, y0, width, h);
}

type HeroHigh = { x: number; y: number; z: number; bright: number; crest: number };

/**
 * HERO DRAW PATH — thick emissive ridge ribbons (stroke only) + ridge points.
 * Valleys are not drawn. Not a filled dune skin.
 */
function strokeHeroRibbons(
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
  highs: HeroHigh[],
): void {
  const n = Math.max(18, Math.round(cols * (0.35 + 0.65 * z)));
  const yBase = groundY(horizon, height, z);
  let prevX = 0;
  let prevY = 0;
  let prevB = 0;
  let prevMask = 0;
  for (let c = 0; c <= n; c++) {
    const nx = c / n;
    const sample = heroSampleBrightness(nx, z, u, deform, { depthAttenuation: attK, gate });
    const x = screenX(nx, z, width);
    const y = yBase - sample.h * amp * (0.2 + z * 0.82);
    if (c > 0 && sample.ridgeMask > 0.12 && prevMask > 0.08) {
      const b = Math.max(prevB, sample.bright);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hexToRgba(LEXI_TERRAIN_GOLD_CRESTS.deep, Math.min(0.35, 0.08 + b * 0.28));
      ctx.lineWidth = (2.4 + z * 5.2) * (0.7 + b * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hexToRgba(
        b > 0.35 ? LEXI_TERRAIN_GOLD_CRESTS.near : LEXI_TERRAIN_GOLD_CRESTS.mid,
        Math.min(0.88, 0.16 + b * 0.72),
      );
      ctx.lineWidth = (0.9 + z * 2.4) * (0.65 + b * 0.7);
      ctx.stroke();
    }
    if (sample.ridgeMask > 0.22 && sample.bright > 0.05) {
      highs.push({ x, y, z, bright: sample.bright, crest: sample.crest });
    }
    prevX = x;
    prevY = y;
    prevB = sample.bright;
    prevMask = sample.ridgeMask;
  }
}

function paintBokeh(ctx: CanvasRenderingContext2D, highs: HeroHigh[], budget: number): void {
  if (budget <= 0 || highs.length === 0) return;
  const ranked = highs.filter((h) => h.crest > 0.7 && h.z > 0.5).sort((a, b) => b.bright - a.bright);
  const n = Math.min(Math.max(1, Math.round(budget * 0.55)), ranked.length, 7);
  for (let i = 0; i < n; i++) {
    const p = ranked[i]!;
    const r = 2.2 + p.z * 3.4;
    const g = ctx.createRadialGradient(p.x, p.y, 0.2, p.x, p.y, r);
    g.addColorStop(0, hexToRgba("#fff4d2", Math.min(0.42, 0.14 + p.bright * 0.28)));
    g.addColorStop(0.45, hexToRgba("#ffd27a", 0.1));
    g.addColorStop(1, hexToRgba("#ffd27a", 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

const heroMotion = createTerrainMotionState();

export const lexiTerrainGoldHeroScene: Scene = {
  id: LEXI_TERRAIN_GOLD_HERO_ID,
  name: "Terrain Gold · Hero Look",
  description: "Hero Look canvas preview — thick ridge ribbons, volume fog, sparse bokeh",
  defaultParams: LEXI_TERRAIN_GOLD_HERO_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const { ctx, width, height } = ctxWrap;
    const period = num(params.periodSec, LEXI_TERRAIN_GOLD_HERO_PERIOD_SEC);
    const flowSpeed = num(params.flowSpeed, 0.35);
    stepFieldMotion(heroMotion, features, { flowSpeed, periodSec: period, dt });
    const u = heroMotion.u;
    const gate = heroMotion.gate;
    const deform: TerrainDeform = { bass: features.bass ?? 0, kickEnv: heroMotion.kickEnv };
    const bloom = Math.min(0.5, terrainCappedBloom(params));
    const fogAmt = num(params.fogDensity, 0.88);
    const fogH = num(params.fogHeight, 0.44);
    const attK = num(params.depthAttenuation, 0.62);
    const horizonY = num(params.horizonY, 0.42);
    const mountainScale = num(params.mountainScale, 1.38);
    const density = num(params.surfaceDensity, 1.48);
    const plan = heroMatterPlan(width, height, params);
    const horizon = height * horizonY;
    const parx = terrainParx(u) * 0.03;
    const slices = plan.slices;
    const cols = plan.cols;
    const amp = height * 0.082 * density * 0.7;
    const sparkN = fieldSparkBudget(features, num(params.complexity, 0.8));
    const fogGold = 0.32 + 0.68 * gate;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    paintSky(ctx, width, height, horizon);
    paintMountainMesh(ctx, width, horizon, parx, mountainScale);
    paintHorizonAreaLight(ctx, width, horizon, bloom);

    const highs: HeroHigh[] = [];
    for (let i = 1; i <= slices; i++) {
      const z = heroDepth(i, slices);
      strokeHeroRibbons(ctx, z, u, cols, width, height, horizon, amp, deform, attK, gate, highs);
      if (i === Math.round(slices * 0.4)) {
        paintVolumeFog(ctx, width, horizon + (height - horizon) * 0.04, (height - horizon) * fogH * 0.42, fogAmt * 0.55, fogGold);
      }
      if (i === Math.round(slices * 0.7)) {
        paintVolumeFog(ctx, width, horizon + (height - horizon) * 0.2, (height - horizon) * fogH * 0.7, fogAmt * 0.85, fogGold);
      }
      if (i === Math.round(slices * 0.9)) {
        paintVolumeFog(ctx, width, horizon + (height - horizon) * 0.42, (height - horizon) * fogH * 0.55, fogAmt, fogGold);
      }
    }

    paintBokeh(ctx, highs, sparkN);
    ctx.restore();
  },
};
