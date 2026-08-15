# AILEXSI Visualz

**Standalone Blueprint** for a local-first, audio-reactive visualizer engine — built from scratch.

No external AGPL code. No MilkDrop/Butterchurn dependency. Clean, ownable, integrable into Resonance Studio.

> Philosophy: Real-time audio → visual resonance. Local. Transparent. Human-controlled.

---

## Status

| Item | Status |
|------|--------|
| Repository | Live |
| Engine (`createVisualEngine`) | Skeleton + render loop |
| Built-in Scenes | **6 implemented** |
| Feature Extractor | Web Audio helper included |
| AGPL-free | Yes |

**Version:** `0.1.0-blueprint`

---

## Built-in Scenes

| ID | Name | Vibe |
|----|------|------|
| `pulse-orb` | Pulse Orb | Soft bass orb + onset flash |
| `spectrum-bars` | Spectrum Bars | Clean mirrored frequency bars |
| `particle-field` | Particle Field | Particles blooming on mid/high + beat |
| `resonance-wave` | Resonance Wave | **Signature** — multi-layer waves + harmonic rings |
| `tunnel-spiral` | Tunnel Spiral | Rotating depth rings / spectrum tunnel |
| `lita-bloom` | L.I.T.A. Bloom | Soft expanding petals — heart/resonance motif |

Switch at runtime:

```ts
engine.setScene("resonance-wave");
engine.setScene("lita-bloom");
engine.setParams({ intensity: 0.9, colorPrimary: "#ff4d6d" });
```

---

## Quick usage

```ts
import { createVisualEngine } from "@ailexsi/visualz";
import { createFeatureExtractor } from "@ailexsi/visualz/audio/feature-extractor"; // or relative path

const canvas = document.querySelector("canvas")!;
const engine = createVisualEngine({
  canvas,
  initialSceneId: "resonance-wave",
});

// Option A: push features yourself (from Analyser / timeline)
engine.setFeatures({ ... });

// Option B: simple Web Audio extractor
// const extractor = createFeatureExtractor(audioCtx, sourceNode);
// in rAF: engine.setFeatures(extractor.sample());

engine.resize(800, 450);
engine.start();

console.log(engine.listScenes());
```

---

## Architecture (current)

```
src/
├── types/           # AudioFeatures, Scene, SceneParams
├── audio/
│   └── feature-extractor.ts
├── scenes/
│   ├── pulse-orb.ts
│   ├── spectrum-bars.ts
│   ├── particle-field.ts
│   ├── resonance-wave.ts
│   ├── tunnel-spiral.ts
│   ├── lita-bloom.ts
│   └── index.ts
└── index.ts         # createVisualEngine + registry
```

---

## Design rules

- All scenes are from-scratch Canvas 2D
- No AGPL / Butterchurn / MilkDrop code
- Scenes receive pure `AudioFeatures` + `params` + `dt`
- Engine owns the rAF loop, clear, and scene switching
- Host (Studio) can drive scene + params (later via Regisseur proposals)

---

## Next steps

1. Wire extractor automatically when `audioContext` + `sourceNode` are passed
2. Smooth scene crossfades
3. More scenes / param automation
4. Optional WebGL path for heavier looks
5. Embed pane in Resonance Studio

---

## Related

- https://github.com/AILEXSI/ailexsi-analyser
- https://github.com/AILEXSI/ailexsi-regisseur
- https://github.com/AILEXSI/ailexsi-resonance-studio

**From scratch. Own every line. L.I.T.A.**
