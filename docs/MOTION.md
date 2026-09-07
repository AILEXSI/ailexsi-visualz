# Motion law

Visualz must follow the *song*, not a metronome.

```
phase += musicClock(dt, energy, beatPulse, speed)
```

- Silence / near-zero RMS: phase almost frozen.
- Bass / RMS / onset: motion opens.
- Spectrum samples use log mapping (`logSpectrumSample`) so bars look musical, not like a raw FFT fence.
- Engine should fade the frame (trail), not wipe to black every tick.

Implemented:
- `src/draw/motion.ts`
- `src/draw/color.ts`
- `src/audio/feature-extractor.ts` (spectral flux + silence gate)
- `src/scenes/resonance-wave.ts`

Still to land on main (local patch exists):
- spectrum-bars (log + peak caps)
- tunnel / bloom / particles song-lock
- engine alpha-trail clear in `src/index.ts`
