/**
 * Scene: lita-bloom
 * Soft expanding bloom petals — L.I.T.A. / heart-resonance motif.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";

let bloomPhase = 0;

export const litaBloomScene: Scene = {
  id: "lita-bloom",
  name: "L.I.T.A. Bloom",
  description: "Expanding soft petals — love / resonance motif",
  defaultParams: {
    intensity: 0.8,
    colorPrimary: "#ff4d6d",
    colorSecondary: "#12080f",
    speed: 0.9,
    complexity: 0.55,
  },

  onEnter() {
    bloomPhase = 0;
  },

  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    bloomPhase += dt * params.speed * (0.6 + features.rms * 1.2);

    const cx = width / 2;
    const cy = height / 2;
    const petals = 5 + Math.floor(params.complexity * 4);
    const baseR = Math.min(width, height) * 0.16;

    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * Math.PI * 2 + bloomPhase * 0.3;
      const open = 0.7 + features.bass * 0.5 * params.intensity + features.beatPulse * 0.25;
      const len = baseR * open * (1.1 + Math.sin(bloomPhase + p) * 0.15);

      // Petal shape via two curves
      const x1 = cx + Math.cos(angle - 0.35) * len * 0.3;
      const y1 = cy + Math.sin(angle - 0.35) * len * 0.3;
      const x2 = cx + Math.cos(angle) * len;
      const y2 = cy + Math.sin(angle) * len;
      const x3 = cx + Math.cos(angle + 0.35) * len * 0.3;
      const y3 = cy + Math.sin(angle + 0.35) * len * 0.3;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(x1, y1, x2, y2);
      ctx.quadraticCurveTo(x3, y3, cx, cy);
      ctx.closePath();

      const alpha = (0.18 + features.rms * 0.2) * params.intensity;
      ctx.fillStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.fill();

      ctx.strokeStyle = hexToRgba("#ffffff", alpha * 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Inner heart-ish glow
    const coreR = 10 + features.bass * 22 * params.intensity;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.5);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.35, hexToRgba(params.colorPrimary as string, 0.6));
    g.addColorStop(1, hexToRgba(params.colorPrimary as string, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 2.5, 0, Math.PI * 2);
    ctx.fill();
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
