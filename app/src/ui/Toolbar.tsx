import type { ProductionScreen } from "../screens";
import { ScreenNav } from "./ScreenNav";

interface Props {
  projectName: string;
  sceneId: string;
  scenes: Array<{ id: string; name: string }>;
  screen: ProductionScreen;
  exporting: boolean;
  canExport: boolean;
  onImport: () => void;
  onExport: () => void;
  onScene: (id: string) => void;
  onCycleScene: (delta: number) => void;
  onSelectScreen: (screen: ProductionScreen) => void;
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
      <ScreenNav screen={props.screen} onSelect={props.onSelectScreen} />
      <div className="toolbar-scene" data-testid="scene-cycle">
        <span>VIS</span>
        <button
          type="button"
          data-testid="scene-prev"
          title="Previous visual function"
          onClick={() => props.onCycleScene(-1)}
        >
          ◀
        </button>
        <select
          data-testid="scene-select"
          value={props.sceneId}
          onChange={(e) => props.onScene(e.target.value)}
          aria-label="Visual function"
        >
          {props.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="scene-next"
          title="Next visual function"
          onClick={() => props.onCycleScene(1)}
        >
          ▶
        </button>
      </div>
      <div className="toolbar-brand">
        <span className="project-name" data-testid="project-name">{props.projectName}</span>
        <span className="version" data-testid="app-version">Visualz Arranger</span>
      </div>
    </header>
  );
}
