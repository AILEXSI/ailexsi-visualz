# VISUALZ 0.3 — CINEMATIC

Gold standard: **resonance-wave** (Resonance Hero). New scenes that miss this bar do not ship.

## Pipeline (target)

```
Audio → Analysis → Visual State → GPU Scene → HDR → Bloom → Feedback → Lens → Frame
```

Current: Scene (Canvas2D) → WebGL post. Next: GPU scene for Hero / Spectrum / Aurora only.

## Rules

- No `Math.random()`. Use `src/draw/rng.ts` seeded from `songTime + trackSeed + particleId`.
- Offline and live must share state.
- One engine: `createVisualEngine()`. `examples/demo.html` inline renderer is deprecated.
- Use `examples/engine-host.html` after `npm run build`.
- Kick ≠ bass. Bindings in `docs/BINDINGS.md`.

## Quality gates for a scene

Must have: song-locked motion, material layers or equivalent depth, HDR-intent core, kick-reactive structure, no screensaver geometry.
