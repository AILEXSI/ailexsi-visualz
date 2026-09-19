/**
 * LEXI Terrain Gold · Field Draw (`lexi-terrain-gold-field`).
 * Retention: does not overwrite MotionGate (`lexi-terrain-gold`) or P12.
 *
 * LAW: Pose = landscape. Motion = 100% audio via motionGate.
 * timeMs / clock are decay/integration only — never travel.
 * Gate=0 → freeze (poster still). Fill / Lambert dune shading forbidden.
 *
 * AUDIO (motion only — not color-as-EQ):
 *   SUB/bass  → large-wavelength swell inside shared terrainHeight
 *   KICK      → z-impulse via kickEnv, tau 0.5s (0.3–0.8). No u-reset. No flash.
 *   LOWMID    := clamp01(mid*0.72 + bass*0.18) → travelScale on du
 *   RMS       → motionGate (0 = poster still)
 *   mid/treble → spark / filament count only (small)
 *   u-advance *= motionGate (shared stepTerrainMotion)
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
  stepTerrainMotion,
  terrainCappedBloom,
  terrainHeight,
  terrainParx,
  terrainSurfaceHash,
  terrainSurfaceKey,
  type TerrainDeform,
  type TerrainMotionState,
} from "./lexi-terrain-gold";

export const LEXI_TERRAIN_GOLD_FIELD_ID = "lexi-terrain-gold-field";
export const LEXI_TERRAIN_GOLD_FIELD_FAMILY = LEXI_TERRAIN_GOLD_FAMILY;
export const LEXI_TERRAIN_GOLD_FIELD_MODE = LEXI_TERRAIN_GOLD_MODE;
export const LEXI_TERRAIN_GOLD_FIELD_PERIOD_SEC = LEXI_TERRAIN_GOLD_PERIOD_SEC;
/** Kick envelope tau — 0.5s sits in the 0.3–0.8s Field Draw window. */
export const LEXI_TERRAIN_GOLD_FIELD_KICK_TAU = 0.5;

export const LEXI_TERRAIN_GOLD_FIELD_DEFAULTS: SceneParams = {
  ...LEXI_TERRAIN_GOLD_DEFAULTS,
  surfaceDensity: 1.55,
};

export {
  terrainHeight,
  terrainSurfaceKey,
  terrainSurfaceHash,
  stepTerrainMotion,
  createTerrainMotionState,
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Lower-mid body for travel. AudioFeatures has no dedicated lowMid band;
 * split mid (body) + a little bass so travel is not a bass-only EQ map.
 */
export function fieldLowMid(features: Pick<AudioFeatures, "mid" | "bass">): number {
  return clamp01((features.mid ?? 0) * 0.72 + (features.bass ?? 0) * 0.18);
}

/** mid/treble → spark count only. 0 energy ⇒ 0 sparks. */
export function fieldSparkBudget(
  features: Pick<AudioFeatures, "mid" | "treble">,
  complexity = 0.8,
): number {
  const energy = clamp01((features.mid ?? 0) * 0.55 + (features.treble ?? 0) * 0.45);
  return Math.round(energy * 10 * Math.max(0, complexity));
}

/**
 * Advance Field Draw motion. kickTau 0.5; travelScale = lowMid.
 * du = gate * flowSpeed * lowMid * dt / periodSec. Gate=0 or lowMid=0 ⇒ no travel.
 */
export function stepFieldMotion(
  state: TerrainMotionState,
  features: Pick<AudioFeatures, "timeMs" | "rms" | "bass" | "mid" | "kick" | "beatPulse">,
  opts: { flowSpeed?: number; periodSec?: number; dt?: number } = {},
): TerrainMotionState {
  return stepTerrainMotion(state, features, {
    flowSpeed: opts.flowSpeed,
    periodSec: opts.periodSec,
    dt: opts.dt,
    kickTau: LEXI_TERRAIN_GOLD_FIELD_KICK_TAU,
    travelScale: fieldLowMid(features),
  });
}

export function fieldMatterPlan(
  width: number,
  height: number,
  params: Partial<SceneParams> = LEXI_TERRAIN_GOLD_FIELD_DEFAULTS,
): { horizonY: number; slices: number; cols: number; bloomCap: number; periodSec: number } {
  const density = num(params.surfaceDensity, 1.55);
  const area = Math.max(0.72, Math.min(1, Math.sqrt((width * height) / (1920 * 1080))));
  return {
    horizonY: num(params.horizonY, 0.42),
    slices: Math.max(56, Math.round(72 * density * area)),
    cols: Math.max(36, Math.round(48 * density * area)),
    bloomCap: num(params.bloomCap, 0.55),
    periodSec: num(params.periodSec, LEXI_TERRAIN_GOLD_FIELD_PERIOD_SEC),
  };
}

export function fieldFrameKey(state: TerrainMotionState, deform: TerrainDeform = {}): number[] {
  return [state.u, state.gate, state.kickEnv, ...terrainSurfaceKey(state.u, 24, 16, deform)];
}

/**
 * brightness = slope × depthAtten × ridgeMask × gateTerm
 * gateTerm = 0.2 + 0.8*motionGate so gate=0 stays a readable still (not a black frame).
 * Valleys: ridgeMask ≈ 0 → almost dead.
 */
export function fieldSampleBrightness(
  nx: number,
  z: number,
  u: number,
  deform: TerrainDeform,
  opts: { depthAttenuation: number; gate: number },
): { h: number; slope: number; ridgeMask: number; bright: number; crest: number } {
  const eps = 0.012;
  const h = terrainHeight(nx, z, u, deform);
  const hl = terrainHeight(nx - eps, z, u, deform);
  const hr = terrainHeight(nx + eps, z, u, deform);
  const slope = Math.min(1, Math.abs(hr - hl) / (2 * eps) * 0.18);
  const crest = clamp01((h + 1) * 0.5);
  const ridgeMask = Math.max(0, (crest - 0.52) / 0.48) ** 1.6;
  const depthAtten = (1 - opts.depthAttenuation) + opts.depthAttenuation * clamp01(z);
  const gateTerm = 0.2 + 0.8 * clamp01(opts.gate);
  const bright = slope * depthAtten * ridgeMask * gateTerm;
  return { h, slope, ridgeMask, bright, crest };
}

function screenX(nx: number, z: number, width: number): number {
  const spread = 0.2 + z * 1.08;
  return width * 0.5 + (nx - 0.5) * width * spread;
}

function groundY(horizon: number, height: number, z: number): number {
  return horizon + z * z * (height - horizon);
}

/** Perspective Z: dense near the camera, thin at the horizon. */
function fieldDepth(i: number, slices: number): number {
  const t = i / Math.max(1, slices);
  return t * t;
}

function fieldCols(baseCols: number, z: number): number {
  return Math.max(12, Math.round(baseCols * (0.4 + 0.6 * z)));
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
  const a = 0.12 + bloom * 0.18;
  g.addColorStop(0, hexToRgba("#fff4d2", Math.min(0.36, a + 0.04)));
  g.addColorStop(0.4, hexToRgba("#ffd27a", a * 0.4));
  g.addColorStop(1, hexToRgba("#c47a12", 0));
  ctx.save();
  ctx.translate(width * 0.5, horizon);
  ctx.scale(1, ry / rx);
  ctx.translate(-width * 0.5, -horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon - ry, width, ry * 2);
  ctx.restore();
}

/** Dark mountain silhouette BEHIND the field. Almost no motion (tiny parx). */
function paintHillSilhouette(
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
  fog.addColorStop(0, hexToRgba("#ffd27a", 0.04 * density * gold));
  fog.addColorStop(0.3, hexToRgba("#c47a12", 0.12 * density * gold));
  fog.addColorStop(0.7, `rgba(10,6,2,${0.34 * density})`);
  fog.addColorStop(1, `rgba(10,6,2,${0.1 * density})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, y0, width, h);
}

function strokeTint(bright: number): string {
  if (bright > 0.42) return LEXI_TERRAIN_GOLD_CRESTS.near;
  if (bright > 0.2) return LEXI_TERRAIN_GOLD_CRESTS.mid;
  return LEXI_TERRAIN_GOLD_CRESTS.deep;
}

type FieldHigh = { x: number; y: number; z: number; bright: number; crest: number };

/**
 * FIELD DRAW PATH — polylines + ridge points in the heightfield.
 * No dune fill / no ribbon skin / no isolines painted on a filled mesh.
 */
function strokeFieldRow(
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
  const n = fieldCols(cols, z);
  const yBase = groundY(horizon, height, z);
  let prevX = 0;
  let prevY = 0;
  let prevB = 0;
  for (let c = 0; c <= n; c++) {
    const nx = c / n;
    const sample = fieldSampleBrightness(nx, z, u, deform, { depthAttenuation: attK, gate });
    const x = screenX(nx, z, width);
    const y = yBase - sample.h * amp * (0.2 + z * 0.8);
    if (c > 0 && (prevB >= 0.012 || sample.bright >= 0.012)) {
      const b = Math.max(prevB, sample.bright);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hexToRgba(strokeTint(b), Math.min(0.9, 0.1 + b * 0.8));
      ctx.lineWidth = (0.32 + z * 1.65) * (0.65 + b * 0.7);
      ctx.stroke();
    }
    if (sample.ridgeMask > 0.28 && sample.bright > 0.06) {
      const pr = 0.7 + z * 1.35;
      ctx.fillStyle = hexToRgba(LEXI_TERRAIN_GOLD_CRESTS.near, Math.min(0.72, sample.bright * 0.62));
      ctx.fillRect(x - pr * 0.5, y - pr * 0.5, pr, pr);
      highs.push({ x, y, z, bright: sample.bright, crest: sample.crest });
    }
    prevX = x;
    prevY = y;
    prevB = sample.bright;
  }
}

/** Sparse iso-x filaments following the heightfield (not frequency bars). */
function strokeFieldFilament(
  ctx: CanvasRenderingContext2D,
  nx: number,
  slices: number,
  u: number,
  width: number,
  height: number,
  horizon: number,
  amp: number,
  deform: TerrainDeform,
  attK: number,
  gate: number,
): void {
  ctx.beginPath();
  let started = false;
  let lastB = 0;
  for (let i = 2; i <= slices; i += 2) {
    const z = fieldDepth(i, slices);
    const sample = fieldSampleBrightness(nx, z, u, deform, { depthAttenuation: attK, gate });
    if (sample.ridgeMask < 0.18) {
      started = false;
      continue;
    }
    const x = screenX(nx, z, width);
    const y = groundY(horizon, height, z) - sample.h * amp * (0.2 + z * 0.8);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
    lastB = sample.bright;
  }
  if (!started) return;
  ctx.strokeStyle = hexToRgba(LEXI_TERRAIN_GOLD_CRESTS.mid, Math.min(0.38, 0.06 + lastB * 0.32));
  ctx.lineWidth = 0.45;
  ctx.stroke();
}

function paintSparks(ctx: CanvasRenderingContext2D, highs: FieldHigh[], budget: number): void {
  if (budget <= 0 || highs.length === 0) return;
  const ranked = highs.filter((h) => h.crest > 0.68 && h.z > 0.4).sort((a, b) => b.bright - a.bright);
  const n = Math.min(budget, ranked.length);
  for (let i = 0; i < n; i++) {
    const p = ranked[i]!;
    const r = 1.1 + p.z * 1.6;
    ctx.fillStyle = hexToRgba("#fff4d2", Math.min(0.55, 0.18 + p.bright * 0.35));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

const fieldMotion = createTerrainMotionState();

export const lexiTerrainGoldFieldScene: Scene = {
  id: LEXI_TERRAIN_GOLD_FIELD_ID,
  name: "Terrain Gold · Field Draw",
  description: "Field Draw — polylines + ridge points in the heightfield, 100% audio motion",
  defaultParams: LEXI_TERRAIN_GOLD_FIELD_DEFAULTS,
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt = 1 / 30) {
    const { ctx, width, height } = ctxWrap;
    const period = num(params.periodSec, LEXI_TERRAIN_GOLD_FIELD_PERIOD_SEC);
    const flowSpeed = num(params.flowSpeed, 0.35);
    stepFieldMotion(fieldMotion, features, { flowSpeed, periodSec: period, dt });
    const u = fieldMotion.u;
    const gate = fieldMotion.gate;
    const deform: TerrainDeform = { bass: features.bass ?? 0, kickEnv: fieldMotion.kickEnv };
    const bloom = terrainCappedBloom(params);
    const fogAmt = num(params.fogDensity, 0.78);
    const fogH = num(params.fogHeight, 0.38);
    const attK = num(params.depthAttenuation, 0.62);
    const horizonY = num(params.horizonY, 0.42);
    const mountainScale = num(params.mountainScale, 1.15);
    const density = num(params.surfaceDensity, 1.55);
    const plan = fieldMatterPlan(width, height, params);
    const horizon = height * horizonY;
    const parx = terrainParx(u) * 0.05;
    const slices = plan.slices;
    const cols = plan.cols;
    const amp = height * 0.078 * density * 0.72;
    const sparkN = fieldSparkBudget(features, num(params.complexity, 0.8));
    const fogGold = 0.35 + 0.65 * gate;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    paintSky(ctx, width, height, horizon);
    paintMidGlow(ctx, width, horizon, bloom);
    paintHillSilhouette(ctx, width, horizon, parx, mountainScale);

    const haze = ctx.createLinearGradient(0, horizon - 28, 0, horizon + height * 0.1);
    haze.addColorStop(0, hexToRgba("#c47a12", 0.03 * fogAmt * fogGold));
    haze.addColorStop(1, hexToRgba("#0a0602", 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 28, width, height * 0.14);

    const highs: FieldHigh[] = [];
    for (let i = 1; i <= slices; i++) {
      const z = fieldDepth(i, slices);
      strokeFieldRow(ctx, z, u, cols, width, height, horizon, amp, deform, attK, gate, highs);
      if (i === Math.round(slices * 0.55)) {
        paintFogBank(
          ctx,
          width,
          horizon + (height - horizon) * 0.1,
          (height - horizon) * fogH * 0.5,
          fogAmt * 0.65,
          fogGold,
        );
      }
      if (i === Math.round(slices * 0.82)) {
        paintFogBank(
          ctx,
          width,
          horizon + (height - horizon) * 0.32,
          (height - horizon) * fogH,
          fogAmt,
          fogGold,
        );
      }
    }

    const filamentXs = [0.18, 0.32, 0.45, 0.55, 0.68, 0.82];
    for (const nx of filamentXs) {
      strokeFieldFilament(ctx, nx, slices, u, width, height, horizon, amp, deform, attK, gate);
    }

    paintSparks(ctx, highs, sparkN);
    ctx.restore();
  },
};
