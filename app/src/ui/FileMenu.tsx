import type { RecentFile } from "../persist";

interface Props {
  open: boolean;
  recents: RecentFile[];
  onToggle: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecent: (recent: RecentFile) => void;
  onExport: () => void;
  canExport: boolean;
}

export function FileMenu(props: Props) {
  return (
    <div className="menu-wrap">
      <button
        type="button"
        data-testid="file-menu-btn"
        className={props.open ? "active" : ""}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        File
      </button>
      {props.open ? (
        <div className="menu-panel" data-testid="file-menu" role="menu">
          <button type="button" data-testid="file-new" onClick={props.onNew}>
            Neu <kbd>Ctrl+N</kbd>
          </button>
          <button type="button" data-testid="file-open" onClick={props.onOpen}>
            Laden <kbd>Ctrl+O</kbd>
          </button>
          <button type="button" data-testid="file-save" onClick={props.onSave}>
            Speichern <kbd>Ctrl+S</kbd>
          </button>
          <button type="button" data-testid="file-save-as" onClick={props.onSaveAs}>
            Speichern unter <kbd>Ctrl+Shift+S</kbd>
          </button>
          <div className="menu-sub" data-testid="file-recents">
            <span>Letzte Dateien</span>
            {props.recents.length ? (
              props.recents.map((r) => (
                <button key={`${r.name}-${r.at}`} type="button" onClick={() => props.onOpenRecent(r)}>
                  {r.name}
                </button>
              ))
            ) : (
              <em>Keine</em>
            )}
          </div>
          <button type="button" data-testid="file-export" onClick={props.onExport} disabled={!props.canExport}>
            Export <kbd>Ctrl+E</kbd>
          </button>
        </div>
      ) : null}
    </div>
  );
}
