/** Shared visualizer core — identical for every panel.
 * Vertex Y = smoothed spectral band energy only.
 * Path: PCM → windowed FFT → bands → normalize → A/R → ring → geometry
 *
 * Ported 1:1 from the tested prototype (`CORE_BUILD_ID = wave-core-fft-v2-tested`).
 * Do not reimplement or simplify this file.
 */
export const SR = 44100;
export const FFT_SIZE = 2048;
export const HOP = 512;
export const BANDS = 96;
export const HISTORY = 96;
export const ATTACK_SEC = 0.08;
export const RELEASE_SEC = 0.35;
export const HEIGHT_SCALE = 48;
export const CORE_BUILD_ID = "wave-core-fft-v2-tested";

export type WaveRing = {
  rows: Float32Array[];
  head: number;
  count: number;
};

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tr = re[i]!; re[i] = re[j]!; re[j] = tr;
      let ti = im[i]!; im[i] = im[j]!; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j]!, uIm = im[i + j]!;
        const vRe = re[i + j + len / 2]! * wRe - im[i + j + len / 2]! * wIm;
        const vIm = re[i + j + len / 2]! * wIm + im[i + j + len / 2]! * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nwRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nwRe;
      }
    }
  }
}

const WINDOW = (() => {
  const w = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  return w;
})();

export function fftMags(frame: ArrayLike<number>): Float64Array {
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) re[i] = (frame[i] || 0) * WINDOW[i]!;
  fftInPlace(re, im);
  const half = FFT_SIZE / 2;
  const mags = new Float64Array(half);
  const norm = 1 / (FFT_SIZE * 0.5);
  for (let i = 0; i < half; i++) mags[i] = Math.hypot(re[i]!, im[i]!) * norm;
  return mags;
}

/** Band index for a frequency in the same 40..5000 Hz mapping as magsToBands. */
export function bandIndexForHz(hz: number): number {
  const fLo = 40, fHi = 5000;
  const u = (hz - fLo) / (fHi - fLo);
  return Math.max(0, Math.min(BANDS - 1, Math.floor(u * BANDS)));
}

export function magsToBands(mags: ArrayLike<number>): Float32Array {
  // Map bands across 40 Hz .. 5000 Hz so musical tests are readable on X.
  const out = new Float32Array(BANDS);
  const hzPerBin = (SR / 2) / mags.length;
  const fLo = 40, fHi = 5000;
  for (let b = 0; b < BANDS; b++) {
    const f0 = fLo + (fHi - fLo) * (b / BANDS);
    const f1 = fLo + (fHi - fLo) * ((b + 1) / BANDS);
    const i0 = Math.max(0, Math.floor(f0 / hzPerBin));
    const i1 = Math.min(mags.length, Math.max(i0 + 1, Math.ceil(f1 / hzPerBin)));
    let s = 0;
    for (let i = i0; i < i1; i++) s += mags[i] ?? 0;
    out[b] = s / (i1 - i0);
  }
  return out;
}

export function normalizeBands(bands: ArrayLike<number>): Float32Array {
  let peak = 0;
  for (let i = 0; i < bands.length; i++) if ((bands[i] ?? 0) > peak) peak = bands[i] ?? 0;
  // Do not amplify near-silence — otherwise empty frames become full-band walls.
  if (peak < 1e-4) return new Float32Array(bands.length);
  const inv = 1 / peak;
  const out = new Float32Array(bands.length);
  for (let i = 0; i < bands.length; i++) out[i] = Math.sqrt(clamp01((bands[i] ?? 0) * inv));
  return out;
}

function arCoeffs(dt: number): { a: number; r: number } {
  return {
    a: 1 - Math.exp(-dt / Math.max(1e-4, ATTACK_SEC)),
    r: 1 - Math.exp(-dt / Math.max(1e-4, RELEASE_SEC)),
  };
}

export function smoothBands(prev: Float32Array, target: ArrayLike<number>, dt: number): Float32Array {
  const { a, r } = arCoeffs(dt);
  for (let i = 0; i < prev.length; i++) {
    const t = target[i] ?? 0, p = prev[i] ?? 0;
    prev[i] = t > p ? p + (t - p) * a : p + (t - p) * r;
  }
  return prev;
}

export function createRing(): WaveRing {
  const rows: Float32Array[] = [];
  for (let i = 0; i < HISTORY; i++) rows.push(new Float32Array(BANDS));
  return { rows, head: 0, count: 0 };
}

export function pushRing(ring: WaveRing, bands: ArrayLike<number>): void {
  ring.rows[ring.head]!.set(bands);
  ring.head = (ring.head + 1) % ring.rows.length;
  ring.count = Math.min(ring.rows.length, ring.count + 1);
}

export function ringRow(ring: WaveRing, ageIndex: number): Float32Array {
  const n = ring.rows.length;
  return ring.rows[(ring.head - 1 - ageIndex + n * 16) % n]!;
}

/** Full shared analysis path. Only `pcm` varies. */
export function analyzePcmToRing(pcm: Float32Array): WaveRing {
  const ring = createRing();
  const smooth = new Float32Array(BANDS);
  const dt = HOP / SR;
  const maxStart = Math.max(0, pcm.length - FFT_SIZE);
  for (let start = 0; start <= maxStart; start += HOP) {
    const frame = pcm.subarray(start, start + FFT_SIZE);
    const mags = fftMags(frame);
    const raw = magsToBands(mags);
    const norm = normalizeBands(raw);
    smoothBands(smooth, norm, dt);
    pushRing(ring, smooth);
  }
  return ring;
}
