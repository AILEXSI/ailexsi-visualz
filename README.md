# AILEXSI Visualz Arranger

Local-first **Arranger** for one audio file → cinematic visuals → vis-only H.264 export.

The renderer is the Visualz cinematic engine (Canvas2D Hero + WebGL2 post). **Resonance Wave** is the quality ruler. Arranger + Cutter on **1 VIS + 1 audio** only. No Mixer or multi-track studio. No AGPL.

**Version:** `0.4.0` — Arranger product cut (`docs/ARRANGER-VISUALZ-PLAN.md`). Windows MSI requires a numeric version (no `-arranger` prerelease).

## What it is

| Surface | What you get |
|---------|----------------|
| Timeline | Exactly **1 VIS track + 1 audio track** (clips may split) |
| Screens | **ARRANGE** and **CUTTER** (Studio top-bar subset; Tab to switch) |
| Import | One audio file → vis clip generated for the same span |
| Cutter | IN/OUT, Split, trim / ripple trim, extract, lift — audio + VIS stay linked |
| Loop | IN/OUT **is** the loop region. Set Loop (or complete OUT) arms it; Loop toggles repeat |
| VIS | Cycle or pick cinematic scenes (Hero / resonance-wave and the rest). Preview + export follow the clip under the playhead |
| Preview | `createVisualEngine` driven by live analysis (play) or offline PCM (seek) |
| Export | Vis-only H.264 MP4 (picture of the visual layer; audio not muxed) |

## Run the Arranger (web)

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Tauri webview uses `npm run web:dev` on **1421** (same as Resonance Studio 5.6).

1. **Import** an audio file (mp3 / wav / …).
2. A VIS clip appears on the gold lane; Resonance Wave (or the selected scene) is generated for the file duration.
3. **Play** — visuals follow the song. Seek on the ruler or lanes.
4. Switch **ARRANGE | CUTTER**. In Cutter: mark **IN** / **OUT**, **Split**, trim or **Extract** (ripple). Audio and VIS cut together.
5. **Loop setzen:** mark **IN** then **OUT** (or **Set Loop**, or right-click the ruler twice). A green range appears on the ruler. **Loop** on = playback repeats that region; Loop off plays through. Shift+Home / Shift+End jump to IN / OUT. Preview keeps the selected visual function.
6. Cycle visual functions with **◀ ▶** (or `[` `]`) or the VIS dropdown. The clip under the playhead changes; export uses `sceneAt` for each frame.
7. **Export** — 1280×720 or 1920×1080 @ 24/25/30. Downloads an H.264 `.mp4` of the visual layer.

| Key | Action |
|-----|--------|
| Space | Play / pause |
| Home | Stop |
| Tab | Arrange ↔ Cutter |
| I / O / X | Set IN, set OUT (completes loop), clear marks |
| Set Loop / Loop | Arm the IN/OUT region / toggle repeat |
| Shift+Home / Shift+End | Playhead to IN / OUT |
| Right-click ruler | IN, then OUT (loop range) |
| S | Split at playhead |
| Q / W / Alt+W | Ripple trim IN, trim OUT, ripple trim OUT |
| ' / ; | Extract range, lift range |
| [ / ] | Previous / next visual function |

## Windows EXE (local deploy)

Same operator flow as Resonance Studio 5.6. Needs **current rustup stable** (1.85+; the locked crate graph uses edition2024), **WebView2**, and Node on the Windows machine. This Linux cloud VM does not produce the Windows binary.

```bash
npm install
npm run tauri:exe
```

That runs `tauri build` (app version **0.4.0**, MSI-safe) then `scripts/copy-exe.ps1`, which copies the release binary to the **repo root** as:

`AILEXSI Visualz.exe`

Or double-click `BUILD_AND_RUN_VISUALZ.cmd` (build + start that EXE).

| Mode | Command | What |
|------|---------|------|
| Web (Chrome) | `npm run dev` | Vite on `127.0.0.1:5173` |
| Web (Tauri port) | `npm run web:dev` | Vite on `127.0.0.1:1421` |
| Dev webview | `npx tauri dev` / `npm run tauri dev` | Loads Arranger from 1421 |
| Standalone EXE | `npm run tauri:exe` | Release EXE at repo root |

Icons are the first-party AILEXSI **愛** set copied from Resonance Studio V5.6 (`src-tauri/icons/`), not placeholders.

Import still uses the web file picker. Export in the EXE uses the Tauri save dialog + fs write (WebView2 has no download shelf). Chrome keeps File System Access / `<a download>`.

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
| Cutter (1+1 trim / split / extract) | Implemented (not Studio V1/V2 transitions) |
| Loop setzen (IN/OUT region + toggle) | Implemented |
| VIS function cycle | Implemented (`createVisualEngine.setScene`) |
| Mixer / multi-track | Intentionally absent |
| Windows Tauri EXE scaffold | Implemented (`npm run tauri:exe` on Windows) |
