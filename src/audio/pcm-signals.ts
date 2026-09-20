/** PCM generators ONLY — no spectrum painting, no geometry. */
import { SR } from "./wave-core";

function nSamples(seconds: number): number { return Math.floor(SR * seconds); }

/** Stable single tone → narrow spectral ridge at fixed X. */
export function pcmSinus(seconds = 3.2, freqHz = 220): Float32Array {
  const n = nSamples(seconds);
  const out = new Float32Array(n);
  const w = 2 * Math.PI * freqHz / SR;
  for (let i = 0; i < n; i++) out[i] = 0.55 * Math.sin(w * i);
  return out;
}

/** One kick at t=1.2s: click + decaying low tone. */
export function pcmKick(seconds = 3.2): Float32Array {
  const n = nSamples(seconds);
  const out = new Float32Array(n);
  const i0 = Math.floor(2.55 * SR); // near end so HISTORY keeps the event
  for (let i = i0; i < n; i++) {
    const age = (i - i0) / SR;
    if (age > 0.9) break;
    const body = Math.exp(-age / 0.28);
    const click = Math.exp(-age / 0.012);
    // deterministic click (no Math.random) for reproducible screenshots
    const noise = Math.sin(i * 12.9898) * 43758.5453;
    const n1 = noise - Math.floor(noise);
    out[i] = 0.95 * (Math.sin(2 * Math.PI * 55 * age) * body * 0.85 +
      (n1 * 2 - 1) * click * 0.55);
  }
  return out;
}

/** Linear chirp 60→420 Hz. */
export function pcmBassSweep(seconds = 3.2): Float32Array {
  const n = nSamples(seconds);
  const out = new Float32Array(n);
  let phase = 0;
  const f0 = 80, f1 = 2000;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (t / seconds);
    phase += 2 * Math.PI * f / SR;
    out[i] = 0.5 * Math.sin(phase);
  }
  return out;
}

/** Sparse high-frequency bursts with gaps. */
export function pcmHighTransients(seconds = 3.2): Float32Array {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  // Longer tonal beeps => narrower FFT ridges; gaps stay near digital silence.
  const bursts = [0.45, 0.95, 1.45, 1.95, 2.4, 2.85];
  const freqs = [3600, 4100, 4550, 3800, 4800, 4300];
  for (let bi = 0; bi < bursts.length; bi++) {
    const i0 = Math.floor(bursts[bi] * SR);
    const freq = freqs[bi]!;
    const len = Math.floor(0.07 * SR); // 70ms
    for (let k = 0; k < len; k++) {
      const i = i0 + k;
      if (i >= n) break;
      const age = k / SR;
      const env = Math.sin(Math.PI * (k / len)); // raised cosine — low spectral splash
      out[i] += 0.4 * Math.sin(2 * Math.PI * freq * age) * env;
    }
  }
  return out;
}
