/**
 * Cheap Canvas bloom — two blurred screen-passes.
 */

export function applyBloom(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  amount: number
): void {
  const a = Math.max(0, Math.min(1, amount));
  if (a < 0.04) return;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  ctx.filter = `blur(${6 + a * 14}px)`;
  ctx.globalAlpha = 0.28 + a * 0.32;
  ctx.drawImage(canvas, 0, 0);

  ctx.filter = `blur(${18 + a * 28}px)`;
  ctx.globalAlpha = 0.12 + a * 0.18;
  ctx.drawImage(canvas, 0, 0);

  ctx.restore();
}
