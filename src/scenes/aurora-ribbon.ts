import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import { musicClock, logSpectrumSample } from "../draw/motion";

let phase = 0;

export const auroraRibbonScene: Scene = {
  id: "aurora-ribbon",
  name: "Aurora Ribbon",
  description: "Stacked luminous ribbons — melody in the mids, bloom on bass",
  defaultParams: {
    intensity: 0.9,
    colorPrimary: "#ff8a4c",
    colorSecondary: "#070714",
    speed: 0.85,
    complexity: 0.75,
    bloom: 0.7,
  },
  onEnter() { phase = 0; },
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const energy = features.rms * 0.4 + features.mid * 0.4 + features.bass * 0.2;
    phase += musicClock(dt, energy, features.beatPulse, Number(params.speed) || 1);
    const ribbons = 5 + Math.floor(Number(params.complexity) * 4);
    const midY = height * 0.5;
    const step = Math.max(1, Math.floor(width / 480));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let r = 0; r < ribbons; r++) {
      const yOff = (r - (ribbons - 1) / 2) * height * 0.045;
      ctx.beginPath();
      for (let x = 0; x <= width; x += step) {
        const t = x / width;
        const spec = logSpectrumSample(features.spectrum, t);
        const amp = (0.04 + energy * 0.18 + spec * 0.22) * height * Number(params.intensity);
        const y = midY + yOff + Math.sin(t * Math.PI * 2.4 + phase * 0.7 + r * 0.35) * amp + Math.sin(t * Math.PI * 5.1 + phase * 0.35 + r) * amp * 0.22;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, (0.22 - r * 0.018) * (0.4 + energy));
      ctx.lineWidth = 1.4 + (ribbons - r) * 0.35 + features.beatPulse * 1.2;
      ctx.stroke();
    }
    const cx = width / 2, cy = height / 2;
    const core = 10 + features.bass * 28 * Number(params.intensity) + features.beatPulse * 16;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 3);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.25, hexToRgba(params.colorPrimary as string, 0.55));
    g.addColorStop(1, hexToRgba(params.colorPrimary as string, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, core * 3, 0, Math.PI * 2);
    ctx.fill();
  },
};
