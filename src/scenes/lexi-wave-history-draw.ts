/**
 * Geometry-only Wave-History draw — 1:1 camera + stroke from the tested proto
 * `renderWaveHistory`. Consumes ring/band rows only. No FFT, no audio, no post.
 */
import {
  ATTACK_SEC,
  BANDS,
  CORE_BUILD_ID,
  FFT_SIZE,
  HEIGHT_SCALE,
  HISTORY,
  HOP,
  RELEASE_SEC,
  SR,
  ringRow,
  type WaveRing,
} from "../audio/wave-core";

export const WAVE_HISTORY_LINE_RGBA = { r: 255, g: 168, b: 64 };

export type WaveHistoryDrawMeta = {
  timeMs?: number;
  hopCount?: number;
  dominantBand?: number;
  bandsHash?: string;
  historyHash?: string;
};

/** Same projection as proto `renderWaveHistory` on an already-sized canvas (dpr baked into W/H). */
export function projectWaveHistoryPoint(
  width: number,
  height: number,
  ring: WaveRing,
  age: number,
  band: number,
): { x: number; y: number; zEase: number; alpha: number; lw: number } {
  const rows = Math.min(HISTORY, Math.max(1, ring.count));
  const z = age / Math.max(1, rows - 1);
  const zEase = Math.pow(z, 1.2);
  const yNear = height * 0.86;
  const yFar = height * 0.16;
  const yBase = yNear + (yFar - yNear) * zEase;
  const half = width * (0.46 - 0.34 * zEase);
  const row = ring.count > 0 ? ringRow(ring, age) : new Float32Array(BANDS);
  const e = Math.max(0, (row[band] ?? 0) - 0.05);
  const u = band / (BANDS - 1);
  const x = width * 0.5 + (u - 0.5) * 2 * half;
  const lift = e * HEIGHT_SCALE * (0.55 + 0.45 * (1 - zEase));
  const alpha = 0.08 + 0.38 * (1 - zEase);
  const lw = Math.max(0.5, 0.95 - zEase * 0.45);
  return { x, y: yBase - lift, zEase, alpha, lw };
}

export function waveHistoryFooter(label: string): string {
  return (
    label +
    " | FFT " + FFT_SIZE +
    " | bands " + BANDS +
    " | history " + HISTORY +
    " | A " + ATTACK_SEC + "s" +
    " | R " + RELEASE_SEC + "s" +
    " | hop " + HOP +
    " | SR " + SR + " | build " + CORE_BUILD_ID
  );
}

export function drawWaveHistoryGeometry(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ring: WaveRing,
  label: string,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const rows = Math.min(HISTORY, Math.max(1, ring.count));

  // Display every 2nd history row so black gaps stay visible; buffer still HISTORY (>=64).
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

    ctx.beginPath();
    for (let b = 0; b < BANDS; b++) {
      const u = b / (BANDS - 1);
      const e = Math.max(0, (row[b] ?? 0) - 0.05); // noise floor / draw gate
      const x = width * 0.5 + (u - 0.5) * 2 * half;
      const lift = e * HEIGHT_SCALE * (0.55 + 0.45 * (1 - zEase));
      const yy = yBase - lift;
      if (b === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = "rgba(255,168,64," + alpha + ")";
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, height - 24, width, 24);
  ctx.fillStyle = "#d0b07a";
  ctx.font = "10.5px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(waveHistoryFooter(label), 8, height - 8);
  ctx.restore();
}

export function evidenceLabel(meta?: WaveHistoryDrawMeta): string {
  const t = meta?.timeMs != null && Number.isFinite(meta.timeMs)
    ? (meta.timeMs / 1000).toFixed(3) + "s"
    : "no-pcm";
  const hop = meta?.hopCount != null ? String(meta.hopCount) : "-";
  const band = meta?.dominantBand != null ? String(meta.dominantBand) : "-";
  return `EVIDENCE t=${t} hops=${hop} peakBand=${band}`;
}
