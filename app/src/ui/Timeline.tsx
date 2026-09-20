import { useEffect, useState, type MouseEvent } from "react";
import {
  formatTimecode,
  peaksForWindow,
  projectDurationMs,
  type AudioClip,
  type Project,
  type VisClip,
} from "../model";

interface Props {
  project: Project;
  durationMs: number;
  cutter: boolean;
  onSeek: (ms: number) => void;
  onZoom: (pxPerSec: number) => void;
  onScroll?: (ms: number) => void;
  onFit?: () => void;
  onMarker?: () => void;
  onSelectVis?: (id: string) => void;
  onVisStyle?: (id: string) => void;
  onVisQuelle?: (id: string) => void;
  onTrimEdge?: (edge: "in" | "out", nextEdgeMs: number, ripple: boolean) => void;
  onLoopIn?: (ms: number) => void;
  onLoopOut?: (ms: number) => void;
  onLoopRange?: (inMs: number, outMs: number) => void;
  onRulerMark?: (ms: number) => void;
}

const LANE_MIN_MS = 8_000;

function ticks(durationMs: number, zoom: number, width: number): number[] {
  const span = Math.max(durationMs, LANE_MIN_MS);
  const visibleMs = (width / Math.max(1, zoom)) * 1000;
  const step = visibleMs > 20_000 ? 5_000 : visibleMs > 8_000 ? 2_000 : 1_000;
  const out: number[] = [];
  for (let t = 0; t <= span + step; t += step) out.push(t);
  return out;
}

function msToX(ms: number, zoom: number): number {
  const x = (ms / 1000) * zoom;
  return Number.isFinite(x) ? x : 0;
}

export function Timeline(props: Props) {
  const { project } = props;
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: globalThis.MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".clip-menu") || t?.closest("[data-testid='vis-clip']")) return;
      setMenu(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);
  const durationMs = Math.max(props.durationMs, projectDurationMs(project), LANE_MIN_MS);
  const zoom = project.zoomPxPerSec;
  const width = Math.max(400, msToX(durationMs, zoom) + 48);
  const scrollX = msToX(project.scrollMs, zoom);
  const playX = msToX(project.playheadMs, zoom);
  const maxScroll = Math.max(0, (durationMs / 1000) * zoom - 400);
  const shift = { transform: `translateX(${-scrollX}px)` };

  const seekFromEvent = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("[data-edge], .loop-handle, .in-out")) return;
    const body = e.currentTarget;
    const rect = body.getBoundingClientRect();
    const x = e.clientX - rect.left + body.scrollLeft;
    props.onSeek((x / zoom) * 1000);
  };

  const startTrim = (edge: "in" | "out") => (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!props.onTrimEdge) return;
    const body = (e.currentTarget.closest(".lane-body") ?? e.currentTarget.parentElement) as HTMLElement | null;
    const move = (ev: globalThis.MouseEvent) => {
      if (!body) return;
      const rect = body.getBoundingClientRect();
      const x = ev.clientX - rect.left + body.scrollLeft;
      props.onTrimEdge?.(edge, (x / zoom) * 1000, ev.shiftKey);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="timeline" data-testid="timeline">
      <div className="timeline-tools">
        <button type="button" data-testid="timeline-zoom-out" onClick={() => props.onZoom(Math.max(20, zoom / 1.25))}>−</button>
        <button type="button" data-testid="timeline-zoom-in" onClick={() => props.onZoom(Math.min(400, zoom * 1.25))}>+</button>
        <span className="timeline-zoom" data-testid="timeline-zoom">{Math.round(zoom)} px/s</span>
        <button type="button" data-testid="timeline-fit" title="Fit (F)" onClick={props.onFit}>Fit</button>
        <button type="button" data-testid="timeline-marker" title="Marker (M)" onClick={props.onMarker}>Marker</button>
        <label className="timeline-pan">
          Pan
          <input
            type="range"
            data-testid="timeline-pan"
            min={0}
            max={maxScroll}
            value={Math.min(maxScroll, scrollX)}
            onChange={(e) => props.onScroll?.((Number(e.target.value) / zoom) * 1000)}
          />
        </label>
        <span className="timeline-hint">
          {props.cutter ? "Cutter · drag edges · Shift+drag = ripple" : "1 visual track · 1 audio track"}
        </span>
      </div>
      <div className="ruler">
        <div className="ruler-gutter" />
        <div
          className="ruler-body"
          data-testid="ruler"
          onClick={seekFromEvent}
          onContextMenu={(e) => {
            e.preventDefault();
            const body = e.currentTarget;
            const rect = body.getBoundingClientRect();
            const x = e.clientX - rect.left + body.scrollLeft;
            props.onRulerMark?.((x / zoom) * 1000);
          }}
        >
          <div className="ruler-inner" style={{ width, ...shift }}>
            {ticks(durationMs, zoom, width).map((t) => (
              <span key={t} className="ruler-tick" style={{ left: msToX(t, zoom) }}>
                {formatTimecode(t).slice(0, 5)}
              </span>
            ))}
            {(project.markers ?? []).map((m) => (
              <span
                key={m.id}
                className="marker-flag"
                data-testid="marker"
                title={m.label}
                style={{ left: msToX(m.timeMs, zoom) }}
              >
                {m.label}
              </span>
            ))}
            <LoopOverlay
              project={project}
              zoom={zoom}
              interactive
              onLoopIn={props.onLoopIn}
              onLoopOut={props.onLoopOut}
              onLoopRange={props.onLoopRange}
            />
            <span className="playhead" style={{ left: playX }} />
          </div>
        </div>
      </div>
      <div className="timeline-lanes">
        <div className="lane vis-lane" data-testid="lane-VIS">
          <div className="lane-label">VIS</div>
          <div className="lane-body" onClick={seekFromEvent}>
            <div className="lane-inner" style={{ width, ...shift }}>
              {project.vis.length ? (
                project.vis.map((clip) => (
                  <VisBlock
                    key={clip.id}
                    clip={clip}
                    zoom={zoom}
                    cutter={props.cutter}
                    selected={project.selectedVisId === clip.id}
                    onSelect={() => props.onSelectVis?.(clip.id)}
                    onStyle={() => props.onVisStyle?.(clip.id)}
                    onQuelle={() => props.onVisQuelle?.(clip.id)}
                    onContext={(x, y) => setMenu({ x, y, id: clip.id })}
                    onTrimIn={startTrim("in")}
                    onTrimOut={startTrim("out")}
                  />
                ))
              ) : (
                <div className="lane-empty">Import audio — visuals generate here</div>
              )}
              <LoopOverlay project={project} zoom={zoom} />
              <span className="playhead" style={{ left: playX }} />
            </div>
          </div>
        </div>
        <div className="lane audio-lane" data-testid="lane-A1">
          <div className="lane-label">A1</div>
          <div className="lane-body" onClick={seekFromEvent}>
            <div className="lane-inner" style={{ width, ...shift }}>
              {project.audio.length ? (
                project.audio.map((clip) => (
                  <AudioBlock
                    key={clip.id}
                    clip={clip}
                    sourceDurationMs={project.source?.sourceDurationMs ?? clip.sourceOutMs}
                    peaks={project.source?.peaks ?? []}
                    zoom={zoom}
                    cutter={props.cutter}
                    onTrimIn={startTrim("in")}
                    onTrimOut={startTrim("out")}
                  />
                ))
              ) : (
                <div className="lane-empty">Drop or import one audio file</div>
              )}
              <LoopOverlay project={project} zoom={zoom} />
              <span className="playhead" style={{ left: playX }} />
            </div>
          </div>
        </div>
      </div>
      {menu ? (
        <div
          className="clip-menu"
          data-testid="vis-clip-menu"
          style={{ position: "fixed", left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            data-testid="vis-menu-style"
            onClick={() => {
              props.onSelectVis?.(menu.id);
              props.onVisStyle?.(menu.id);
              setMenu(null);
            }}
          >
            Style
          </button>
          <button
            type="button"
            data-testid="vis-menu-quelle"
            onClick={() => {
              props.onSelectVis?.(menu.id);
              props.onVisQuelle?.(menu.id);
              setMenu(null);
            }}
          >
            Quelle
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LoopOverlay({
  project,
  zoom,
  interactive = false,
  onLoopIn,
  onLoopOut,
  onLoopRange,
}: {
  project: Project;
  zoom: number;
  interactive?: boolean;
  onLoopIn?: (ms: number) => void;
  onLoopOut?: (ms: number) => void;
  onLoopRange?: (inMs: number, outMs: number) => void;
}) {
  const inMs = project.inPointMs;
  const outMs = project.outPointMs;
  const hasRange = inMs != null && outMs != null && outMs > inMs;
  const left = hasRange ? msToX(inMs, zoom) : inMs != null ? msToX(inMs, zoom) : 0;
  const width = hasRange ? msToX(outMs - inMs, zoom) : 0;

  const startHandle = (
    edge: "in" | "out",
    origin: number,
    apply: ((ms: number) => void) | undefined,
  ) => (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!apply) return;
    const originX = e.clientX;
    const move = (ev: globalThis.MouseEvent) => {
      const next = origin + ((ev.clientX - originX) / zoom) * 1000;
      apply(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const startMove = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onLoopRange || inMs == null || outMs == null) return;
    const originX = e.clientX;
    const originIn = inMs;
    const span = outMs - inMs;
    const move = (ev: globalThis.MouseEvent) => {
      const nextIn = Math.max(0, originIn + ((ev.clientX - originX) / zoom) * 1000);
      onLoopRange(nextIn, nextIn + span);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <>
      {inMs != null ? (
        <span className="mark mark-in" data-testid="mark-in" style={{ left: msToX(inMs, zoom) }} />
      ) : null}
      {outMs != null ? (
        <span className="mark mark-out" data-testid="mark-out" style={{ left: msToX(outMs, zoom) }} />
      ) : null}
      {hasRange ? (
        <div
          className={`in-out${interactive ? " interactive" : ""}${project.loop ? " loop-on" : ""}`}
          data-testid={interactive ? "loop-range" : undefined}
          style={{ left, width }}
          onMouseDown={interactive ? startMove : undefined}
        />
      ) : null}
      {interactive && hasRange ? (
        <>
          <button
            type="button"
            className="loop-handle in"
            data-testid="loop-handle-in"
            title="Loop IN"
            style={{ left }}
            onMouseDown={startHandle("in", inMs, onLoopIn)}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="loop-handle out"
            data-testid="loop-handle-out"
            title="Loop OUT"
            style={{ left: left + width }}
            onMouseDown={startHandle("out", outMs, onLoopOut)}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      ) : null}
    </>
  );
}

function VisBlock({
  clip,
  zoom,
  cutter,
  selected,
  onSelect,
  onContext,
  onTrimIn,
  onTrimOut,
}: {
  clip: VisClip;
  zoom: number;
  cutter: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onStyle?: () => void;
  onQuelle?: () => void;
  onContext?: (x: number, y: number) => void;
  onTrimIn: (e: MouseEvent<HTMLButtonElement>) => void;
  onTrimOut: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      className={`vis-span${selected ? " selected" : ""}`}
      data-testid="vis-clip"
      data-scene={clip.sceneId}
      data-selected={selected ? "true" : "false"}
      style={{
        left: msToX(clip.startMs, zoom),
        width: Math.max(8, msToX(clip.durationMs, zoom)),
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.();
        onContext?.(e.clientX, e.clientY);
      }}
    >
      {cutter ? <Handle edge="in" onMouseDown={onTrimIn} /> : null}
      <span className="clip-name">{clip.sceneId}</span>
      {cutter ? <Handle edge="out" onMouseDown={onTrimOut} /> : null}
    </div>
  );
}

function AudioBlock({
  clip,
  sourceDurationMs,
  peaks,
  zoom,
  cutter,
  onTrimIn,
  onTrimOut,
}: {
  clip: AudioClip;
  sourceDurationMs: number;
  peaks: number[];
  zoom: number;
  cutter: boolean;
  onTrimIn: (e: MouseEvent<HTMLButtonElement>) => void;
  onTrimOut: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const slice = peaksForWindow(peaks, clip.sourceInMs, clip.sourceOutMs, sourceDurationMs);
  return (
    <div
      className="clip audio"
      data-testid="audio-clip"
      style={{
        left: msToX(clip.startMs, zoom),
        width: Math.max(8, msToX(clip.durationMs, zoom)),
      }}
    >
      {cutter ? <Handle edge="in" onMouseDown={onTrimIn} /> : null}
      <span className="clip-name">{clip.name}</span>
      <Waveform peaks={slice} />
      {cutter ? <Handle edge="out" onMouseDown={onTrimOut} /> : null}
    </div>
  );
}

function Handle({
  edge,
  onMouseDown,
}: {
  edge: "in" | "out";
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`clip-handle clip-handle-${edge}`}
      data-edge={edge}
      data-testid={`trim-${edge}`}
      title={edge === "in" ? "Trim in (Shift = ripple)" : "Trim out (Shift = ripple)"}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function Waveform({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  const d = peaks
    .map((p, i) => {
      const x = (i / Math.max(1, peaks.length - 1)) * 100;
      const y = 50 - Math.min(1, p) * 46;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="waveform" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
