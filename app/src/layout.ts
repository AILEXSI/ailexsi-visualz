/** Timeline height: readable lanes by default, grows with the window. */

export const TIMELINE_MIN_PX = 220;
export const TIMELINE_MAX_PX = 480;
export const TIMELINE_DEFAULT_PX = 260;

export function defaultTimelineHeight(windowHeight: number): number {
  const h = Number.isFinite(windowHeight) ? windowHeight : 800;
  const scaled = Math.round(h * 0.3);
  return Math.max(TIMELINE_MIN_PX, Math.min(TIMELINE_MAX_PX, scaled));
}

export function clampTimelineHeight(px: number): number {
  if (!Number.isFinite(px)) return TIMELINE_DEFAULT_PX;
  return Math.max(TIMELINE_MIN_PX, Math.min(TIMELINE_MAX_PX, Math.round(px)));
}
