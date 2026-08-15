# AILEXSI Visualz

**Standalone Blueprint** for a local-first, audio-reactive visualizer engine — built from scratch.

No external AGPL code. No MilkDrop/Butterchurn dependency. Clean, ownable, integrable into Resonance Studio.

> Philosophy: Real-time audio → visual resonance. Local. Transparent. Human-controlled.

---

## Status

| Item | Status |
|------|--------|
| Repository | Created |
| Core Architecture | Defined |
| Audio Pipeline Spec | Defined |
| Visual Engine Spec | Defined |
| Preset / Scene System | Defined (simple first) |
| Integration with Studio | Via shared AudioContext + Canvas |
| Implementation | Blueprint only — ready for Grok Build App |

**Version:** `0.1.0-blueprint`

---

## Purpose

Provide a lightweight, high-quality audio-reactive visual layer that can run:

1. **Standalone** (browser or Tauri window)
2. **Embedded** inside Resonance Studio (as a live preview / background / export overlay)
3. **Driven by** the same audio that the Analyser / timeline uses

It is the visual counterpart to the audio analysis pipeline.

---

## Design Goals (V0.1)

- 100 % local, no network required for core visuals
- Web Audio API for analysis (FFT, energy, bands)
- Canvas 2D first (fast to ship), WebGL 2 optional later for heavier effects
- Small set of high-quality, tunable scenes (not 800 presets)
- Clear parameter surface so the Regisseur or user can drive visuals
- Easy to screenshot / record for export later
- Zero AGPL / copyleft contamination

---

## Architecture

```
ailexsi-visualz/
├── src/
│   ├── types/
│   │   ├── audio.ts          # AudioFeatures, BandEnergies
│   │   ├── scene.ts          # Scene, SceneParams, VisualState
│   │   └── index.ts
│   ├── audio/
│   │   ├── analyser-node.ts  # wraps AnalyserNode, extracts features
│   │   └── features.ts       # RMS, bass/mid/treble, onset, beat pulse
│   ├── engine/
│   │   ├── visual-engine.ts  # main loop, scene switching
│   │   ├── canvas-renderer.ts
│   │   └── webgl-renderer.ts # later
│   ├── scenes/
│   │   ├── base-scene.ts
│   │   ├── pulse-orb.ts      # simple reactive orb
│   │   ├── spectrum-bars.ts
│   │   ├── particle-field.ts
│   │   └── resonance-wave.ts # signature AILEXSI look
│   ├── presets/
│   │   └── default-presets.ts
│   └── index.ts             # public API
├── docs/
│   └── SPEC.md
├── package.json
└── README.md
```

---

## Core Data Contracts

### AudioFeatures (from Web Audio or external Analyser)

```ts
interface AudioFeatures {
  timeMs: number;
  rms: number;                 // 0–1 overall energy
  bass: number;                // 0–1
  mid: number;
  treble: number;
  spectrum: Float32Array;      // normalized frequency bins
  onset: boolean;              // transient detected this frame
  beatPulse: number;           // 0–1 decaying pulse on beat
  tempoBpm?: number | null;
}
```

### Scene & Params

```ts
interface SceneParams {
  intensity: number;           // 0–1 master
  colorPrimary: string;        // hex or hsl
  colorSecondary: string;
  speed: number;
  complexity: number;          // 0–1
  // scene-specific knobs allowed
  [key: string]: number | string | boolean;
}

interface Scene {
  id: string;
  name: string;
  description?: string;
  defaultParams: SceneParams;
  // render(ctx, features, params, dt) is implemented per scene
}
```

### VisualEngine State

```ts
interface VisualState {
  currentSceneId: string;
  params: SceneParams;
  isPlaying: boolean;
  width: number;
  height: number;
}
```

---

## Public API (Target)

```ts
import { createVisualEngine } from "@ailexsi/visualz";

const engine = createVisualEngine({
  canvas: HTMLCanvasElement,
  audioContext?: AudioContext,       // optional shared context
  sourceNode?: AudioNode,            // MediaElementSource / MediaStreamSource
});

// Start / stop the render loop
engine.start();
engine.stop();

// Feed external features (e.g. from ailexsi-analyser)
engine.setFeatures(features: AudioFeatures);

// Scene control
engine.setScene("resonance-wave");
engine.setParams({ intensity: 0.8, colorPrimary: "#ff6b35" });

// Utility
engine.resize(width, height);
engine.captureFrame(): Promise<Blob>;   // for export / thumbnail
```

The engine can either:
- Own its own AnalyserNode (standalone mode), or
- Receive pre-computed `AudioFeatures` from the host (Studio / Analyser).

---

## V0.1 Scenes (minimal but strong)

| ID | Name | Description |
|----|------|-------------|
| `pulse-orb` | Pulse Orb | Soft glowing orb that breathes with bass + onset flashes |
| `spectrum-bars` | Spectrum Bars | Classic mirrored frequency bars, clean and modern |
| `particle-field` | Particle Field | Particles that react to mid/high energy and drift with beat |
| `resonance-wave` | Resonance Wave | Signature AILEXSI look — flowing waveform + harmonic rings |

Each scene is a pure function of `(features, params, dt, ctx)`.
No hidden global state inside scenes.

---

## Audio Pipeline (Browser path)

1. `AudioContext` + `AnalyserNode` (fftSize 2048 or 4096)
2. Time-domain + frequency-domain data each frame
3. Derived features:
   - RMS / energy
   - 3-band split (bass / mid / treble)
   - Simple onset detector (spectral flux or energy delta)
   - Beat pulse (exponential decay on onset or external beat grid)
4. Features are published every animation frame to the active scene

Later the same interface can be fed by the native Decoder / Analyser.

---

## Integration with Resonance Studio

```
Timeline Audio Track
        │
        ▼
  Web Audio Graph (or Decoder)
        │
        ▼
  ailexsi-visualz Engine  ←→  Canvas (preview / fullscreen / background)
        │
        ▼
  Optional: capture frames → Exporter overlay or thumbnail
```

The Studio can:
- Show a live visualizer pane
- Drive scene changes from Regisseur proposals
- Use the visualizer as a reactive background while editing

---

## What we deliberately do NOT do (V0.1)

- No 800 MilkDrop presets
- No HLSL/EEL converters
- No AGPL code from MangoWave / Butterchurn / projectM
- No network calls for core rendering
- No heavy 3D engine yet

We start small, own every line, and grow the visual language in the AILEXSI aesthetic (resonance, waves, clean energy, L.I.T.A. feel).

---

## Implementation Roadmap

| Phase | Focus |
|-------|--------|
| **0.1** | Canvas 2D engine + 4 scenes + AudioFeatures extraction |
| **0.2** | Better onset/beat, param automation, scene transitions |
| **0.3** | WebGL path for particle/wave scenes |
| **0.4** | Studio embedding + Regisseur-driven scene changes |
| **0.5** | Frame capture for Exporter |

---

## Related Repos

- `ailexsi-analyser` — can supply higher-level AudioFeatures / beat grid
- `ailexsi-regisseur` — can propose visual scene + param changes
- `ailexsi-decoder` — future high-quality audio source
- `ailexsi-resonance-studio` — host application
- `ailexsi-exporter` — can later burn visuals into video

---

## License Intent

This blueprint and future implementation are intended to stay under a permissive or AILEXSI-own license (not AGPL). All code written from scratch.

---

**Blueprint status: Ready for implementation.**
