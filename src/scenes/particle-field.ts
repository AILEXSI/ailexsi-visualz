/**
 * Scene: particle-field
 * Lightweight particles reacting to mid/high energy and beat.
 */

import type { Scene, SceneContext, SceneParams } from "../types";
import type { AudioFeatures } from "../types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

const particles: Particle[] = [];
const MAX = 180;

function spawn(width: number, height: number, energy: number) {
  const count = 2 + Math.floor(energy * 6);
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX) particles.shift();
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 80 * energy;
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * width * 0.15,
      y: height / 2 + (Math.random() - 0.5) * height * 0.15,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 1.5 + Math.random() * 3 * energy,
    });
  }
}

export const particleFieldScene: Scene = {
  id: "particle-field",
  name: "Particle Field",
  description: "Particles that bloom with mid/high energy and beat",
  defaultParams: {
    intensity: 0.8,
    colorPrimary: "#7c5cff",
    colorSecondary: "#0a0a12",
    speed: 1,
    complexity: 0.7,
  },

  onEnter() {
    particles.length = 0;
  },

  onExit() {
    particles.length = 0;
  },

  render(ctxWrap: SceneContext, features: AudioFeatures, params: SceneParams, dt: number) {
    const { ctx, width, height } = ctxWrap;
    const energy = (features.mid * 0.6 + features.treble * 0.4) * params.intensity;

    if (features.onset || features.beatPulse > 0.4) {
      spawn(width, height, Math.max(energy, features.beatPulse));
    } else if (Math.random() < energy * 0.15) {
      spawn(width, height, energy * 0.6);
    }

    // Soft trail by not fully clearing — host already cleared; we draw additive-ish
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * params.speed;
      p.y += p.vy * dt * params.speed;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt * (0.35 + (1 - energy) * 0.4);

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = Math.max(0, p.life) * (0.4 + energy * 0.6);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + features.beatPulse * 0.8), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(params.colorPrimary as string, alpha);
      ctx.fill();

      // tiny core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
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
