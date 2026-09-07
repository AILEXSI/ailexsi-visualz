/**
 * Scene: resonance-wave
 * Signature look — waveform is the song, not a timer.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import { musicClock, logSpectrumSample } from "../draw/motion";

let phase = 0;

export const resonanceWaveScene: Scene = {
  id: "resonance-wave",
  name: "Resonance Wave",
  description: "Song-locked waveform layers + harmonic rings",
  defaultParams: {
    intensity: 0.88,
    colorPrimary: "#ff6b35",
    colorSecondary: "#0b0b14",
    speed: 1,
    complexity: 0.7,
  },

  onEnter() {
    phase = 0;
  },

  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const energy = features.rms * 0.45 + features.bass * 0.35 + features.mid * 0.2;
    phase += musicClock(dt, energy, features.beatPulse, Number(params.speed) || 1);

    const cx = width / 2;
    const cy = height / 2;
    const layers = 3 + Math.floor(Number(params.complexity) * 3);

    const ringCount = 5;
    for (let r = 0; r < ringCount; r++) {
      const base = Math.min(width, height) * (0.1 + r * 0.085);
      const pulse = 1 + features.bass * 0.32 * Number(params.intensity) + features.beatPulse * 0.18;
      const radius = base * pulse;
      const alpha = (0.16 - r * 0.022) * Number(params.intensity) * (0.25 + energy);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.lineWidth = 1.2 + features.beatPulse * 2.4;
      ctx.stroke();
    }

    const step = Math.max(1, Math.floor(width / 420));
    for (let layer = 0; layer < layers; layer++) {
      const amp =
        (height * 0.055 + energy * height * 0.16) * Number(params.intensity);
      const yOff = (layer - (layers - 1) / 2) * (height * 0.055);
      const layerPhase = phase * (0.55 + layer * 0.08) + layer * 0.4;

      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let x = 0; x <= width; x += step) {
        const t = x / width;
        const spec = logSpectrumSample(features.spectrum, t);
        const y =
          cy +
          yOff +
          Math.sin(t * Math.PI * (2.2 + layer * 0.35) + layerPhase) * amp * (0.35 + spec * 1.15) +
          (spec - 0.25) * amp * 0.55;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const alpha = (0.42 - layer * 0.06) * (0.35 + energy);
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.lineWidth = 1.2 + (layers - layer) * 0.55;
      ctx.stroke();
    }

    const coreR = 5 + features.bass * 20 * Number(params.intensity) + features.beatPulse * 12;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.2);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.35, hexToRgba(params.colorPrimary as string, 0.55 + energy * 0.25));
    g.addColorStop(1, hexToRgba(params.colorPrimary as string, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
    ctx.fill();
  },
};
