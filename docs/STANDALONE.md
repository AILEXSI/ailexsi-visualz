# Standalone Visualz

The product host is the Arranger (`npm run dev`). Library embed remains `createVisualEngine`.

## Run live

```bash
npm run dev
# Arranger at http://127.0.0.1:5173

# library demo after npm run build
# serve repo root → examples/engine-host.html
```

Pick an MP3 → Play → scene: aurora / wave / kick-sun / bars.

## Quality contract (test track: bubu3)

Motion is gated by song energy (`musicClock`). Silence freezes.
Look target is filament + multi-octave bloom, not fat polylines.

Offline HQ preview (Python, same laws):

```bash
python3 tools/render-preview.py --input track.mp3 --out preview.mp4
```

Scenes in the preview pass: resonance-wave → spectrum-bars → lita-bloom.

## Studio later

```ts
import { createVisualEngine } from "@ailexsi/visualz";
const engine = createVisualEngine({ canvas, initialSceneId: "aurora-ribbon" });
engine.setFeatures(analyserFeatures); // from ailexsi-analyser
engine.start();
```

Grant-gated in ACG: `grant.resonance.read` for features, no external publish.
