import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import { musicClock, logSpectrumSample } from "../draw/motion";

let phase = 0;

export const cymaticGridScene: Scene = {
  id: "cymatic-grid",
  name: "Cymatic Grid",
  description: "Standing-wave lattice that locks to spectrum, not a clock",
  defaultParams: {
    intensity: 0.82,
    colorPrimary: "#6ee7ff",
    colorSecondary: "#05060c",
    speed: 0.7,
    complexity: 0.65,
    bloom: 0.55,
  },
  onEnter() { phase = 0; },
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const energy = features.mid * 0.5 + features.treble * 0.3 + features.rms * 0.2;
    phase += musicClock(dt, energy, features.beatPulse, Number(params.speed) || 1);
    const cols = 10 + Math.floor(Number(params.complexity) * 10);
    const rows = 6 + Math.floor(Number(params.complexity) * 6);
    const padX = width * 0.08;
    const padY = height * 0.12;
    for (let j = 0; j <= rows; j++) {
      ctx.beginPath();
      for (let i = 0; i <= cols; i++) {
        const u = i / cols, v = j / rows;
        const spec = logSpectrumSample(features.spectrum, u);
        const x = padX + u * (width - padX * 2);
        const y = padY + v * (height - padY * 2) + Math.sin(u * Math.PI * 3 + phase + v * 2) * spec * 28 * Number(params.intensity);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, 0.12 + energy * 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      const u = i / cols;
      const spec = logSpectrumSample(features.spectrum, u);
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        const x = padX + u * (width - padX * 2) + Math.sin(v * Math.PI * 2 + phase * 0.7) * spec * 16;
        const y = padY + v * (height - padY * 2);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, 0.08 + spec * 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },
};
