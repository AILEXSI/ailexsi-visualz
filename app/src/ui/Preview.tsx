import { useEffect, useRef } from "react";
import {
  createFeatureExtractor,
  createVisualEngine,
  silentFeatures,
  type FeatureExtractor,
  type OfflineFeatureExtractor,
  type VisualEngine,
} from "@ailexsi/visualz";
import { clipAtTime, effectiveGain, featureTimeAt, sceneAt, type MixerState, type Project } from "../model";

interface Props {
  project: Project;
  playing: boolean;
  audioEl: HTMLAudioElement | null;
  extractor: OfflineFeatureExtractor | null;
  mixer: MixerState;
  onLevels?: (a1: number, master: number) => void;
}

export function Preview(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualEngine | null>(null);
  const liveRef = useRef<FeatureExtractor | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const meterRef = useRef<AnalyserNode | null>(null);
  const hookedUrl = useRef<string | null>(null);
  const sceneNow = sceneAt(props.project, props.project.playheadMs);
  const clip = clipAtTime(props.project.vis, props.project.playheadMs);
  const styleKey = `${sceneNow}:${JSON.stringify(clip?.params ?? {})}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createVisualEngine({
      canvas,
      initialSceneId: sceneNow,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setScene(sceneNow);
    if (clip?.params) engine.setParams(clip.params);
  }, [styleKey, sceneNow, clip?.params]);

  useEffect(() => {
    const audio = props.audioEl;
    const url = props.project.source?.objectUrl ?? null;
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
    const gain = ctx.createGain();
    const meter = ctx.createAnalyser();
    meter.fftSize = 512;
    gainRef.current = gain;
    meterRef.current = meter;
    liveRef.current = createFeatureExtractor(ctx, src);
    src.connect(gain);
    gain.connect(meter);
    meter.connect(ctx.destination);
    hookedUrl.current = url;
    return () => {
      liveRef.current?.disconnect();
      liveRef.current = null;
      ctx.close().catch(() => undefined);
      if (audioCtxRef.current === ctx) audioCtxRef.current = null;
      gainRef.current = null;
      meterRef.current = null;
      hookedUrl.current = null;
    };
  }, [props.audioEl, props.project.source?.objectUrl]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = effectiveGain(props.mixer);
  }, [props.mixer]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const audio = props.audioEl;
    engine.setScene(sceneNow);
    if (clip?.params) engine.setParams(clip.params);

    if (props.playing && audio) {
      engine.start();
      const buf = new Uint8Array(meterRef.current?.fftSize ?? 512);
      let raf = 0;
      const tick = () => {
        const live = liveRef.current;
        if (live) engine.setFeatures(live.sample(audio.currentTime * 1000));
        const meter = meterRef.current;
        if (meter && props.onLevels) {
          meter.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs((buf[i]! - 128) / 128));
          const g = effectiveGain(props.mixer);
          props.onLevels(peak, peak * g);
        }
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
    const t = featureTimeAt(props.project, props.project.playheadMs);
    engine.setFeatures(props.extractor ? props.extractor.sample(t) : silentFeatures(t));
    engine.step(1 / 30);
    props.onLevels?.(0, 0);
  }, [props.playing, props.project, sceneNow, styleKey, props.extractor, props.audioEl, props.mixer, props.onLevels, clip?.params]);

  return (
    <div className="preview-wrap" data-testid="preview">
      <div className="preview-stage">
        <canvas ref={canvasRef} data-testid="visualizer-canvas" />
        {!props.project.source?.objectUrl ? (
          <div className="preview-empty">Import an audio file to generate visuals</div>
        ) : null}
      </div>
    </div>
  );
}
