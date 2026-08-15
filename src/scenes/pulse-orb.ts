/**
 * Scene: pulse-orb
 * Soft glowing orb that breathes with bass and flashes on onset.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";

export const pulseOrbScene: Scene = {
  id: "pulse-orb",
  name: "Pulse Orb",
  description: "Soft radial glow driven by bass + onset flash",
  defaultParams: {
    intensity: 0.75,
    colorPrimary: "#ff6b35",
    colorSecondary: "#0a0a12",
    speed: 1,
    complexity: 0.4,
  },

  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const cx = width / 2;
    const cy = height / 2;

    const baseRadius = Math.min(width, height) * 0.18;
    const breath = 1 + features.bass * 0.55 * params.intensity;
    const flash = features.onset ? 1.35 : 1 + features.beatPulse * 0.45;
    const radius = baseRadius * breath * flash;

    // Outer soft glow layers
    for (let i = 4; i >= 1; i--) {
      const r = radius * (1 + i * 0.35);
      const alpha = (0.08 / i) * params.intensity * (0.6 + features.rms);
      const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, r);
      g.addColorStop(0, hexToRgba(params.colorPrimary as string, alpha * 1.5));
      g.addColorStop(1, hexToRgba(params.colorPrimary as string, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.25, params.colorPrimary as string);
    core.addColorStop(1, hexToRgba(params.colorPrimary as string, 0.15));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle ring on beat
    if (features.beatPulse > 0.05) {
      ctx.strokeStyle = hexToRgba("#ffffff", features.beatPulse * 0.5);
      ctx.lineWidth = 2 + features.beatPulse * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (1.15 + features.beatPulse * 0.3), 0, Math.PI * 2);
      ctx.stroke();
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
