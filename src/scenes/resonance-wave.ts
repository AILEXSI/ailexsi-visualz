/**
 * resonance-wave — physics pass
 * Ambient / mid / primary filaments + expanding kick rings + sun core.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import { musicClock, logSpectrumSample } from "../draw/motion";

let phase = 0;
const rings: Array<{ r: number; life: number }> = [];

function sample(spec: Float32Array, t: number): number {
  const a = logSpectrumSample(spec, Math.max(0, t - 0.012));
  const b = logSpectrumSample(spec, t);
  const c = logSpectrumSample(spec, Math.min(1, t + 0.012));
  return (a + b + c) / 3;
}

export const resonanceWaveScene: Scene = {
  id: "resonance-wave",
  name: "Resonance Wave",
  description: "Physics-pass: materials, sun core, expanding kick rings",
  defaultParams: {
    intensity: 0.9,
    colorPrimary: "#ff8a4c",
    colorSecondary: "#07070c",
    speed: 1,
    complexity: 0.75,
    bloom: 0.85,
  },
  onEnter() {
    phase = 0;
    rings.length = 0;
  },
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const kick = features.kick ?? features.beatPulse;
    const snare = features.snare ?? 0;
    const hat = features.hat ?? 0;
    const vocal = features.vocal ?? 0;
    const buildup = features.buildup ?? 0;
    const drop = features.drop ?? 0;
    const energy = features.rms * 0.4 + features.bass * 0.4 + features.mid * 0.2;
    phase += musicClock(dt, energy, kick, Number(params.speed) || 1);

    const zoom = 1 + buildup * 0.12 + drop * 0.16;
    const cx = width / 2;
    const cy = height / 2 + (vocal - 0.3) * 8;
    const col = params.colorPrimary as string;
    const intensity = Number(params.intensity) || 1;

    const stroke = (count: number, spacing: number, ampMul: number, alphaMul: number, lw: number, step: number, depth: number) => {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let k = 0; k < count; k++) {
        const yoff = (k - (count - 1) / 2) * spacing * zoom;
        const amp = (0.032 + features.bass * 0.18 + kick * 0.05 + drop * 0.06) * height * zoom * ampMul * intensity;
        const pshift = phase * (0.5 + vocal * 0.12) + k * 0.19 + depth;
        ctx.beginPath();
        for (let x = 0; x <= width; x += step) {
          const t = x / width;
          const spec = sample(features.spectrum, t);
          const y =
            cy + yoff +
            Math.sin(t * Math.PI * 2.05 + pshift) * amp * (0.5 + spec * 0.7) +
            Math.sin(t * Math.PI * 4.2 + pshift * 0.7) * amp * 0.16 * depth +
            (spec - 0.22) * amp * 0.28 +
            Math.sin(t * 14 + k) * amp * 0.08 * snare;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = hexToRgba(col, Math.max(0.04, 0.16 * alphaMul * (0.4 + energy)));
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };

    stroke(7, height * 0.033, 1.35, 0.28, 6, 3, 0.35);
    stroke(9, height * 0.017, 1.0, 0.55, 2.4, 2, 0.7);
    stroke(5, height * 0.011, 0.72, 0.95, 1.6, 1, 1);

    if (kick > 0.85) rings.push({ r: Math.min(width, height) * 0.03, life: 1 });
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].r += (7.5 + features.bass * 6) * (height / 540);
      rings[i].life *= 0.92;
      if (rings[i].life < 0.06 || rings[i].r > Math.min(width, height)) {
        rings.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, rings[i].r, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(col, rings[i].life * 0.45);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (rings.length > 8) rings.splice(0, rings.length - 8);

    if (hat > 0.08) {
      ctx.fillStyle = hexToRgba("#ffe6c8", 0.15 + hat * 0.35);
      for (let i = 0; i < 16 + hat * 40; i++) {
        const px = Math.random() * width;
        const py = cy + (Math.random() - 0.5) * height * 0.5;
        ctx.fillRect(px, py, 1, 1);
      }
    }

    const coreR = 16 + features.bass * 56 * intensity + kick * 28 + drop * 16;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.6);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.18, hexToRgba(col, 0.75));
    g.addColorStop(0.45, hexToRgba(col, 0.28));
    g.addColorStop(1, hexToRgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 2.6, 0, Math.PI * 2);
    ctx.fill();
  },
};
