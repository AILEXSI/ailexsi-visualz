/**
 * AILEXSI Visualz — Public API
 * Version: 0.1.1-songlock
 */

import type {
  AudioFeatures,
  Scene,
  SceneParams,
  VisualEngineOptions,
  VisualState,
} from "./types";
import { builtinScenes } from "./scenes";

export interface VisualEngine {
  start(): void;
  stop(): void;
  setFeatures(features: AudioFeatures): void;
  setScene(sceneId: string): void;
  setParams(params: Partial<SceneParams>): void;
  listScenes(): Array<{ id: string; name: string; description?: string }>;
  resize(width: number, height: number): void;
  getState(): VisualState;
  captureFrame(): Promise<Blob>;
  destroy(): void;
}

const sceneRegistry = new Map<string, Scene>();

export function registerScene(scene: Scene): void {
  sceneRegistry.set(scene.id, scene);
}

function ensureBuiltinsRegistered(): void {
  if (sceneRegistry.size > 0) return;
  for (const s of builtinScenes) sceneRegistry.set(s.id, s);
}

function hexToRgb(hex: string): string {
  const h = String(hex || "#0a0a12").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 10;
  const g = parseInt(full.slice(2, 4), 16) || 10;
  const b = parseInt(full.slice(4, 6), 16) || 18;
  return `${r},${g},${b}`;
}

export function createVisualEngine(options: VisualEngineOptions): VisualEngine {
  ensureBuiltinsRegistered();
  const canvas = options.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context from canvas");

  let currentSceneId = options.initialSceneId ?? "resonance-wave";
  const initialScene = sceneRegistry.get(currentSceneId) ?? builtinScenes[0];
  if (initialScene) currentSceneId = initialScene.id;

  let params: SceneParams = {
    intensity: 0.75,
    colorPrimary: "#ff6b35",
    colorSecondary: "#0a0a12",
    speed: 1,
    complexity: 0.55,
    ...(initialScene?.defaultParams ?? {}),
    ...options.initialParams,
  };

  let isPlaying = false;
  let rafId: number | null = null;
  let lastFeatures: AudioFeatures = {
    timeMs: 0, rms: 0, bass: 0, mid: 0, treble: 0,
    spectrum: new Float32Array(64), onset: false, beatPulse: 0,
  };
  let lastTime = performance.now();
  let beatPulseDecay = 0;

  initialScene?.onEnter?.({ width: canvas.width, height: canvas.height, ctx }, params);

  function frame(now: number) {
    if (!isPlaying) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (lastFeatures.beatPulse > 0) beatPulseDecay = Math.max(lastFeatures.beatPulse, beatPulseDecay);
    const energy = lastFeatures.rms + lastFeatures.bass;
    beatPulseDecay = Math.max(0, beatPulseDecay - dt * (energy < 0.04 ? 8 : 3.2));
    const features: AudioFeatures = {
      ...lastFeatures,
      beatPulse: Math.max(lastFeatures.beatPulse, beatPulseDecay),
    };
    const scene = sceneRegistry.get(currentSceneId);
    const rgb = hexToRgb(String(params.colorSecondary || "#0a0a12"));
    ctx.fillStyle = `rgba(${rgb},0.22)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (scene) {
      scene.render({ width: canvas.width, height: canvas.height, ctx }, features, params, dt);
    }
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (isPlaying) return;
      isPlaying = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      isPlaying = false;
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    },
    setFeatures(features: AudioFeatures) {
      lastFeatures = features;
      if (features.onset || features.beatPulse > 0.5) {
        beatPulseDecay = Math.max(beatPulseDecay, features.beatPulse || 1);
      }
    },
    setScene(sceneId: string) {
      const next = sceneRegistry.get(sceneId);
      if (!next) return;
      sceneRegistry.get(currentSceneId)?.onExit?.();
      currentSceneId = sceneId;
      params = { ...next.defaultParams, ...params };
      next.onEnter?.({ width: canvas.width, height: canvas.height, ctx }, params);
    },
    setParams(partial: Partial<SceneParams>) { params = { ...params, ...partial }; },
    listScenes() {
      return Array.from(sceneRegistry.values()).map((s) => ({ id: s.id, name: s.name, description: s.description }));
    },
    resize(width: number, height: number) { canvas.width = width; canvas.height = height; },
    getState(): VisualState {
      return { currentSceneId, params: { ...params }, isPlaying, width: canvas.width, height: canvas.height };
    },
    async captureFrame(): Promise<Blob> {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")), "image/png");
      });
    },
    destroy() { this.stop(); sceneRegistry.get(currentSceneId)?.onExit?.(); },
  };
}

export * from "./types";
export { builtinScenes } from "./scenes";
