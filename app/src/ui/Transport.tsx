import { FRAME_MS, formatTimecode, loopRangeOf, type Project } from "../model";

interface Props {
  project: Project;
  playing: boolean;
  durationMs: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: (deltaMs: number) => void;
  onToggleLoop: () => void;
  onSetLoop: () => void;
  onSeek: (ms: number) => void;
  onIn: () => void;
  onOut: () => void;
  onClear: () => void;
  onSplit: () => void;
}

export function Transport(props: Props) {
  const range = loopRangeOf(props.project);
  const loopOn = props.project.loop;
  return (
    <div className="transport" data-testid="transport">
      <div className="transport-group" data-group="play">
        <button type="button" data-testid="play-btn" onClick={props.onPlay} disabled={props.playing}>
          Play
        </button>
        <button type="button" data-testid="pause-btn" onClick={props.onPause} disabled={!props.playing}>
          Pause
        </button>
        <button type="button" data-testid="stop-btn" onClick={props.onStop}>
          Stop
        </button>
        <button type="button" onClick={() => props.onStep(-FRAME_MS)}>
          −1f
        </button>
        <button type="button" onClick={() => props.onStep(FRAME_MS)}>
          +1f
        </button>
      </div>
      <div className="transport-group" data-group="loop">
        <button
          type="button"
          className={loopOn ? "active loop-armed" : ""}
          data-testid="loop-btn"
          aria-pressed={loopOn}
          title={loopOn ? "Loop on — playback repeats the IN/OUT region" : "Loop off"}
          onClick={props.onToggleLoop}
        >
          Loop
        </button>
        <button
          type="button"
          data-testid="set-loop-btn"
          title="Set loop region (IN/OUT) and enable Loop"
          onClick={props.onSetLoop}
        >
          Set Loop
        </button>
      </div>
      <div className="transport-group" data-group="edit">
        <button type="button" data-testid="in-btn" onClick={props.onIn} title="Set IN (I)">
          IN
        </button>
        <button type="button" data-testid="out-btn" onClick={props.onOut} title="Set OUT (O) — completes loop">
          OUT
        </button>
        <button
          type="button"
          data-testid="clear-btn"
          onClick={props.onClear}
          disabled={props.project.inPointMs == null && props.project.outPointMs == null}
          title="Clear IN/OUT (X)"
        >
          Clear
        </button>
        <button
          type="button"
          data-testid="split-btn"
          onClick={props.onSplit}
          disabled={!props.project.audio.length}
          title="Split at playhead (S / V)"
        >
          Split
        </button>
      </div>
      <div className="transport-group" data-group="time">
        <span className="timecode" data-testid="timecode">
          {formatTimecode(props.project.playheadMs)}
        </span>
        <span className="timecode-sep">/</span>
        <span className="timecode muted" data-testid="duration">
          {formatTimecode(props.durationMs)}
        </span>
        <span className="transport-marks">
          <button
            type="button"
            data-testid="goto-in"
            title="Go to IN"
            disabled={props.project.inPointMs == null}
            onClick={() => {
              if (props.project.inPointMs != null) props.onSeek(props.project.inPointMs);
            }}
          >
            IN {props.project.inPointMs == null ? "—" : formatTimecode(props.project.inPointMs)}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            data-testid="goto-out"
            title="Go to OUT"
            disabled={props.project.outPointMs == null}
            onClick={() => {
              if (props.project.outPointMs != null) props.onSeek(props.project.outPointMs);
            }}
          >
            OUT {props.project.outPointMs == null ? "—" : formatTimecode(props.project.outPointMs)}
          </button>
          {range && loopOn ? (
            <span className="loop-badge" data-testid="loop-badge">
              LOOP {formatTimecode(range.outMs - range.inMs)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
