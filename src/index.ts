/**
 * AILEXSI Visualz — Public API Skeleton
 * Version: 0.1.0-blueprint
 *
 * From-scratch audio-reactive visualizer engine.
 * No external visualizer code.
 */

import type {
  AudioFeatures,
  Scene,
  SceneParams,
  VisualEngineOptions,
  VisualState,
} from "./types";

export interface VisualEngine {
  start(): void;
  stop(): void;
  setFeatures(features: AudioFeatures): void;
  setScene(sceneId: string): void;
  setParams(params: Partial<SceneParams>): void;
  resize(width: number, height: number): void;
  getState(): VisualState;
  captureFrame(): Promise<Blob>;
  destroy(): void;
}

/** Registry of available scenes (filled by implementations later) */
const sceneRegistry = new Map<string, Scene>();

export function registerScene(scene: Scene): void {
  sceneRegistry.set(scene.id, scene);
}

/**
 * Create the visual engine.
 * Skeleton only — real render loop and scenes come next.
 */
export function createVisualEngine(
  options: VisualEngineOptions
): VisualEngine {
  const canvas = options.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D context from canvas");
  }

  let currentSceneId = options.initialSceneId ?? "pulse-orb";
  let params: SceneParams = {
    intensity: 0.7,
    colorPrimary: "#ff6b35",
    colorSecondary: "#1a1a2e",
    speed: 1,
    complexity: 0.5,
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
    spectrum: new Float32Array(0),
    onset: false,
    beatPulse: 0,
  };

  let lastTime = performance.now();

  function frame(now: number) {
    if (!isPlaying) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const scene = sceneRegistry.get(currentSceneId);
    if (scene) {
      // Clear
      ctx.fillStyle = params.colorSecondary || "#0a0a12";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      scene.render(
        { width: canvas.width, height: canvas.height, ctx },
        lastFeatures,
        params,
        dt
      );
    } else {
      // Fallback placeholder
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ff6b35";
      ctx.font = "16px sans-serif";
      ctx.fillText(`Scene "${currentSceneId}" not registered yet`, 20, 40);
      ctx.fillText(`RMS: ${lastFeatures.rms.toFixed(2)}`, 20, 70);
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
      sceneRegistry.clear();
    },
  };
}

export * from "./types";
