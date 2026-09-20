import type { MixerState } from "../model";

interface Props {
  mixer: MixerState;
  a1Peak: number;
  masterPeak: number;
  onChange: (next: Partial<MixerState>) => void;
}

export function Mixer(props: Props) {
  const { mixer } = props;
  return (
    <aside className="mixer" data-testid="mixer">
      <h2>Mixer</h2>
      <Strip
        id="A1"
        muted={mixer.a1Muted}
        solo={mixer.a1Solo}
        volume={mixer.a1Volume}
        peak={props.a1Peak}
        onMute={() => props.onChange({ a1Muted: !mixer.a1Muted })}
        onSolo={() => props.onChange({ a1Solo: !mixer.a1Solo })}
        onVolume={(a1Volume) => props.onChange({ a1Volume })}
      />
      <Strip
        id="Master"
        muted={mixer.masterMuted}
        volume={mixer.masterVolume}
        peak={props.masterPeak}
        onMute={() => props.onChange({ masterMuted: !mixer.masterMuted })}
        onVolume={(masterVolume) => props.onChange({ masterVolume })}
      />
    </aside>
  );
}

function Strip({
  id,
  muted,
  solo,
  volume,
  peak,
  onMute,
  onSolo,
  onVolume,
}: {
  id: string;
  muted: boolean;
  solo?: boolean;
  volume: number;
  peak: number;
  onMute: () => void;
  onSolo?: () => void;
  onVolume: (v: number) => void;
}) {
  const pct = Math.max(2, Math.min(100, peak * 100));
  return (
    <div className="mixer-strip" data-testid={`mixer-${id}`}>
      <span className="mixer-name">{id}</span>
      <div className="meter" data-testid={`meter-${id}`}>
        <span className="meter-fill" style={{ height: `${pct}%` }} />
      </div>
      <button type="button" className={muted ? "active" : ""} data-testid={`mute-${id}`} onClick={onMute}>
        M
      </button>
      {onSolo ? (
        <button type="button" className={solo ? "active" : ""} data-testid={`solo-${id}`} onClick={onSolo}>
          S
        </button>
      ) : (
        <span className="mixer-spacer" />
      )}
      <input
        type="range"
        min={0}
        max={2}
        step={0.01}
        value={volume}
        aria-label={`${id} volume`}
        onChange={(e) => onVolume(Number(e.target.value))}
      />
    </div>
  );
}
