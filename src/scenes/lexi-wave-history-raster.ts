/**
 * Software raster of the geometry-only Wave-History field (no canvas, no bloom).
 * Used for evidence PNGs and hash-stable screenshots.
 */
import { BANDS, HEIGHT_SCALE, HISTORY, ringRow, type WaveRing } from "../audio/wave-core";
import { WAVE_HISTORY_LINE_RGBA } from "./lexi-wave-history-draw";

export function rasterizeWaveHistory(
  width: number,
  height: number,
  ring: WaveRing,
  label: string,
): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = 255;
  }

  const rows = Math.min(HISTORY, Math.max(1, ring.count));
  for (let age = rows - 1; age >= 0; age--) {
    if (age % 2 === 1) continue;
    const z = age / Math.max(1, rows - 1);
    const zEase = Math.pow(z, 1.2);
    const yNear = height * 0.86;
    const yFar = height * 0.16;
    const yBase = yNear + (yFar - yNear) * zEase;
    const half = width * (0.46 - 0.34 * zEase);
    const row = ring.count > 0 ? ringRow(ring, age) : new Float32Array(BANDS);
    const alpha = 0.08 + 0.38 * (1 - zEase);
    const lw = Math.max(0.5, 0.95 - zEase * 0.45);
    let prevX = 0;
    let prevY = 0;
    for (let b = 0; b < BANDS; b++) {
      const u = b / (BANDS - 1);
      const e = Math.max(0, (row[b] ?? 0) - 0.05);
      const x = width * 0.5 + (u - 0.5) * 2 * half;
      const lift = e * HEIGHT_SCALE * (0.55 + 0.45 * (1 - zEase));
      const y = yBase - lift;
      if (b > 0) stroke(px, width, height, prevX, prevY, x, y, alpha, lw);
      prevX = x;
      prevY = y;
    }
  }

  fillRect(px, width, height, 0, height - 24, width, 24, 0, 0, 0, 0.75);
  return px;
}

function stamp(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  alpha: number,
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
  const o = (iy * width + ix) * 4;
  const a = Math.max(0, Math.min(1, alpha));
  px[o] = Math.round(px[o]! * (1 - a) + WAVE_HISTORY_LINE_RGBA.r * a);
  px[o + 1] = Math.round(px[o + 1]! * (1 - a) + WAVE_HISTORY_LINE_RGBA.g * a);
  px[o + 2] = Math.round(px[o + 2]! * (1 - a) + WAVE_HISTORY_LINE_RGBA.b * a);
  px[o + 3] = 255;
}

function stroke(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  alpha: number,
  lw: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
  const r = Math.max(0.5, lw * 0.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    stamp(px, width, height, x, y, alpha);
    if (r > 0.6) {
      stamp(px, width, height, x + 1, y, alpha * 0.45);
      stamp(px, width, height, x, y + 1, alpha * 0.45);
    }
  }
}

function fillRect(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * width + xx) * 4;
      px[o] = Math.round(px[o]! * (1 - a) + r * a);
      px[o + 1] = Math.round(px[o + 1]! * (1 - a) + g * a);
      px[o + 2] = Math.round(px[o + 2]! * (1 - a) + b * a);
      px[o + 3] = 255;
    }
  }
}

