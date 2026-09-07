# Standalone Visualz

Shippable now as a local page. Studio embed comes later via `createVisualEngine`.

## Run live

```bash
# open in a browser (file:// is enough for the file picker)
examples/demo.html
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
