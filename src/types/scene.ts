/**
 * AILEXSI Visualz — Scene & Engine Types
 * Version: 0.1.0-blueprint
 */

import type { AudioFeatures } from "./audio";

export interface SceneParams {
  intensity: number;        // 0–1 master
  colorPrimary: string;
  colorSecondary: string;
  speed: number;
  complexity: number;       // 0–1
  [key: string]: number | string | boolean;
}

export interface SceneContext {
  width: number;
  height: number;
  /** 2D canvas context (V0.1) */
  ctx: CanvasRenderingContext2D;
  /** Optional WebGL context later */
  gl?: WebGL2RenderingContext;
}

export interface Scene {
  id: string;
  name: string;
  description?: string;
  defaultParams: SceneParams;

  /**
   * Called every frame.
   * Must be pure with respect to external state (only uses features + params + dt).
   */
  render(
    context: SceneContext,
    features: AudioFeatures,
    params: SceneParams,
    dt: number
  ): void;

  /** Optional setup when scene becomes active */
  onEnter?(context: SceneContext, params: SceneParams): void;

  /** Optional cleanup */
  onExit?(): void;
}

export interface VisualState {
  currentSceneId: string;
  params: SceneParams;
  isPlaying: boolean;
  width: number;
  height: number;
}

export interface VisualEngineOptions {
  canvas: HTMLCanvasElement;
  audioContext?: AudioContext;
  sourceNode?: AudioNode;
  initialSceneId?: string;
  initialParams?: Partial<SceneParams>;
}
