/** Deterministic mip-chain sizes for bloom. No GL. */

export function bloomMips(w: number, h: number): Array<{ w: number; h: number; scale: number }> {
  const out = [];
  let cw = Math.max(2, Math.floor(w / 2));
  let ch = Math.max(2, Math.floor(h / 2));
  let scale = 2;
  for (let i = 0; i < 4; i++) {
    out.push({ w: cw, h: ch, scale });
    cw = Math.max(2, Math.floor(cw / 2));
    ch = Math.max(2, Math.floor(ch / 2));
    scale *= 2;
  }
  return out;
}
