import { SCENE_CATALOG, type SceneCatalogEntry } from "@ailexsi/visualz";
import type { Project, VisClip } from "../model";

interface Props {
  project: Project;
  clip: VisClip | null;
  onStyle: (entry: SceneCatalogEntry) => void;
  onQuelle: (quelle: string) => void;
}

export function Inspector(props: Props) {
  const clip = props.clip;
  return (
    <aside className="inspector" data-testid="inspector">
      <h2>Inspector</h2>
      {!clip ? (
        <p className="muted">Select a VIS clip.</p>
      ) : (
        <>
          <label className="inspector-field">
            Style
            <select
              data-testid="inspector-style"
              value={clip.styleId ?? clip.sceneId}
              onChange={(e) => {
                const entry = SCENE_CATALOG.find((s) => s.id === e.target.value);
                if (entry) props.onStyle(entry);
              }}
            >
              {SCENE_CATALOG.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.family} · {s.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="inspector-field">
            Quelle
            <select
              data-testid="inspector-quelle"
              value={clip.quelle ?? "A1"}
              onChange={(e) => props.onQuelle(e.target.value)}
            >
              <option value="A1">A1</option>
            </select>
          </label>
          <p className="muted" data-testid="inspector-scene">
            {clip.sceneId}
          </p>
        </>
      )}
    </aside>
  );
}
