# AILEXSI Visualz — Specification V0.1.1

## Goal

A clean, ownable, real-time audio-reactive visual engine that can run standalone or embedded in Resonance Studio.

## Motion law (0.1.1)

Scenes MUST advance phase with `musicClock(dt, energy, beatPulse, speed)`.
Wall-clock spinning during silence is a bug.
Quiet songs stay almost still. Beats and RMS open motion.

## Hard Constraints

1. All code written from scratch or under permissive licenses only.
2. No AGPL / Butterchurn / MilkDrop / projectM code.
3. Core must work offline.
4. Scenes are render functions of (features, params, dt) with song-gated motion.

## Audio Feature Extraction

- AnalyserNode, fftSize default 2048.
- RMS from time domain.
- Bass / Mid / Treble from log-ish bin splits.
- Onset: spectral flux vs EMA + cooldown. Silence gated.
- beatPulse: 1 on onset, energy-aware decay.
- Host may push features from `ailexsi-analyser`.

## Engine

- rAF loop
- Soft trail clear (alpha wipe), not a hard black frame every tick
- resize, captureFrame, start/stop
- Accept external AudioFeatures
