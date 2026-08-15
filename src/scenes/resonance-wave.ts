/**
 * Scene: resonance-wave
 * Signature AILEXSI look — flowing multi-layer waves + harmonic rings.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";

let phase = 0;

export const resonanceWaveScene: Scene = {
  id: "resonance-wave",
  name: "Resonance Wave",
  description: "Flowing waveform layers + harmonic rings (signature)",
  defaultParams: {
    intensity: 0.85,
    colorPrimary: "#ff6b35",
    colorSecondary: "#1a1a2e",
    speed: 1,
    complexity: 0.65,
  },

  onEnter() {
    phase = 0;
  },

  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    phase += dt * params.speed * (1.2 + features.rms * 2);

    const cx = width / 2;
    const cy = height / 2;
    const layers = 3 + Math.floor(params.complexity * 3);

    // Harmonic rings
    const ringCount = 4;
    for (let r = 0; r < ringCount; r++) {
      const base = Math.min(width, height) * (0.12 + r * 0.1);
      const pulse = 1 + features.bass * 0.25 * params.intensity + features.beatPulse * 0.15;
      const radius = base * pulse;
      const alpha = (0.12 - r * 0.02) * params.intensity * (0.5 + features.rms);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.lineWidth = 1.5 + features.beatPulse * 2;
      ctx.stroke();
    }

    // Multi-layer waves across horizontal axis
    for (let layer = 0; layer < layers; layer++) {
      const amp = (height * 0.08 + features.rms * height * 0.12) * params.intensity;
      const freq = 2 + layer * 1.4 + features.mid * 2;
      const yOff = (layer - (layers - 1) / 2) * (height * 0.06);
      const layerPhase = phase * (1 + layer * 0.15) + layer * 0.7;

      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const t = x / width;
        // blend spectrum influence
        const specIdx = Math.floor(t * Math.max(0, features.spectrum.length - 1));
        const spec = features.spectrum.length ? features.spectrum[specIdx] ?? 0 : 0;
        const y =
          cy +
          yOff +
          Math.sin(t * Math.PI * freq + layerPhase) * amp * (0.6 + spec * 0.8) +
          Math.sin(t * Math.PI * freq * 2.3 + layerPhase * 1.3) * amp * 0.25;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const alpha = (0.35 - layer * 0.05) * (0.5 + features.rms);
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.lineWidth = 1.5 + (layers - layer) * 0.4;
      ctx.stroke();
    }

    // Center energy dot
    const coreR = 6 + features.bass * 18 * params.intensity + features.beatPulse * 10;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.4, hexToRgba(params.colorPrimary as string, 0.7));
    g.addColorStop(1, hexToRgba(params.colorPrimary as string, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 2, 0, Math.PI * 2);
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
