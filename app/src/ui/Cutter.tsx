import {
  editPointsOf,
  editRangeOf,
  formatTimecode,
  projectDurationMs,
  type Project,
} from "../model";

interface Props {
  project: Project;
  onSeek: (ms: number) => void;
  onIn: () => void;
  onOut: () => void;
  onClear: () => void;
  onSplit: () => void;
  onTrimIn: (ripple: boolean) => void;
  onTrimOut: (ripple: boolean) => void;
  onExtract: () => void;
  onLift: () => void;
}

export function Cutter(props: Props) {
  const { project } = props;
  const range = editRangeOf(project);
  const durationMs = projectDurationMs(project);
  const points = editPointsOf(project);
  const hasClips = project.audio.length + project.vis.length > 0;

  return (
    <div className="cutter cutter-strip" data-testid="cutter">
      <div className="cutter-title">Cutter</div>
      <div className="cutter-edit">
        <span className="cutter-pair" data-testid="cutter-in">
          IN {project.inPointMs == null ? "—" : formatTimecode(project.inPointMs)}
        </span>
        <span className="cutter-pair" data-testid="cutter-out">
          OUT {project.outPointMs == null ? "—" : formatTimecode(project.outPointMs)}
        </span>
        {range ? (
          <span className="cutter-pair" data-testid="cutter-range">
            {formatTimecode(range.outMs - range.inMs)} selected
          </span>
        ) : (
          <span className="cutter-empty" data-testid="cutter-empty">
            {hasClips ? "Mark IN / OUT, then extract or lift." : "Import audio to cut."}
          </span>
        )}
      </div>
      <div className="cutter-actions">
        <button type="button" data-testid="cutter-in-btn" onClick={props.onIn}>
          IN
        </button>
        <button type="button" data-testid="cutter-out-btn" onClick={props.onOut}>
          OUT
        </button>
        <button type="button" data-testid="cutter-clear-btn" onClick={props.onClear} disabled={!project.inPointMs && !project.outPointMs}>
          Clear
        </button>
        <button type="button" data-testid="cutter-split-btn" onClick={props.onSplit} disabled={!hasClips}>
          Split
        </button>
        <button type="button" data-testid="cutter-trim-in-btn" onClick={() => props.onTrimIn(false)} disabled={!hasClips}>
          Trim IN
        </button>
        <button type="button" data-testid="cutter-trim-out-btn" onClick={() => props.onTrimOut(false)} disabled={!hasClips}>
          Trim OUT
        </button>
        <button type="button" data-testid="cutter-ripple-in-btn" onClick={() => props.onTrimIn(true)} disabled={!hasClips}>
          Ripple IN
        </button>
        <button type="button" data-testid="cutter-ripple-out-btn" onClick={() => props.onTrimOut(true)} disabled={!hasClips}>
          Ripple OUT
        </button>
        <button type="button" data-testid="cutter-extract-btn" onClick={props.onExtract} disabled={!range}>
          Extract
        </button>
        <button type="button" data-testid="cutter-lift-btn" onClick={props.onLift} disabled={!range}>
          Lift
        </button>
      </div>
      <CutStrip
        points={points}
        playheadMs={project.playheadMs}
        durationMs={Math.max(durationMs, 1)}
        inMs={project.inPointMs}
        outMs={project.outPointMs}
        onSeek={props.onSeek}
      />
    </div>
  );
}

function CutStrip({
  points,
  playheadMs,
  durationMs,
  inMs,
  outMs,
  onSeek,
}: {
  points: number[];
  playheadMs: number;
  durationMs: number;
  inMs: number | null;
  outMs: number | null;
  onSeek: (ms: number) => void;
}) {
  const nearest = points.reduce((best, ms) =>
    Math.abs(ms - playheadMs) < Math.abs(best - playheadMs) ? ms : best,
  0);
  return (
    <div
      className="cut-strip"
      data-testid="cut-strip"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        onSeek((x / Math.max(1, rect.width)) * durationMs);
      }}
    >
      <div className="cut-strip-track">
        {inMs != null && outMs != null && outMs > inMs ? (
          <span
            className="cut-strip-range"
            style={{
              left: `${(inMs / durationMs) * 100}%`,
              width: `${((outMs - inMs) / durationMs) * 100}%`,
            }}
          />
        ) : null}
        {points.map((ms) => (
          <button
            key={ms}
            type="button"
            className={`cut-strip-tick${ms === nearest ? " current" : ""}`}
            data-testid="cut-strip-tick"
            data-ms={String(ms)}
            title={`${Math.round(ms)}ms`}
            style={{ left: `${(ms / durationMs) * 100}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onSeek(ms);
            }}
          />
        ))}
        <span className="cut-strip-playhead" style={{ left: `${(playheadMs / durationMs) * 100}%` }} />
      </div>
    </div>
  );
}
