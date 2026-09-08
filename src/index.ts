/**
 * AILEXSI Visualz — Public API
 * Version: 0.3.0-cinematic
 * Scene: Canvas2D Hero + optional GPU filaments → same WebGL2 post.
 */

import type {
  AudioFeatures,
  Scene,
  SceneParams,
  VisualEngineOptions,
  VisualState,
} from "./types";
import { builtinScenes } from "./scenes";
import { applyBloom } from "./post/bloom";
import { createGlPost } from "./gl/post-pipeline";
import { createFeedbackState, stepFeedback } from "./gl/feedback";

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

  const display = options.canvas;
  const sceneCanvas = document.createElement("canvas");
  sceneCanvas.width = Math.max(2, display.width || 1280);
  sceneCanvas.height = Math.max(2, display.height || 720);

  const post = createGlPost(display);
  const ctxOrNull = (post ? sceneCanvas : display).getContext("2d");
  if (!ctxOrNull) throw new Error("Could not get 2D context");
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const drawTarget = post ? sceneCanvas : display;

  let currentSceneId = options.initialSceneId ?? "resonance-wave";
  const initialScene = sceneRegistry.get(currentSceneId) ?? builtinScenes[0];
  if (initialScene) currentSceneId = initialScene.id;

  const engineDefaults: SceneParams = {
    intensity: 0.8,
    colorPrimary: "#ff6b35",
    colorSecondary: "#0a0a12",
    speed: 1,
    complexity: 0.6,
    bloom: 0.85,
    chroma: 0.45,
    grain: 0.04,
    vignette: 0.35,
    gpuFilaments: true,
  };
  let params: SceneParams = Object.assign(
    {},
    engineDefaults,
    initialScene?.defaultParams ?? {},
    options.initialParams ?? {},
  );

  let isPlaying = false;
  let rafId: number | null = null;
  let lastFeatures: AudioFeatures = {
    timeMs: 0, rms: 0, bass: 0, mid: 0, treble: 0,
    spectrum: new Float32Array(64), onset: false, beatPulse: 0,
  };
  let lastTime = performance.now();
  let beatPulseDecay = 0;
  let clock = 0;
  const fbState = createFeedbackState();

  initialScene?.onEnter?.({ width: drawTarget.width, height: drawTarget.height, ctx }, params);

  function frame(now: number) {
    if (!isPlaying) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    clock += dt;
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
    ctx.fillRect(0, 0, drawTarget.width, drawTarget.height);
    if (scene) {
      scene.render({ width: drawTarget.width, height: drawTarget.height, ctx }, features, params, dt);
    }
    const bloomBase = typeof params.bloom === "number" ? params.bloom : 0.8;
    const bloomAmt = bloomBase * (0.5 + features.rms * 0.35 + features.beatPulse * 0.4);
    const kick = features.kick ?? features.beatPulse;
    if (post) {
      post.composite(sceneCanvas, {
        bloom: bloomAmt * 1.2,
        chroma: (typeof params.chroma === "number" ? params.chroma : 0.4) * (0.35 + features.treble),
        grain: typeof params.grain === "number" ? params.grain : 0.03,
        vignette: typeof params.vignette === "number" ? params.vignette : 0.32,
        feedback: stepFeedback(fbState, {
          kick,
          drop: features.drop ?? 0,
          energy: features.rms * 0.5 + features.bass * 0.5,
          dt,
        }),
        gpuFilaments: params.gpuFilaments !== false,
        songTimeMs: features.timeMs,
        kick,
        bass: features.bass,
        drop: features.drop ?? 0,
        trackSeed: typeof params.trackSeed === "number" ? params.trackSeed : 19770822,
        filamentCount: typeof params.filamentCount === "number" ? params.filamentCount : 24,
      }, clock);
    } else {
      applyBloom(ctx, display, bloomAmt);
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
      next.onEnter?.({ width: drawTarget.width, height: drawTarget.height, ctx }, params);
    },
    setParams(partial: Partial<SceneParams>) {
      const next: SceneParams = { ...params };
      for (const key of Object.keys(partial)) {
        const value = partial[key];
        if (value !== undefined) next[key] = value;
      }
      params = next;
    },
    listScenes() {
      return Array.from(sceneRegistry.values()).map((s) => ({ id: s.id, name: s.name, description: s.description }));
    },
    resize(width: number, height: number) {
      sceneCanvas.width = width;
      sceneCanvas.height = height;
      if (post) post.resize(width, height);
      else { display.width = width; display.height = height; }
    },
    getState(): VisualState {
      return { currentSceneId, params: { ...params }, isPlaying, width: drawTarget.width, height: drawTarget.height };
    },
    async captureFrame(): Promise<Blob> {
      const src = post ? display : drawTarget;
      return new Promise((resolve, reject) => {
        src.toBlob((blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")), "image/png");
      });
    },
    destroy() {
      this.stop();
      sceneRegistry.get(currentSceneId)?.onExit?.();
      post?.destroy();
    },
  };
}

export * from "./types";
export { builtinScenes } from "./scenes";
export { createGlPost } from "./gl/post-pipeline";
export { bloomMips } from "./gl/mip";
export { BLOOM_WEIGHTS, normalizeWeights } from "./gl/bloom-config";
export { stepFeedback, createFeedbackState } from "./gl/feedback";
export { chooseHdrFormat } from "./gl/hdr";
export { filamentParams, filamentParamsBatch } from "./gl/filament-state";
export { createFilamentPass } from "./gl/filaments";
