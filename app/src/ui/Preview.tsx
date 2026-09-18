import { useEffect, useRef } from "react";
import {
  createFeatureExtractor,
  createVisualEngine,
  silentFeatures,
  type FeatureExtractor,
  type OfflineFeatureExtractor,
  type VisualEngine,
} from "@ailexsi/visualz";
import type { Project } from "../model";

interface Props {
  project: Project;
  playing: boolean;
  audioEl: HTMLAudioElement | null;
  extractor: OfflineFeatureExtractor | null;
}

export function Preview(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualEngine | null>(null);
  const liveRef = useRef<FeatureExtractor | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hookedUrl = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createVisualEngine({
      canvas,
      initialSceneId: props.project.sceneId,
      preserveDrawingBuffer: true,
    });
    engineRef.current = engine;
    const fit = () => {
      const wrap = canvas.parentElement;
      if (!wrap) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.floor(wrap.clientWidth * dpr));
      const h = Math.max(2, Math.floor(wrap.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      engine.resize(w, h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      ro.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setScene(props.project.sceneId);
  }, [props.project.sceneId]);

  useEffect(() => {
    const audio = props.audioEl;
    const url = props.project.audio?.objectUrl ?? null;
    if (!audio || !url) {
      liveRef.current?.disconnect();
      liveRef.current = null;
      hookedUrl.current = null;
      return;
    }
    if (hookedUrl.current === url && liveRef.current) return;
    liveRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => undefined);
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaElementSource(audio);
    liveRef.current = createFeatureExtractor(ctx, src);
    src.connect(ctx.destination);
    hookedUrl.current = url;
    return () => {
      liveRef.current?.disconnect();
      liveRef.current = null;
      ctx.close().catch(() => undefined);
      if (audioCtxRef.current === ctx) audioCtxRef.current = null;
      hookedUrl.current = null;
    };
  }, [props.audioEl, props.project.audio?.objectUrl]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const audio = props.audioEl;

    if (props.playing && audio) {
      engine.start();
      let raf = 0;
      const tick = () => {
        const live = liveRef.current;
        if (live) engine.setFeatures(live.sample(audio.currentTime * 1000));
        raf = requestAnimationFrame(tick);
      };
      tick();
      audioCtxRef.current?.resume().catch(() => undefined);
      return () => {
        cancelAnimationFrame(raf);
        engine.stop();
      };
    }

    engine.stop();
    const t = props.project.playheadMs;
    engine.setFeatures(props.extractor ? props.extractor.sample(t) : silentFeatures(t));
    engine.step(1 / 30);
  }, [props.playing, props.project.playheadMs, props.project.sceneId, props.extractor, props.audioEl]);

  return (
    <div className="preview-wrap" data-testid="preview">
      <div className="preview-stage">
        <canvas ref={canvasRef} data-testid="visualizer-canvas" />
        {!props.project.audio ? (
          <div className="preview-empty">Import an audio file to generate visuals</div>
        ) : null}
      </div>
    </div>
  );
}
