# AILEXSI Visualz Arranger

Local-first **Arranger** for one audio file → cinematic visuals → vis-only H.264 export.

The renderer is the Visualz cinematic engine (Canvas2D Hero + WebGL2 post). **Resonance Wave** is the quality ruler. No Cutter, Mixer, or multi-track studio. No AGPL.

**Version:** `0.4.0-arranger` — product cut documented in `docs/ARRANGER-VISUALZ-PLAN.md`.

## What it is

| Surface | What you get |
|---------|----------------|
| Timeline | Exactly **1 VIS track + 1 audio track** |
| Import | One audio file → vis clip generated for the same span |
| Preview | `createVisualEngine` driven by live analysis (play) or offline PCM (seek) |
| Export | Vis-only H.264 MP4 (picture of the visual layer; audio not muxed) |

## Run the Arranger

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

1. **Import** an audio file (mp3 / wav / …).
2. A VIS clip appears on the gold lane; Resonance Wave (or the selected scene) is generated for the file duration.
3. **Play** — visuals follow the song. Seek on the ruler or lanes.
4. **Export** — 1280×720 or 1920×1080 @ 24/25/30. Downloads an H.264 `.mp4` of the visual layer.

Space = play/pause. Home = stop.

## Engine library

The Arranger hosts `@ailexsi/visualz`. The public API is unchanged plus small additions (`step`, public `createFeatureExtractor`, offline extractor, vis-only mux helpers).

```ts
import { createVisualEngine, createFeatureExtractor } from "@ailexsi/visualz";

const engine = createVisualEngine({ canvas, initialSceneId: "resonance-wave" });
engine.setFeatures(features);
engine.start();
engine.step(1 / 30); // one frame — used by export
```

Library build (examples / embed):

```bash
npm run build
# serve repo root → examples/engine-host.html
```

```bash
npm test
npm run typecheck
```

## Export notes

- **Shipped:** vis-only AVC MP4 via WebCodecs `VideoEncoder` + first-party ISO-BMFF mux. No WebM fallback.
- **Not in this slice:** AAC mux (use the MP4 over the audio elsewhere), Frame Engine AILEXSI (no source video to decode).
- Needs a Chromium-family browser with H.264 encode. If `VideoEncoder` is missing, Export fails with an explicit message.

## Docs

| File | Topic |
|------|--------|
| `docs/ARRANGER-VISUALZ-PLAN.md` | Phase 1 map of this repo vs Resonance Studio 5.6 + 1+1 model |
| `docs/CINEMATIC.md` | Engine pipeline (bloom, feedback, HDR) |
| `docs/SCENES.md` | Scene lock — Resonance Hero |
| `docs/SPEC.md` | Engine contract |

## Status

| Item | Status |
|------|--------|
| Arranger host (Vite + React) | Implemented |
| 1 VIS + 1 audio | Implemented |
| Audio import → generated vis | Implemented |
| Cinematic engine under preview | Implemented |
| Vis-only H.264 export | Implemented (no AAC) |
| Cutter / Mixer / multi-track | Intentionally absent |
