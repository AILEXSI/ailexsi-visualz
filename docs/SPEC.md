# AILEXSI Visualz — Specification V0.1

## Goal

A clean, ownable, real-time audio-reactive visual engine that can run standalone or embedded in Resonance Studio.

## Hard Constraints

1. All code written from scratch or under permissive licenses only.
2. No AGPL / Butterchurn / MilkDrop / projectM code.
3. Core must work offline.
4. Scenes are pure render functions of (features, params, dt).

## Audio Feature Extraction (Browser)

- Use `AnalyserNode` with configurable fftSize (default 2048).
- Compute each animation frame:
  - RMS from time-domain data
  - Bass / Mid / Treble averages from frequency bins
  - Simple onset: energy or spectral flux above threshold + cooldown
  - beatPulse: set to 1.0 on onset/beat, exponential decay
- Host may also push features from `ailexsi-analyser` (preferred later).

## Scene Contract

Every scene implements:

```ts
render(context, features, params, dt): void
```

Optional `onEnter` / `onExit`.

Scenes must not hold long-lived global mutable state that survives scene switches (local variables inside the render closure are fine).

## V0.1 Scene List

1. **pulse-orb** — soft radial glow driven by bass + onset flash
2. **spectrum-bars** — clean mirrored bars, modern aesthetic
3. **particle-field** — lightweight particles reacting to mid/high + beat
4. **resonance-wave** — flowing multi-layer wave + harmonic rings (signature look)

## Engine Responsibilities

- Own the requestAnimationFrame loop
- Clear / call active scene
- Manage current params and scene id
- Expose resize, captureFrame, start/stop
- Accept external AudioFeatures

## Non-Goals V0.1

- 3D / heavy WebGL effects
- Preset marketplace
- Network loading of scenes
- Automatic quality scaling (can come later)

## Future Hooks

- Regisseur can emit `setScene` + `setParams` operations
- Exporter can call `captureFrame` or a future video-frame stream
- Decoder can supply higher-quality audio features
