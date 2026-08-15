/**
 * AILEXSI Visualz — Public API
 * Version: 0.1.0-blueprint
 *
 * From-scratch audio-reactive visualizer engine.
 * No external visualizer code. No AGPL.
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

/** Registry of available scenes */
const sceneRegistry = new Map<string, Scene>();

export function registerScene(scene: Scene): void {
  sceneRegistry.set(scene.id, scene);
}

function ensureBuiltinsRegistered(): void {
  if (sceneRegistry.size > 0) return;
  for (const s of builtinScenes) {
    sceneRegistry.set(s.id, s);
  }
}

/**
 * Create the visual engine.
 */
export function createVisualEngine(
  options: VisualEngineOptions
): VisualEngine {
  ensureBuiltinsRegistered();

  const canvas = options.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D context from canvas");
  }

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
    timeMs: 0,
    rms: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    spectrum: new Float32Array(64),
    onset: false,
    beatPulse: 0,
  };

  let lastTime = performance.now();
  let beatPulseDecay = 0;

  // Call onEnter for initial scene
  initialScene?.onEnter?.({
    width: canvas.width,
    height: canvas.height,
    ctx,
  }, params);

  function frame(now: number) {
    if (!isPlaying) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Local decay if host doesn't update beatPulse every frame
    if (lastFeatures.beatPulse > 0) {
      beatPulseDecay = Math.max(lastFeatures.beatPulse, beatPulseDecay);
    }
    beatPulseDecay = Math.max(0, beatPulseDecay - dt * 3.5);
    const features: AudioFeatures = {
      ...lastFeatures,
      beatPulse: Math.max(lastFeatures.beatPulse, beatPulseDecay),
    };

    const scene = sceneRegistry.get(currentSceneId);
    // Clear
    ctx.fillStyle = (params.colorSecondary as string) || "#0a0a12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (scene) {
      scene.render(
        { width: canvas.width, height: canvas.height, ctx },
        features,
        params,
        dt
      );
    } else {
      ctx.fillStyle = "#ff6b35";
      ctx.font = "16px sans-serif";
      ctx.fillText(`Scene "${currentSceneId}" not found`, 20, 40);
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
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },

    setFeatures(features: AudioFeatures) {
      lastFeatures = features;
      if (features.onset || features.beatPulse > 0.5) {
        beatPulseDecay = Math.max(beatPulseDecay, features.beatPulse || 1);
      }
    },

    setScene(sceneId: string) {
      const next = sceneRegistry.get(sceneId);
      if (!next) {
        console.warn(`[visualz] Scene "${sceneId}" not found`);
        return;
      }
      const prev = sceneRegistry.get(currentSceneId);
      prev?.onExit?.();
      currentSceneId = sceneId;
      params = { ...next.defaultParams, ...params };
      next.onEnter?.({
        width: canvas.width,
        height: canvas.height,
        ctx,
      }, params);
    },

    setParams(partial: Partial<SceneParams>) {
      params = { ...params, ...partial };
    },

    listScenes() {
      return Array.from(sceneRegistry.values()).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      }));
    },

    resize(width: number, height: number) {
      canvas.width = width;
      canvas.height = height;
    },

    getState(): VisualState {
      return {
        currentSceneId,
        params: { ...params },
        isPlaying,
        width: canvas.width,
        height: canvas.height,
      };
    },

    async captureFrame(): Promise<Blob> {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        }, "image/png");
      });
    },

    destroy() {
      this.stop();
      const prev = sceneRegistry.get(currentSceneId);
      prev?.onExit?.();
    },
  };
}

export * from "./types";
export { builtinScenes } from "./scenes";
