import type { SceneCatalogEntry, VisFamilyId } from "@ailexsi/visualz";
import type { RecentFile } from "../persist";
import type { ProductionScreen } from "../screens";
import { FileMenu } from "./FileMenu";
import { ScreenNav } from "./ScreenNav";
import { VisMenu } from "./VisMenu";

interface Props {
  projectName: string;
  sceneId: string;
  styleId: string;
  scenes: Array<{ id: string; name: string }>;
  screen: ProductionScreen;
  exporting: boolean;
  canExport: boolean;
  fileOpen: boolean;
  visOpen: boolean;
  visFamily: VisFamilyId | null;
  recents: RecentFile[];
  onToggleFile: () => void;
  onToggleVis: () => void;
  onVisFamily: (id: VisFamilyId) => void;
  onPickStyle: (entry: SceneCatalogEntry) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecent: (r: RecentFile) => void;
  onImport: () => void;
  onExport: () => void;
  onScene: (id: string) => void;
  onCycleScene: (delta: number) => void;
  onSelectScreen: (screen: ProductionScreen) => void;
}

export function Toolbar(props: Props) {
  return (
    <header className="toolbar" data-testid="toolbar">
      <FileMenu
        open={props.fileOpen}
        recents={props.recents}
        onToggle={props.onToggleFile}
        onNew={props.onNew}
        onOpen={props.onOpen}
        onSave={props.onSave}
        onSaveAs={props.onSaveAs}
        onOpenRecent={props.onOpenRecent}
        onExport={props.onExport}
        canExport={props.canExport}
      />
      <VisMenu
        open={props.visOpen}
        family={props.visFamily}
        styleId={props.styleId}
        onToggle={props.onToggleVis}
        onFamily={props.onVisFamily}
        onPick={props.onPickStyle}
      />
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
        <button type="button" data-testid="scene-prev" title="Previous visual function" onClick={() => props.onCycleScene(-1)}>
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
        <button type="button" data-testid="scene-next" title="Next visual function" onClick={() => props.onCycleScene(1)}>
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
