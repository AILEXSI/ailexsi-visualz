import { FRAME_MS, formatTimecode, type Project } from "../model";

interface Props {
  project: Project;
  playing: boolean;
  durationMs: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: (deltaMs: number) => void;
  onToggleLoop: () => void;
  onSeek: (ms: number) => void;
  onIn: () => void;
  onOut: () => void;
  onSplit: () => void;
}

export function Transport(props: Props) {
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
          className={props.project.loop ? "active" : ""}
          data-testid="loop-btn"
          onClick={props.onToggleLoop}
        >
          Loop
        </button>
      </div>
      <div className="transport-group" data-group="edit">
        <button type="button" data-testid="in-btn" onClick={props.onIn} title="Set IN (I)">
          IN
        </button>
        <button type="button" data-testid="out-btn" onClick={props.onOut} title="Set OUT (O)">
          OUT
        </button>
        <button
          type="button"
          data-testid="split-btn"
          onClick={props.onSplit}
          disabled={!props.project.audio.length}
          title="Split at playhead (S)"
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
      </div>
    </div>
  );
}
