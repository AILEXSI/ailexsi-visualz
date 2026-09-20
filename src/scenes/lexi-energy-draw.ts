/**
 * LEXI Energy draw — frontal vanishing-point field of light lines on black.
 * Stages 1–3: camera/horizon, lines+black (no fill), selective bloom.
 * Plus: irregular vertical energy above horizon, darker lower plane, sparse particles.
 *
 * FAIL rejects: beige dune, side hill, full-frame bloom fog, classic EQ bars.
 */

import { hexToRgba, mixHex } from "../draw/color";
import {
  ENERGY_GOLD,
  ENERGY_HOT,
  ENERGY_HORIZON_Y,
  ENERGY_ORANGE,
  ENERGY_VOID,
  energyCappedBloom,
  energyLineOffset,
  energyProject,
  type EnergyBands,
  type EnergyLookParams,
} from "./lexi-energy-math";

export type EnergyLookId = "horizon" | "field" | "spectrum";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function lookCounts(look: EnergyLookId, density: number, spectrumAmt: number): {
  radials: number;
  rungs: number;
  wisps: number;
  motes: number;
} {
  const d = Math.max(0.5, density);
  if (look === "field") {
    return {
      radials: Math.round(15 * d),
      rungs: Math.round(7 * d),
      wisps: Math.round(5 * spectrumAmt),
      motes: Math.round(14 * d),
    };
  }
  if (look === "spectrum") {
    return {
      radials: Math.round(9 * d),
      rungs: Math.round(4 * d),
      wisps: Math.round(16 * spectrumAmt),
      motes: Math.round(12 + 6 * spectrumAmt),
    };
  }
  return {
    radials: Math.round(11 * d),
    rungs: Math.round(5 * d),
    wisps: Math.round(8 * spectrumAmt),
    motes: 12,
  };
}

function crestTint(harmonic: number, gold: string, orange: string): string {
  return mixHex(gold, orange, 0.25 + harmonic * 0.55);
}

/**
 * ENERGY DRAW PATH — strokes + points only. Transparent gaps between lines.
 * No opaque field fill. No side-profile hill.
 */
export function paintEnergyField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  u: number,
  bands: EnergyBands,
  params: Partial<EnergyLookParams>,
  look: EnergyLookId,
): void {
  const horizonY = Math.max(0.48, Math.min(0.55, num(params.horizonY, ENERGY_HORIZON_Y)));
  const bloom = energyCappedBloom(num(params.bloom, 0.4), num(params.bloomCap, 0.42));
  const intensity = num(params.intensity, 0.88);
  const gold = String(params.colorPrimary || ENERGY_GOLD);
  const orange = String(params.colorSecondary || ENERGY_ORANGE);
  const tint = crestTint(bands.harmonic, gold, orange);
  const density = num(params.lineDensity, 1);
  const spectrumAmt = num(params.spectrumAmount, 0.55);
  const counts = lookCounts(look, density, spectrumAmt);
  const vpX = width * 0.5;
  const vpY = height * horizonY;
  const expand = 1 + bands.kickEnv * 0.12;
  const horizonGlow = (0.18 + bands.kickEnv * 0.55 + bands.gate * 0.12) * intensity;

  ctx.save();
  ctx.fillStyle = ENERGY_VOID;
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  paintPlane(ctx, width, height, horizonY, u, bands, counts, tint, intensity, 1, expand);
  paintPlane(ctx, width, height, horizonY, u, bands, {
    radials: Math.max(5, Math.round(counts.radials * 0.7)),
    rungs: Math.max(3, Math.round(counts.rungs * 0.65)),
    wisps: 0,
    motes: 0,
  }, tint, intensity * 0.38, -1, expand);

  paintHorizon(ctx, vpX, vpY, width, horizonGlow, bloom, tint, expand);
  paintWisps(ctx, vpX, vpY, width, height, u, bands, counts.wisps, tint, intensity, bloom);
  paintMotes(ctx, width, height, horizonY, u, bands, counts.motes, tint, intensity);
  ctx.restore();
}

function paintPlane(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  u: number,
  bands: EnergyBands,
  counts: { radials: number; rungs: number; wisps: number; motes: number },
  tint: string,
  intensity: number,
  side: 1 | -1,
  expand: number,
): void {
  const dim = side === 1 ? 1 : 0.42;
  for (let i = 0; i < counts.radials; i++) {
    const nx = counts.radials <= 1 ? 0.5 : i / (counts.radials - 1);
    ctx.beginPath();
    let started = false;
    for (let s = 1; s <= 14; s++) {
      const z = (s / 14) ** 0.85;
      const off = energyLineOffset(nx, z, u, bands, side);
      const p = energyProject(nx, z, width, height, horizonY, side);
      const x = (p.x - p.vpX) * expand + p.vpX;
      const y = p.y + off * side;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    const near = 0.08 + 0.28 * dim * intensity;
    ctx.strokeStyle = hexToRgba(tint, near);
    ctx.lineWidth = side === 1 ? 0.7 : 0.45;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }

  for (let r = 1; r <= counts.rungs; r++) {
    const z = (r / (counts.rungs + 1)) ** 1.15;
    ctx.beginPath();
    let started = false;
    const cols = 10;
    for (let c = 0; c <= cols; c++) {
      const nx = c / cols;
      const off = energyLineOffset(nx, z, u, bands, side);
      const p = energyProject(nx, z, width, height, horizonY, side);
      const x = (p.x - p.vpX) * expand + p.vpX;
      const y = p.y + off * side * 0.65;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = hexToRgba(tint, (0.05 + z * 0.16) * dim * intensity);
    ctx.lineWidth = 0.4 + z * 0.7;
    ctx.stroke();
  }
}

function paintHorizon(
  ctx: CanvasRenderingContext2D,
  vpX: number,
  vpY: number,
  width: number,
  glow: number,
  bloom: number,
  tint: string,
  expand: number,
): void {
  const half = width * (0.16 + glow * 0.1) * expand;
  ctx.beginPath();
  ctx.moveTo(vpX - half, vpY);
  ctx.lineTo(vpX + half, vpY);
  ctx.strokeStyle = hexToRgba(ENERGY_HOT, Math.min(0.72, 0.22 + glow * 0.55));
  ctx.lineWidth = 1.1 + glow * 1.6;
  ctx.shadowColor = hexToRgba(tint, Math.min(0.55, bloom * glow));
  ctx.shadowBlur = 6 + bloom * 14 * glow;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(vpX - half * 0.55, vpY);
  ctx.lineTo(vpX + half * 0.55, vpY);
  ctx.strokeStyle = hexToRgba(ENERGY_HOT, 0.35 + glow * 0.25);
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

/** Irregular vertical energy — jittered x/width/height, not equal EQ bars. */
function paintWisps(
  ctx: CanvasRenderingContext2D,
  vpX: number,
  vpY: number,
  width: number,
  height: number,
  u: number,
  bands: EnergyBands,
  count: number,
  tint: string,
  intensity: number,
  bloom: number,
): void {
  if (count <= 0) return;
  const room = vpY * 0.82;
  for (let i = 0; i < count; i++) {
    const seed = (i * 0.618 + 0.13) % 1;
    const lean = (seed - 0.5) * 1.6;
    const wander = Math.sin(u * Math.PI * 2 + i * 1.7) * bands.harmonic * width * 0.012;
    const x0 = vpX + lean * width * (0.06 + seed * 0.22) + wander;
    const peak = (0.18 + ((i * 37) % 17) / 17 * 0.72) * (0.35 + bands.mid * 0.4 + bands.high * 0.45 + bands.harmonic * 0.2);
    const h = room * peak * (0.55 + bands.gate * 0.45);
    const spike = bands.high * (seed > 0.72 ? 0.22 : 0);
    const x1 = x0 + (vpX - x0) * 0.18;
    ctx.beginPath();
    ctx.moveTo(x0, vpY);
    ctx.lineTo(x1, vpY - h - spike * room);
    ctx.strokeStyle = hexToRgba(tint, (0.08 + peak * 0.28 + bands.high * 0.1) * intensity);
    ctx.lineWidth = 0.45 + ((i * 13) % 5) * 0.18 + bands.high * 0.25;
    if (peak > 0.55 && bloom > 0.2) {
      ctx.shadowColor = hexToRgba(ENERGY_HOT, 0.18 * bloom);
      ctx.shadowBlur = 5 * bloom;
    } else ctx.shadowBlur = 0;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function paintMotes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  u: number,
  bands: EnergyBands,
  count: number,
  tint: string,
  intensity: number,
): void {
  const extra = Math.round(bands.high * 6 + bands.kickEnv * 4);
  const n = Math.min(28, count + extra);
  for (let i = 0; i < n; i++) {
    const seed = (i * 0.173 + energyHash(i)) % 1;
    const z = 0.2 + seed * 0.75;
    const nx = (0.18 + ((i * 0.271 + u * 0.02) % 0.64));
    const side: 1 | -1 = i % 5 === 0 ? -1 : 1;
    const p = energyProject(nx, z, width, height, horizonY, side);
    const a = (0.08 + z * 0.22 + bands.high * 0.18 + bands.kickEnv * 0.12) * intensity;
    ctx.fillStyle = hexToRgba(i % 3 === 0 ? ENERGY_HOT : tint, a);
    const r = 0.6 + z * 1.1 + bands.high * 0.4;
    ctx.fillRect(p.x - r * 0.5, p.y - r * 0.5, r, r);
  }
}

function energyHash(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
