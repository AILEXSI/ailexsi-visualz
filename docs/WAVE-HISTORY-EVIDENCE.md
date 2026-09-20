# Wave-History FFT — Geometry-only Evidence Stage

## Changed files

New:

- `src/audio/wave-core.ts` — 1:1 port of tested core (`wave-core-fft-v2-tested`)
- `src/audio/wave-core.test.ts` — 43/43 prototype suite
- `src/audio/pcm-signals.ts` — prototype PCM generators
- `src/audio/wave-history-analyzer.ts` — shared PCM-time hop driver + hashes
- `src/audio/wave-history-analyzer.test.ts` — Preview/Export/seek/pause/loop/silence
- `src/audio/wave-history-transport.test.ts` — Preview + Export attach the same helper
- `src/audio/wave-history-music-fixture.ts` — deterministic 10 s musical fixture
- `src/scenes/lexi-wave-history-evidence.ts` — new Evidence / Debug stage
- `src/scenes/lexi-wave-history-draw.ts` — proto line-field draw (consume ring only)
- `src/scenes/lexi-wave-history-raster.ts` — software raster for proof PNGs
- `src/scenes/lexi-wave-history-evidence.test.ts`
- `src/scenes/lexi-wave-history-proof.test.ts`
- `fixtures/wave-history-music-fixture.wav`
- `docs/WAVE-HISTORY-EVIDENCE.md`
- `docs/wave-history-evidence-points.json`
- `docs/lexi-wave-history-evidence-*.png`

Edited (transport / registry only; other scene files untouched):

- `src/types/audio.ts` — optional `waveHistory` snapshot
- `src/scenes/catalog.ts` / `catalog.test.ts` — add LEXI evidence entry
- `src/scenes/index.ts` — register scene
- `src/index.ts` — export + geometry-only engine path
- `src/gl/post-pipeline.ts` — additive `passthrough` blit
- `app/src/ui/Preview.tsx` — attach shared analyzer at PCM time
- `app/src/App.tsx` — pass `pcm` into Preview
- `app/src/export/vis-export.ts` — same analyzer on export frames

Stage id: `lexi-wave-history-evidence`  
Core build: `wave-core-fft-v2-tested`  
Family: `LEXI` (Evidence / Debug). All prior LEXI Terrain Gold, LEXI Energy, and Kaleido catalog stages are unchanged.

## 1. Architecture path (PCM → Scene)

```
A1 decoded PCM (any rate, mixed to mono)
        │
        ▼
resample / clock onto SR=44100          ← transport only; not a second FFT
        │
        ▼
src/audio/wave-core.ts                  ← 1:1 tested core
  fftMags (Hann + radix-2, FFT 2048)
  magsToBands (96 bands, 40–5000 Hz)
  normalizeBands (peak + sqrt, silence gate 1e-4)
  smoothBands (A=0.08s / R=0.35s, dt = hop/SR = 512/44100)
  pushRing / ringRow (HISTORY=96)
        │
        ▼
createWaveHistoryAnalyzer.sampleAt(timeMs)
  hops from PCM[0 .. floor(timeMs/1000*44100)]
        │
        ▼
AudioFeatures.waveHistory               ← Preview and Export attach this
        │
        ▼
lexi-wave-history-evidence              ← consumes ring/band rows only
  drawWaveHistoryGeometry               ← proto camera, gold lines, no post
```

There is **one** FFT / normalize / A/R / history implementation: `src/audio/wave-core.ts`.  
The scene does not analyse audio. Shaders are not used. The engine skips bloom, filaments, atmosphere, chroma, grain, and feedback when this stage is active (`passthrough` blit only).

## 2. No second analysis path (audit)

| Location | Role |
|---|---|
| `src/audio/wave-core.ts` | Only FFT / bands / normalize / A/R / ring |
| `src/audio/wave-history-analyzer.ts` | PCM-time hop driver + hashes. Calls the core. |
| `src/scenes/lexi-wave-history-draw.ts` | Draws `ringRow` heights. No FFT. |
| `src/scenes/lexi-wave-history-evidence.ts` | Reads `features.waveHistory` only. |
| `app/src/ui/Preview.tsx` | `featuresWithWaveHistory(..., analyzer, pcmTimeMs)` |
| `app/src/export/vis-export.ts` | Same helper, same `sampleAt(featMs)` |

Grep (evidence scene + draw): no `fftMags`, `normalizeBands`, `smoothBands`, `AnalyserNode`, `getByteFrequency`, `energyBands`.

**Not used by this stage** (still used by other scenes, unchanged):

- Live `createFeatureExtractor` / `AnalyserNode` spectrum
- `createOfflineFeatureExtractor` spectrum / kick envelopes

Those packets may still ride along on `AudioFeatures` for other styles. Evidence geometry ignores them.

## 3. Seek / start / pause / loop / export

Advance is **hop count from audio time**, never wall-clock `dt`.

| Event | Behaviour |
|---|---|
| **Project start** (`t = 0`) | Ring is empty (`hopCount = 0`). First hop appears only after one complete FFT window (`t ≥ 2048/44100 s`). Not a fake filled field. |
| **Continuous play to T** | Each hop with `start + 2048 ≤ floor(T*44100)` is analysed in order. A/R state is causal from t=0. |
| **Seek to T** | If the hop frontier would go backwards, the analyzer **resets** and rebuilds from PCM before T. The filled history equals play-to-T. An empty ring is never presented as equivalent to continuous play. |
| **Pause** | Transport stops calling `sampleAt`. Last snapshot stays. Musical state is frozen. |
| **Resume** | Later `sampleAt(t)` continues incrementally from the frozen hop frontier. |
| **Loop boundary** | Time jumps backward → same as seek: rebuild from the new PCM time (loop IN), using audio before that time. |
| **Export start at T** | A fresh analyzer calls `sampleAt(T)` on the first frame, which rebuilds history before T. Export does not start from a silent empty ring unless T is before the first FFT window. |

Play-to-T and seek-to-T share `analyzePcmToTime` / `sampleAt` over the same prefix. Bit-identical `historyHash` / `bandsHash`.

## 4. Music fixture

The repo has no licensed song. Evidence uses a deterministic 10 s mono 44100 fixture:

`fixtures/wave-history-music-fixture.wav`  
generated by `src/audio/wave-history-music-fixture.ts` (no `Math.random`).

| Time | Passage |
|---|---|
| 0.00–1.00 s | silence |
| 1.00–2.20 s | quiet 220 Hz |
| 2.20–4.00 s | bass-heavy (55 + 80 Hz) |
| 4.00–5.20 s | kick at 4.05 s |
| 5.20–6.40 s | high transients |
| 6.40–8.00 s | build (80→2000 Hz chirp) |
| 8.00–9.20 s | dense mix |
| 9.20–10.0 s | silence |

Fixed comparison times: **2.500 s**, **4.100 s**, **7.800 s**.

## 5. Preview / Export comparison points

Hashes are FNV-1a over float32 bits of the newest row (`bandsHash`) and the 96-row ring in age order (`historyHash`). See `docs/wave-history-evidence-points.json`.

Preview (30 fps incremental play to T) and Export (`sampleAt(T)` from a cold analyzer / export-start warmup) match at each time.

| t (ms) | passage | PCM window (core samples) | dominant band | bandsHash | historyHash (Preview = Export) |
|---:|---|---|---:|---|---|
| 2500 | bass-heavy | 108032–110080 | 0 | `bc15cd5c` | `0990f1c5` |
| 4100 | kick transient | 178688–180736 | 0 | `541e3a2d` | `c5e7592e` |
| 7800 | build / dense chirp | 341504–343552 | 31 | `1eb15222` | `bfabc0ef` |

## 6. Geometry-only proof

Screenshots (software raster of the same camera as the proto, gold `rgba(255,168,64,*)` lines on black):

- `docs/lexi-wave-history-evidence-2500ms.png`
- `docs/lexi-wave-history-evidence-4100ms.png`
- `docs/lexi-wave-history-evidence-7800ms.png`
- `docs/lexi-wave-history-evidence-geometry.png` (stacked)

No bloom, fog, particles, or color grading. Other scenes were not edited.

## 7. Tests

- Ported core: **43/43** in `src/audio/wave-core.test.ts`
- Analyzer integration: identical PCM, Preview/Export parity, pause/resume, seek, loop, silence, extremes, start window
- Scene catalog + source audit
- Transport source audit (`Preview.tsx` + `vis-export.ts`)

## 8. Known deviations / uncertainties

- Core clock is **44100 Hz**. Files at other rates are linearly resampled in the analyzer **before** the tested core. Band frequencies stay correct; this resample is not a second FFT.
- Live Web Audio `AnalyserNode` still runs for other scenes during play. Evidence does not read it.
- Geometry-only blit uses a new `GlPost.passthrough`. Other stages still go through bloom/filaments.
- Software proof PNGs stamp the same projection as canvas strokes; antialiasing can differ from a GPU/canvas stroke by a few pixels. Perception hashes (band/history) are the source of truth, not PNG bytes.
- Engine `dt` is ignored by this stage. Semantic evolution is hop/PCM time only.
- No licensed commercial track is in the repo; the fixture is the documented substitute.
