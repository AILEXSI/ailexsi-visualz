import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";
import { hexToRgba } from "../draw/color";
import { musicClock } from "../draw/motion";

let rot = 0;

export const kickSunScene: Scene = {
  id: "kick-sun",
  name: "Kick Sun",
  description: "Soft sun + rays that open only on kick / bass",
  defaultParams: {
    intensity: 0.88,
    colorPrimary: "#ffb347",
    colorSecondary: "#08060a",
    speed: 0.55,
    complexity: 0.6,
    bloom: 0.8,
  },
  onEnter() { rot = 0; },
  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const energy = features.bass * 0.7 + features.rms * 0.3;
    rot += musicClock(dt, energy, features.beatPulse, Number(params.speed) || 1);
    const cx = width / 2, cy = height / 2;
    const rays = 16 + Math.floor(Number(params.complexity) * 16);
    const reach = Math.min(width, height) * (0.22 + energy * 0.28 * Number(params.intensity) + features.beatPulse * 0.12);
    ctx.lineCap = "round";
    for (let i = 0; i < rays; i++) {
      const a = rot * 0.4 + (i / rays) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * reach * 0.25, cy + Math.sin(a) * reach * 0.25);
      ctx.lineTo(cx + Math.cos(a) * reach * (0.85 + (i % 2) * 0.18), cy + Math.sin(a) * reach * (0.85 + (i % 2) * 0.18));
      ctx.strokeStyle = hexToRgba(params.colorPrimary as string, 0.08 + energy * 0.28);
      ctx.lineWidth = 1.5 + features.beatPulse * 3;
      ctx.stroke();
    }
    const coreR = 16 + features.bass * 36 * Number(params.intensity) + features.beatPulse * 14;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.8);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.2, hexToRgba(params.colorPrimary as string, 0.75));
    g.addColorStop(0.55, hexToRgba(params.colorPrimary as string, 0.18));
    g.addColorStop(1, hexToRgba(params.colorPrimary as string, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 2.8, 0, Math.PI * 2);
    ctx.fill();
  },
};
