# AILEXSI Visualz

Local-first audio-reactive visualizer. No AGPL. Resonance Hero is the quality ruler.

**Version:** `0.3.0-cinematic` — see `docs/CINEMATIC.md`.

## Status

| Item | Status |
|------|--------|
| Engine | Canvas2D scene + WebGL2 cinematic post |
| Post | 4-scale **weighted** bloom + bounded feedback + tonemap |
| HDR | RGBA16F when FBO-complete, else RGBA8 |
| Canonical host | `examples/engine-host.html` after `npm run build` |
| `examples/demo.html` | Deprecated inline sketch |
| Gold standard | `resonance-wave` |
| GPU scene | Not implemented |

## Run

```
npm install && npm run build
# serve repo root, open examples/engine-host.html
node tools/verify-render-math.mjs
```

```ts
import { createVisualEngine } from "@ailexsi/visualz";
const engine = createVisualEngine({ canvas, initialSceneId: "resonance-wave" });
engine.setFeatures(features);
engine.start();
```
