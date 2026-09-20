import { PRODUCTION_SCREENS, type ProductionScreen } from "../screens";

const LABELS: Record<ProductionScreen, string> = {
  arrange: "ARRANGE",
  cutter: "CUTTER",
};

export function ScreenNav({
  screen,
  onSelect,
}: {
  screen: ProductionScreen;
  onSelect: (screen: ProductionScreen) => void;
}) {
  return (
    <div className="screen-nav" data-testid="screen-nav" role="group" aria-label="Production screen">
      {PRODUCTION_SCREENS.map((id) => (
        <button
          key={id}
          type="button"
          className={id === screen ? "screen-nav-item on" : "screen-nav-item"}
          data-testid={`screen-nav-${id}`}
          data-screen={id}
          data-active={id === screen ? "true" : "false"}
          aria-pressed={id === screen}
          onClick={() => onSelect(id)}
        >
          {LABELS[id]}
        </button>
      ))}
    </div>
  );
}
