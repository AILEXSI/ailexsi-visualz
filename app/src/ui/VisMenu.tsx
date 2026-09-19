import { VIS_FAMILIES, catalogEntriesFor, type SceneCatalogEntry, type VisFamilyId } from "@ailexsi/visualz";

interface Props {
  open: boolean;
  family: VisFamilyId | null;
  styleId: string;
  onToggle: () => void;
  onFamily: (id: VisFamilyId) => void;
  onPick: (entry: SceneCatalogEntry) => void;
}

export function VisMenu(props: Props) {
  const entries = props.family ? catalogEntriesFor(props.family) : [];
  return (
    <div className="menu-wrap">
      <button
        type="button"
        data-testid="vis-menu-btn"
        className={props.open ? "active" : ""}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        VIS
      </button>
      {props.open ? (
        <div className="menu-panel vis-menu" data-testid="vis-menu" role="menu">
          <div className="vis-families">
            {VIS_FAMILIES.map((id) => (
              <button
                key={id}
                type="button"
                className={props.family === id ? "active" : ""}
                data-testid={`vis-family-${id}`}
                onClick={() => props.onFamily(id)}
              >
                {id}
              </button>
            ))}
          </div>
          <div className="vis-styles" data-testid="vis-styles">
            {entries.length ? (
              entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={props.styleId === e.id ? "active" : ""}
                  data-testid={`vis-style-${e.id}`}
                  onClick={() => props.onPick(e)}
                >
                  {e.displayName}
                </button>
              ))
            ) : (
              <em>{props.family ? "No styles in this family yet." : "Pick a family."}</em>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
