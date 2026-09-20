/**
 * Deterministic musical fixture used when the repo has no licensed track.
 *
 * 10.0s mono @ 44100. Passages:
 *   0.00–1.00  silence
 *   1.00–2.20  quiet 220 Hz
 *   2.20–4.00  bass-heavy (55 + 80 Hz)
 *   4.00–5.20  kick (click + decaying 55 Hz) at 4.05s
 *   5.20–6.40  high transients
 *   6.40–8.00  build (80→2000 Hz chirp, rising amp)
 *   8.00–9.20  dense mix
 *   9.20–10.0  silence
 *
 * No Math.random — every sample is a closed-form function of index.
 */
import { SR } from "./wave-core";
import { pcmBufferFromMono } from "./wave-history-analyzer";
import type { PcmBuffer } from "./offline-extractor";

export const WAVE_HISTORY_MUSIC_DURATION_SEC = 10;
export const WAVE_HISTORY_MUSIC_NAME = "wave-history-music-fixture.wav";

export const WAVE_HISTORY_PROOF_TIMES_MS = [2500, 4100, 7800] as const;

function frac(x: number): number {
  return x - Math.floor(x);
}

function clickNoise(i: number): number {
  const noise = Math.sin(i * 12.9898) * 43758.5453;
  return frac(noise) * 2 - 1;
}

export function createWaveHistoryMusicPcm(): Float32Array {
  const n = Math.floor(SR * WAVE_HISTORY_MUSIC_DURATION_SEC);
  const out = new Float32Array(n);
  let chirpPhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    if (t >= 1 && t < 2.2) {
      s += 0.08 * Math.sin(2 * Math.PI * 220 * t);
    }
    if (t >= 2.2 && t < 4) {
      const env = 0.55 + 0.25 * Math.sin(2 * Math.PI * 1.5 * (t - 2.2));
      s += env * (0.55 * Math.sin(2 * Math.PI * 55 * t) + 0.4 * Math.sin(2 * Math.PI * 80 * t));
    }
    if (t >= 4.05 && t < 5.2) {
      const age = t - 4.05;
      const body = Math.exp(-age / 0.28);
      const click = Math.exp(-age / 0.012);
      s += 0.95 * (Math.sin(2 * Math.PI * 55 * age) * body * 0.85 + clickNoise(i) * click * 0.55);
    }
    if (t >= 5.2 && t < 6.4) {
      const bursts = [5.3, 5.55, 5.8, 6.05, 6.28];
      const freqs = [3600, 4100, 4550, 3800, 4300];
      for (let b = 0; b < bursts.length; b++) {
        const age = t - bursts[b]!;
        if (age >= 0 && age < 0.07) {
          const env = Math.sin(Math.PI * (age / 0.07));
          s += 0.4 * Math.sin(2 * Math.PI * freqs[b]! * age) * env;
        }
      }
    }
    if (t >= 6.4 && t < 8) {
      const u = (t - 6.4) / 1.6;
      const f = 80 + (2000 - 80) * u;
      chirpPhase += 2 * Math.PI * f / SR;
      s += (0.18 + 0.55 * u) * Math.sin(chirpPhase);
    } else {
      chirpPhase = 0;
    }
    if (t >= 8 && t < 9.2) {
      const u = (t - 8) / 1.2;
      s += 0.42 * Math.sin(2 * Math.PI * 55 * t);
      s += 0.28 * Math.sin(2 * Math.PI * 220 * t);
      s += 0.18 * Math.sin(2 * Math.PI * 880 * t);
      s += 0.12 * Math.sin(2 * Math.PI * 2400 * t) * (0.4 + 0.6 * u);
    }
    out[i] = s;
  }
  return out;
}

export function createWaveHistoryMusicBuffer(): PcmBuffer {
  return pcmBufferFromMono(createWaveHistoryMusicPcm(), SR);
}

export function encodeWavPcm16(mono: Float32Array, sampleRate = SR): Uint8Array {
  const dataBytes = mono.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < mono.length; i++) {
    const x = Math.max(-1, Math.min(1, mono[i] ?? 0));
    view.setInt16(o, x < 0 ? Math.round(x * 0x8000) : Math.round(x * 0x7fff), true);
    o += 2;
  }
  return new Uint8Array(buf);
}
