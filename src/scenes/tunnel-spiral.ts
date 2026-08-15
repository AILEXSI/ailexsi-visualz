/**
 * Scene: tunnel-spiral
 * Hypnotic rotating tunnel rings driven by spectrum + beat.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";

let rot = 0;

export const tunnelSpiralScene: Scene = {
  id: "tunnel-spiral",
  name: "Tunnel Spiral",
  description: "Rotating depth rings that react to the spectrum",
  defaultParams: {
    intensity: 0.8,
    colorPrimary: "#00d4ff",
    colorSecondary: "#050510",
    speed: 1,
    complexity: 0.7,
  },

  onEnter() {
    rot = 0;
  },

  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const cx = width / 2;
    const cy = height / 2;
    rot += dt * params.speed * (0.4 + features.rms * 1.8);

    const rings = 12 + Math.floor(params.complexity * 10);
    const maxR = Math.hypot(width, height) * 0.55;

    for (let i = rings; i >= 1; i--) {
      const t = i / rings;
      const specIdx = Math.floor((1 - t) * Math.max(0, features.spectrum.length - 1));
      const spec = features.spectrum.length ? features.spectrum[specIdx] ?? 0 : 0;

      const r = maxR * t * (0.85 + features.bass * 0.2 * params.intensity);
      const sides = 3 + Math.floor(params.complexity * 5);
      const angleOffset = rot * (1 + i * 0.03) + i * 0.15;

      ctx.beginPath();
      for (let s = 0; s <= sides; s++) {
        const a = angleOffset + (s / sides) * Math.PI * 2;
        const wobble = 1 + spec * 0.15 * params.intensity;
        const x = cx + Math.cos(a) * r * wobble;
        const y = cy + Math.sin(a) * r * wobble;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const alpha = (0.08 + spec * 0.25) * params.intensity * (0.4 + features.rms);
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.lineWidth = 1 + features.beatPulse * 2;
      ctx.stroke();
    }

    // Center flash
    if (features.beatPulse > 0.1) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + features.beatPulse * 60);
      g.addColorStop(0, `rgba(255,255,255,${features.beatPulse * 0.5})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.fill();
    }
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
