export const PRODUCTION_SCREENS = ["arrange", "cutter"] as const;
export type ProductionScreen = (typeof PRODUCTION_SCREENS)[number];

export function cycleProductionScreen(
  current: ProductionScreen,
  dir: 1 | -1,
): ProductionScreen {
  const i = PRODUCTION_SCREENS.indexOf(current);
  const next = (i + dir + PRODUCTION_SCREENS.length) % PRODUCTION_SCREENS.length;
  return PRODUCTION_SCREENS[next]!;
}
