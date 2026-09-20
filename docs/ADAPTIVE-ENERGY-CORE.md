# Adaptive Energy Core V0.1

Signal-processing slice only. This document does **not** describe a visual design, a beat tracker, or a music-understanding model.

Build id: `adaptive-energy-v0.1`  
Host tip this slice was branched from: `cursor/arranger-visualz-host-a7f8` @ `8c196d9c4b2536dd47a2fc47949eb85375f2037d`

```text
localPeak is not beat detection
relativeEnergy is not loudness
novelty is not implemented
section recognition is not implemented
drop recognition is not implemented
musical meaning is not yet canonical fact
```

V0.1 measures **adaptive energy evidence** from PCM-derived band magnitudes. It does not claim to understand music.

---

## Phase 0 — fail-closed baseline (recorded before production edits)

Verified on a clean tree before the feature branch was created.

| Item | Fact |
|---|---|
| Branch | `cursor/arranger-visualz-host-a7f8` |
| HEAD | `8c196d9c4b2536dd47a2fc47949eb85375f2037d` (merge of PR #2 Wave-History Evidence) |
| Working tree | clean (`git status --porcelain` empty) |
| Baseline tests | **153 / 153** (`vitest run`, 35 files) |
| Prototype integration | **Production-integrated**: `createWaveHistoryAnalyzer` drives Preview + Export. Evidence geometry consumes the ring only. |
| Band count | **96** (`BANDS` in `src/audio/wave-core.ts`, locked by `wave-core.test.ts`) |
| Band semantics | **Linear-Hz average of FFT bins**, 40–5000 Hz, then (geometry path only) peak-normalize + sqrt + A/R. Not log, not Mel, not render columns at the analysis layer. Evidence *draws* one column per band. |
| Frequency range | **40 Hz … 5000 Hz** (`magsToBands` / `bandIndexForHz`) |
| Sample rates | Native PCM is **linearly resampled to 44100** in `resampleToCoreRate` before the tested core. `wave-core.ts` itself hardcodes `SR = 44100`. |
| Analysis clock | **PCM hop index**. Hop = 512 samples at 44100. Window = 2048. Not rAF, not UI FPS, not `performance.now()`, not export FPS. |

### Exact files (signal path)

| Role | File |
|---|---|
| PCM mix + resample + hop driver | `src/audio/wave-history-analyzer.ts` |
| FFT / band map / normalize / A/R / ring | `src/audio/wave-core.ts` |
| PCM generators (tests/fixtures) | `src/audio/pcm-signals.ts`, `src/audio/wave-history-music-fixture.ts` |
| Geometry consume-only | `src/scenes/lexi-wave-history-draw.ts`, `lexi-wave-history-raster.ts`, `lexi-wave-history-evidence.ts` |
| Preview / Export attach | `app/src/ui/Preview.tsx`, `app/src/export/vis-export.ts` via `featuresWithWaveHistory` |
| **Not** this slice | `src/audio/feature-extractor.ts`, `src/audio/offline-extractor.ts` (live/offline AnalyserNode-compatible path for other scenes) |

### Exact test files (pre-existing signal path)

- `src/audio/wave-core.test.ts` (43/43 prototype suite inside one `it`)
- `src/audio/wave-history-analyzer.test.ts`
- `src/audio/wave-history-transport.test.ts`
- `src/scenes/lexi-wave-history-evidence.test.ts`
- `src/scenes/lexi-wave-history-proof.test.ts`

`wave-core.ts` was **not** modified by this slice.

---

## 1. Purpose

Convert the existing PCM-derived 96-band stream into deterministic, time-aware perception states that distinguish:

- actual energy (`absoluteEnergy`)
- locally unusual energy (`relativeEnergy`, `deviation`)
- sudden change (`spectralFlux`)
- short impulses (`localPeak`)
- sustained passages (baseline catches the envelope; relative → 0)
- rising / falling energy (`trend`)
- silence (all-zero finite frame)
- unstable / insufficient evidence (`warmup`, low `confidence`)

---

## 2. Input provenance

```
A1 decoded PCM (any rate)
  → mixMonoPcm
  → resampleToCoreRate (44100)     ← transport only; not a second FFT
  → wave-core.fftMags (Hann, 2048)
  → wave-core.magsToBands          ← 96 linear-Hz means, 40–5000 Hz
  → AdaptiveEnergyCore.pushHop     ← raw bands, pre-normalize
  → MusicPerceptionFrameV01
```

**Absolute energy is taken from `magsToBands` before `normalizeBands` / `smoothBands`.**

The geometry ring peak-normalizes every hop (`normalizeBands` silence-gates at `1e-4`, then `sqrt(band/peak)`). A quiet sine and a loud sine become the same row height. That is correct for Evidence geometry and **wrong** for perception: quiet local peaks must not masquerade as full-scale intensity. Adaptive Energy therefore does **not** consume the smoothed ring.

There is still only one FFT: `wave-core.fftMags`. The core does not remap Hz. Sample-rate invariance is the analyzer resample, already verified on the host.

Band model inherited from `wave-core.ts`:

| Property | Value |
|---|---|
| Count | 96 |
| `fmin` / `fmax` | 40 Hz / 5000 Hz |
| Width distribution | Uniform **linear Hz** (~51.67 Hz per band) |
| Aggregation | **Mean** of FFT bin magnitudes in `[f0, f1)` |
| Bin width at 44100 / 2048 | `(44100/2) / 1024 ≈ 21.53 Hz` |
| Geometry A/R (not used here) | Attack 0.08 s / Release 0.35 s |

---

## 3. PCM-time ownership

Perception follows PCM time, never render frame rate.

| Name | Value | Meaning |
|---|---|---|
| `sampleRate` | 44100 | Core clock after resample |
| `analysisHopSamples` | 512 | Advance quantum |
| `analysisWindowSamples` | 2048 | Hann FFT window |
| `pcmSampleIndex` | `hopStart + 2048` | Exclusive end of the window on the core clock |
| `pcmTimeSeconds` | `pcmSampleIndex / 44100` | Same instant |

`createAdaptiveEnergyCore` advances **only** when `pushHop` is called. `lastFrame()` is a read. rAF in Preview, export FPS, and `engine.step(dt)` may *read* the last hop; they must not be an analysis clock.

Preview and Export already call `featuresWithWaveHistory(raw, analyzer, pcmTimeMs)`. The analyzer now steps Adaptive Energy on the same hop loop that fills the wave-history ring. One canonical path.

**Future invariant (not implemented as seek reconstruction of visuals):**

```text
same PCM + same seed + same scene plan + same timestamp = same reconstructed visual state
```

Seek today rebuilds hops from PCM before T (existing Wave-History rule). Perception resets with that rebuild. No new seek interpolator.

---

## 4. Field semantics

### `BandStateV01`

| Field | Units | Definition |
|---|---|---|
| `absoluteEnergy` | mean FFT magnitude | `magsToBands` value, `>= 0`, floored at `1e-12`, capped at `1e12`. Linear in amplitude, not dB, not peak-normalized. |
| `fastEnvelope` | same | Asymmetric follower. Attack τ = 0.020 s, release τ = 0.080 s. `dt = hop/SR`. First hop is seeded (no attack from 0). |
| `slowBaseline` | same | Asymmetric follower. Attack τ = 1.50 s, release τ = 1.50 s. Local typical energy. |
| `relativeEnergy` | dimensionless | `(fastEnvelope - slowBaseline) / max(slowBaseline, 1e-4)`, clamped to `[-50, 50]`. **Not loudness.** A quiet bump above a quieter baseline can be relatively large while `absoluteEnergy` stays small. |
| `deviation` | dimensionless | Population z-score of `absoluteEnergy` over a real rolling window of 86 hops (~1.00 s). `σ` floored at `1e-4`. Clamped to `[-20, 20]`. Zero until 8 hops. This is a real rolling mean/variance, not a fake z-score. |
| `spectralFlux` | energy delta | `max(0, fastEnvelope_t - fastEnvelope_{t-1})`. First hop = 0. Positive change only. |
| `localPeak` | `[0, 1]` | Causal local transient: current flux is the max of the last 4 flux samples, and flux / relative / absolute gates all fire. Score = `flux / max(fastEnvelope, 1e-4)`. **Not beat detection.** No tempo, no periodicity, no downbeat. |
| `trend` | `[-1, 1]` | `(mean(last 8 hops) - mean(previous 8)) / max(\|older\|, 1e-4)`. Rising / stable / falling. Zero until 16 hops. |
| `confidence` | `[0, 1]` | History maturity: `0` on hop 1, then `hops / 130`, capped at 1. **Not aesthetics.** |

### `MusicPerceptionFrameV01`

| Field | Meaning |
|---|---|
| `pcmSampleIndex` / `pcmTimeSeconds` | See time model |
| `warmup` | `true` while `acceptedHops < 130` |
| `broadbandEnergy` | Mean of band `absoluteEnergy` |
| `broadbandFlux` | `max(0, broadband_t - broadband_{t-1})`; first hop = 0 |
| `bands` | Length 96 (unless a test constructs a different `bandCount`) |

Absolute and relative **coexist** on every hop.

---

## 5. Warm-up

Warm-up is hop-counted, not wall-clock.

- `WARMUP_SEC = 1.5`
- `WARMUP_HOPS = ceil(1.5 * 44100 / 512) = 130`

The first hop completes at `t = 2048/44100 ≈ 46.4 ms`. Warm-up then lasts 129 further hop advances (`≈ 1.497 s`). Warm-up **ends** when the 130th hop is accepted (`warmup = false`, `confidence = 1`).

Until then:

- outputs stay finite
- first hop has **zero** flux, localPeak, relativeEnergy, trend, deviation, broadbandFlux
- envelopes are seeded to the first absolute energy (no fake attack from 0)
- `confidence` reflects insufficient history

---

## 6. Reset / new source

`core.reset()` and `analyzer.reset()` (including seek-backward rebuild) drop:

envelope, baseline, flux history, peak state, trend history, deviation window, confidence, hop count, last frame.

A new source must not inherit the previous song’s baseline. After reset, hop 1 is a first-frame again.

---

## 7. Silence and numeric safety

Fail closed.

- Digital silence → all public energy/flux/peak/trend fields are exact `0`.
- Division floors: `RELATIVE_FLOOR = DEVIATION_FLOOR = 1e-4`.
- Output clamps: relative `[-50, 50]`, deviation `[-20, 20]`, peak/confidence `[0, 1]`, trend `[-1, 1]`.
- Invalid input (wrong length, non-finite sample index, any non-finite band) → **zero-safe invalid frame** (`warmup = true`, `confidence = 0`, all zeros). State is **not** advanced.
- Every returned frame is `Object.freeze`d. Consumers are read-only.

---

## 8. Determinism and Preview / Export parity

Same PCM + same hop sequence ⇒ bit-identical `MusicPerceptionFrameV01` (`Object.is` on every public number).

No `Math.random`. No wall clock. No render-frame accumulator.

Preview (incremental `sampleAt` at 30 fps) and Export (`sampleAt(T)` from a cold analyzer) share `createWaveHistoryAnalyzer` / `featuresWithWaveHistory`. Perception is stepped on the same hops as the ring. Evidence geometry still ignores perception.

---

## 9. Integration boundary

```
PCM/FFT producer (wave-core + analyzer)
    → AdaptiveEnergyCore
    → MusicPerceptionFrameV01
    → lastPerception() / AudioFeatures.musicPerception
    → consumers (read-only)
```

Renderer does not own or advance perception. No scene was added or restyled. LEXI Wave-History Evidence geometry is unchanged.

---

## 10. What V0.1 does **not** claim

```text
localPeak is not beat detection
relativeEnergy is not loudness
novelty is not implemented
section recognition is not implemented
drop recognition is not implemented
musical meaning is not yet canonical fact
```

Also not in this slice: downbeats, song sections, drops, AI Director, new scenes, color, particles, bloom, cosmetic improvements, a second FFT, or hidden analysis inside scenes.

---

## 11. Later slices (out of scope)

- **Rhythm core** — periodicity / beat *candidates* on top of this evidence (not this PR)
- **Structure core** — longer-horizon novelty / sections (not this PR)
- **Visual State Runtime** — map perception (+ later rhythm/structure) onto existing scenes without scenes re-analysing audio
- **AI Director** — only after perception / rhythm / structure are canonical facts, not guesses

---

## 12. Provenance and license

Independent implementation. Conceptual inspiration only: classic analog-style attack/release followers and positive spectral flux as used throughout MIR literature.

**No code was copied** from Essentia, madmom, aubio, librosa, Butterchurn, projectM, CAVA, MilkDrop, or any ML / cloud / native analysis library. No GPL / AGPL / LGPL dependency was added.

Repo license remains `UNLICENSED` (see `package.json`).

---

## 13. Tests and tolerances

See `src/audio/adaptive-energy-core.test.ts`.

| # | Case | Tolerance reason |
|---|---|---|
| 1 | Silence | Exact 0 — no energy, no leakage |
| 2 | Constant sine | Hann + 75% hop overlap modulates bins by a few percent |
| 3 | Sudden increase | 2048-sample window straddles the step for ~46 ms |
| 4 | Release | Positive-only flux; residual hop modulation << pre-drop energy |
| 5 | Render-rate independence | Bit-identical hops; `lastFrame` is a read |
| 6 | Relative comparability | Same ratio at two levels; 45% relative gap for leakage + floor |
| 7 | Bass isolation | Hann sidelobes exist; 55 Hz must not light 3.6 kHz+ |
| 8 | High-transient isolation | Fixture beeps at 3600–4800 Hz |
| 9 | Sample-rate invariance | Linear resample interpolation; cosine similarity > 0.98 |
| 10 | First-frame | Exact 0 flux / peak / relative |
| 11 | Non-finite | Invalid frame, state not poisoned |
| 12 | Replay | Bit-identical |

Extras: near-zero baseline, long sustained loud, rapid alternating, stereo mix, truncated window, reset / seek rebuild.

---

## 14. Rollback

Delete `src/audio/adaptive-energy-core.ts`, its test, and `docs/ADAPTIVE-ENERGY-CORE.md`. Revert the additive wiring in `wave-history-analyzer.ts`, `src/types/audio.ts`, and `src/index.ts`. `wave-core.ts` and all scenes stay as on the host tip.
