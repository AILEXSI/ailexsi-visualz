import type { MouseEvent } from "react";
import { formatTimecode, projectDurationMs, type Project } from "../model";

interface Props {
  project: Project;
  durationMs: number;
  onSeek: (ms: number) => void;
  onZoom: (pxPerSec: number) => void;
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
  return (ms / 1000) * zoom;
}

export function Timeline(props: Props) {
  const { project } = props;
  const durationMs = Math.max(props.durationMs, projectDurationMs(project), LANE_MIN_MS);
  const zoom = project.zoomPxPerSec;
  const width = Math.max(400, msToX(durationMs, zoom) + 48);
  const playX = msToX(project.playheadMs, zoom);

  const seekFromEvent = (e: MouseEvent<HTMLElement>) => {
    const body = e.currentTarget;
    const rect = body.getBoundingClientRect();
    const x = e.clientX - rect.left + body.scrollLeft;
    props.onSeek((x / zoom) * 1000);
  };

  return (
    <div className="timeline" data-testid="timeline">
      <div className="timeline-tools">
        <button type="button" onClick={() => props.onZoom(Math.max(20, zoom / 1.25))}>−</button>
        <button type="button" onClick={() => props.onZoom(Math.min(400, zoom * 1.25))}>+</button>
        <span className="timeline-zoom">{Math.round(zoom)} px/s</span>
        <span className="timeline-hint">1 visual track · 1 audio track</span>
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
            <span className="playhead" style={{ left: playX }} />
          </div>
        </div>
      </div>
      <div className="timeline-lanes">
        <div className="lane vis-lane" data-testid="lane-VIS">
          <div className="lane-label">VIS</div>
          <div className="lane-body" onClick={seekFromEvent}>
            <div className="lane-inner" style={{ width }}>
              {project.vis ? (
                <div
                  className="vis-span"
                  data-testid="vis-clip"
                  style={{
                    left: msToX(project.vis.startMs, zoom),
                    width: Math.max(8, msToX(project.vis.durationMs, zoom)),
                  }}
                >
                  {project.vis.sceneId}
                </div>
              ) : (
                <div className="lane-empty">Import audio — visuals generate here</div>
              )}
              <span className="playhead" style={{ left: playX }} />
            </div>
          </div>
        </div>
        <div className="lane audio-lane" data-testid="lane-A1">
          <div className="lane-label">A1</div>
          <div className="lane-body" onClick={seekFromEvent}>
            <div className="lane-inner" style={{ width }}>
              {project.audio ? (
                <div
                  className="clip audio"
                  data-testid="audio-clip"
                  style={{
                    left: msToX(project.audio.startMs, zoom),
                    width: Math.max(8, msToX(project.audio.durationMs, zoom)),
                  }}
                >
                  <span className="clip-name">{project.audio.name}</span>
                  <Waveform peaks={project.audio.peaks} />
                </div>
              ) : (
                <div className="lane-empty">Drop or import one audio file</div>
              )}
              <span className="playhead" style={{ left: playX }} />
            </div>
          </div>
        </div>
      </div>
    </div>
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
