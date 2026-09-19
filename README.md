# AILEXSI Visualz Arranger

Local-first **Arranger** for one audio file → cinematic visuals → one playable MP4 (VIS H.264 + A1 AAC).

The renderer is the Visualz cinematic engine (Canvas2D Hero + WebGL2 post). **Resonance Wave** is the quality ruler. Arranger + Cutter on **1 VIS + 1 A1** only. Mixer is A1 + Master (not the 64-stem studio). No AGPL.

**Version:** `0.4.0` — Arranger product cut (`docs/ARRANGER-VISUALZ-PLAN.md`). Windows MSI requires a numeric version (no `-arranger` prerelease).

## What it is

| Surface | What you get |
|---------|----------------|
| File | **Neu / Laden / Speichern / Speichern unter / Letzte Dateien / Export** — Ctrl+N O S, Ctrl+Shift+S, Ctrl+E. `.visualz.json` (schema 1) or Resonance v5 VIS+A1 subset. Audio blob is not stored. |
| Timeline | Exactly **1 VIS + 1 A1** (clips may split). Zoom px/s (+/−), Pan, Fit (F), Marker (M), timecode. Drag the splitter under Preview to resize (default ~220–280px; grows with the window). Horizontal scroll for long tracks. |
| Screens | **ARRANGE** and **CUTTER** (Studio top-bar subset; Tab to switch) |
| Inspector | Click a VIS clip → **Style** + **Quelle**. Context menu applies the same. Writes style/scene id on the clip. |
| Import | One audio file → vis clip generated for the same span |
| Cutter | IN/OUT, Split, trim / ripple trim, extract, lift — audio + VIS stay linked |
| Loop | IN/OUT **is** the loop region. Set Loop (or complete OUT) arms it; Loop toggles repeat |
| VIS | Registry families: LEXI, **LEXI Terrain Gold**, Classic, Flow, Geometry, Synthwave, Particle-Nebula, **Kaleido Loop**. Click applies immediately. Cycle ◀ ▶ / `[` `]` still works. |
| Mixer | **A1 + Master** Mute / Solo / meters. Mute silences playback. |
| Preview | `createVisualEngine` driven by live analysis (play) or offline PCM (seek) |
| Export | **Export MP4** = VIS H.264 + A1 AAC in one file (`exportMp4`). Tauri uses ffmpeg mux + probe. Loop ON + IN/OUT → that range; Loop OFF → full. Silent vis-only is a secondary link. |

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
6. Cycle visual functions with **◀ ▶** (or `[` `]`) or the VIS dropdown. Or open **VIS** and pick a family/style (including Kaleido Loop presets). The clip under the playhead changes; export uses `sceneAt` + clip params for each frame.
7. Click a VIS clip to inspect **Style** / **Quelle**. Mute **A1** or **Master** in the mixer.
8. **File → Speichern** writes `.visualz.json`. Laden restores VIS+A1, loop, markers, mixer, styles (re-import audio after load).
9. **Export MP4** — Visual + A1 audio, default 1920×1080 @ 30. Loop ON with IN/OUT exports that window (picture and sound start together). `Export vis-only (no audio)` is the silent option.

| Key | Action |
|-----|--------|
| Space | Play / pause |
| Home | Stop |
| Tab | Arrange ↔ Cutter |
| I / O / X | Set IN, set OUT (completes loop), clear marks |
| Set Loop / Loop | Arm the IN/OUT region / toggle repeat |
| Shift+Home / Shift+End | Playhead to IN / OUT |
| Right-click ruler | IN, then OUT (loop range) |
| Ctrl+N / O / S | Neu, Laden, Speichern |
| Ctrl+Shift+S / Ctrl+E | Speichern unter, Export |
| F / M | Fit timeline, Marker at playhead |
| S / V | Split at playhead (Studio Cut = V) |
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

- **Primary (default button Export MP4):** `exportMp4` / `exportVisWithA1` in `app/src/export/vis-export.ts`. One playable file: VIS H.264 + A1 AAC. After mux, `mp4HasSoundTrack` and/or ffprobe `codec_type=audio` must pass or the dialog shows FAIL — never Fertig on a silent file.
- **Tauri / Windows:** encode vis-only temp → write A1 PCM slice to `{a1Range}.wav` (Loop ON+IN/OUT = that window, same as `-ss IN -t (OUT-IN)`; Loop OFF = full A1) → invoke `ffmpeg_mux_vis_a1`. ffmpeg missing is a hard fail.
- **Browser:** WebCodecs AAC mux, then the same audio-stream probe. No `sowt` Fertig.
- **Secondary:** Export vis-only (no audio) — silent by design.
- **Not in this slice:** Frame Engine AILEXSI (no source video to decode).
- Needs a Chromium-family browser with H.264 encode. If `VideoEncoder` is missing, Export fails with an explicit message.

### Export debug (default path)

| Question | Answer |
|----------|--------|
| Which function/file is the real default Export path? | `exportMp4` (alias `exportVisWithA1`) in `app/src/export/vis-export.ts`. `App.tsx` `onExport(true)` calls it. `exportVisOnly` is the secondary silent button only. |
| Is A1 path/PCM passed? | Yes — decoded A1 `PcmBuffer` (`pcm` from import). There is no original-file sidecar. The slicer writes `{a1Range}.wav` for the export window (Loop IN/OUT or full). |
| Full ffmpeg command actually started | `ffmpeg -y -i "{visTemp}.mp4" -i "{a1Range}.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest "{out}.mp4"` — quoted in logs as `[visualz-export]` and returned from the Tauri command. |
| Example ffprobe stream list of a muxed output | `streams: [ { index: 0, codec_name: "h264", codec_type: "video" }, { index: 1, codec_name: "aac", codec_type: "audio", bit_rate: "320000" } ]` |

Fertig (primary only): `Fertig · N frames · codec · bytes · audio: aac · from A1 · range 01:29.88–02:19.91` (or `range FULL`).

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
| Export MP4 (VIS + A1) | Implemented (`exportMp4` + ffmpeg on Tauri; probe required) |
| Export vis-only (no audio) | Secondary option |
| Cutter (1+1 trim / split / extract) | Implemented (not Studio V1/V2 transitions) |
| Loop setzen (IN/OUT region + toggle) | Implemented |
| VIS function cycle | Implemented (`createVisualEngine.setScene`) |
| File `.visualz.json` + recents | Implemented |
| Inspector Style / Quelle | Implemented |
| VIS family registry + Kaleido Loop | Implemented (`kaleido-loop`, seamless test) |
| Mixer A1 + Master | Implemented (not 64-stem) |
| Loop-ranged export | Implemented (`resolveExportRange` on vis + A1) |
| Window + timeline resize | Implemented (min 1280×720, splitter, lanes grow) |
| LEXI Terrain Gold | Implemented (own family, not Kaleido). Pass 1+2: `surfaceDensity` 1.4, `depthAttenuation` 0.62, `flowSpeed` 0.35, `fogDensity` 0.78, `fogHeight` 0.38, `bloomCap` 0.55, `horizonY` 0.42, `mountainScale` 1.15, `periodSec` 12. Pass 3+ deferred. |
| Windows Tauri EXE scaffold | Implemented (`npm run tauri:exe` on Windows) |
