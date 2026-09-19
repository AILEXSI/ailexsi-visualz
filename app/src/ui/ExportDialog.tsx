interface Props {
  open: boolean;
  busy: boolean;
  progress: string;
  error: string | null;
  rangeLine: string;
  warning?: string;
  width: number;
  height: number;
  fps: number;
  onWidth: (n: number) => void;
  onHeight: (n: number) => void;
  onFps: (n: number) => void;
  onExport: () => void;
  onClose: () => void;
}

export function ExportDialog(props: Props) {
  if (!props.open) return null;
  return (
    <div className="modal-backdrop" data-testid="export-dialog">
      <div className="modal">
        <h2>Export vis-only MP4</h2>
        <p className="muted">
          H.264 of the visual layer. Audio is not muxed — use the file over the track elsewhere.
        </p>
        <p className="export-range" data-testid="export-range">
          {props.rangeLine}
        </p>
        {props.warning ? (
          <p className="export-warn" data-testid="export-range-warn">{props.warning}</p>
        ) : null}
        <div className="export-row">
          <label>
            Size
            <select
              value={`${props.width}x${props.height}`}
              disabled={props.busy}
              onChange={(e) => {
                const [w, h] = e.target.value.split("x").map(Number);
                props.onWidth(w);
                props.onHeight(h);
              }}
            >
              <option value="1280x720">1280×720</option>
              <option value="1920x1080">1920×1080</option>
            </select>
          </label>
          <label>
            fps
            <select
              value={props.fps}
              disabled={props.busy}
              onChange={(e) => props.onFps(Number(e.target.value))}
            >
              <option value={24}>24</option>
              <option value={25}>25</option>
              <option value={30}>30</option>
            </select>
          </label>
        </div>
        {props.progress ? <p data-testid="export-progress">{props.progress}</p> : null}
        {props.error ? <p className="error" data-testid="export-error">{props.error}</p> : null}
        <div className="export-actions">
          <button type="button" className="primary" onClick={props.onExport} disabled={props.busy}>
            {props.busy ? "Encoding…" : "Export"}
          </button>
          <button type="button" onClick={props.onClose} disabled={props.busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
