import type { MouseEvent } from "react";
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
  onTrimEdge?: (edge: "in" | "out", nextEdgeMs: number, ripple: boolean) => void;
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
  const durationMs = Math.max(props.durationMs, projectDurationMs(project), LANE_MIN_MS);
  const zoom = project.zoomPxPerSec;
  const width = Math.max(400, msToX(durationMs, zoom) + 48);
  const playX = msToX(project.playheadMs, zoom);

  const seekFromEvent = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("[data-edge]")) return;
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
        <button type="button" onClick={() => props.onZoom(Math.max(20, zoom / 1.25))}>−</button>
        <button type="button" onClick={() => props.onZoom(Math.min(400, zoom * 1.25))}>+</button>
        <span className="timeline-zoom">{Math.round(zoom)} px/s</span>
        <span className="timeline-hint">
          {props.cutter ? "Cutter · drag edges · Shift+drag = ripple" : "1 visual track · 1 audio track"}
        </span>
      </div>
      <div className="ruler">
        <div className="ruler-gutter" />
        <div className="ruler-body" data-testid="ruler" onClick={seekFromEvent}>
          <div className="ruler-inner" style={{ width }}>
            {ticks(durationMs, zoom, width).map((t) => (
              <span key={t} className="ruler-tick" style={{ left: msToX(t, zoom) }}>
                {formatTimecode(t).slice(0, 5)}
              </span>
            ))}
            <InOutMarks project={project} zoom={zoom} />
            <span className="playhead" style={{ left: playX }} />
          </div>
        </div>
      </div>
      <div className="timeline-lanes">
        <div className="lane vis-lane" data-testid="lane-VIS">
          <div className="lane-label">VIS</div>
          <div className="lane-body" onClick={seekFromEvent}>
            <div className="lane-inner" style={{ width }}>
              {project.vis.length ? (
                project.vis.map((clip) => (
                  <VisBlock
                    key={clip.id}
                    clip={clip}
                    zoom={zoom}
                    cutter={props.cutter}
                    onTrimIn={startTrim("in")}
                    onTrimOut={startTrim("out")}
                  />
                ))
              ) : (
                <div className="lane-empty">Import audio — visuals generate here</div>
              )}
              <InOutMarks project={project} zoom={zoom} />
              <span className="playhead" style={{ left: playX }} />
            </div>
          </div>
        </div>
        <div className="lane audio-lane" data-testid="lane-A1">
          <div className="lane-label">A1</div>
          <div className="lane-body" onClick={seekFromEvent}>
            <div className="lane-inner" style={{ width }}>
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
              <InOutMarks project={project} zoom={zoom} />
              <span className="playhead" style={{ left: playX }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InOutMarks({ project, zoom }: { project: Project; zoom: number }) {
  return (
    <>
      {project.inPointMs != null ? (
        <span className="mark mark-in" data-testid="mark-in" style={{ left: msToX(project.inPointMs, zoom) }} />
      ) : null}
      {project.outPointMs != null ? (
        <span className="mark mark-out" data-testid="mark-out" style={{ left: msToX(project.outPointMs, zoom) }} />
      ) : null}
      {project.inPointMs != null && project.outPointMs != null && project.outPointMs > project.inPointMs ? (
        <span
          className="mark-range"
          style={{
            left: msToX(project.inPointMs, zoom),
            width: msToX(project.outPointMs - project.inPointMs, zoom),
          }}
        />
      ) : null}
    </>
  );
}

function VisBlock({
  clip,
  zoom,
  cutter,
  onTrimIn,
  onTrimOut,
}: {
  clip: VisClip;
  zoom: number;
  cutter: boolean;
  onTrimIn: (e: MouseEvent<HTMLButtonElement>) => void;
  onTrimOut: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      className="vis-span"
      data-testid="vis-clip"
      data-scene={clip.sceneId}
      style={{
        left: msToX(clip.startMs, zoom),
        width: Math.max(8, msToX(clip.durationMs, zoom)),
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
