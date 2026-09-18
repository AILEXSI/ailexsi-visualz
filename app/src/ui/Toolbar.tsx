interface Props {
  projectName: string;
  sceneId: string;
  scenes: Array<{ id: string; name: string }>;
  exporting: boolean;
  canExport: boolean;
  onImport: () => void;
  onExport: () => void;
  onScene: (id: string) => void;
}

export function Toolbar(props: Props) {
  return (
    <header className="toolbar" data-testid="toolbar">
      <div className="toolbar-group">
        <button type="button" data-testid="import-btn" onClick={props.onImport}>
          Import
        </button>
        <button
          type="button"
          className="primary"
          data-testid="export-btn"
          onClick={props.onExport}
          disabled={props.exporting || !props.canExport}
        >
          Export
        </button>
      </div>
      <label className="toolbar-scene">
        Scene
        <select
          data-testid="scene-select"
          value={props.sceneId}
          onChange={(e) => props.onScene(e.target.value)}
        >
          {props.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="toolbar-brand">
        <span className="project-name" data-testid="project-name">{props.projectName}</span>
        <span className="version" data-testid="app-version">Visualz Arranger</span>
      </div>
    </header>
  );
}
