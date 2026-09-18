# Arranger-only Visualz — architecture plan

Phase 1 capture of **this repo** (`@ailexsi/visualz` cinematic engine) and **read-only** Resonance Studio V5.6 (`https://github.com/AILEXSI/ailexsi-resonance-studio-v5.6`). Product cut: local-first Arranger with **1 visual track + 1 audio track**, audio→visuals, vis-only H.264 export. No Mixer or multi-track studio. Cutter + VIS function cycle were lifted later (see §8) without bringing V1/V2 transitions or the 64-stem mixer.

Maps checked on 2026-09-18. Studio clone used for reading only; it is not modified and is not part of this tree.

---

## 1. This repo — visualz engine (keep)

**Identity:** `@ailexsi/visualz` `0.3.0-cinematic`. Library, not an app. Canonical live host is `examples/engine-host.html` after `npm run build`.

### Layout

| Path | Role |
|------|------|
| `src/index.ts` | Public `createVisualEngine` + types + GL helpers |
| `src/audio/feature-extractor.ts` | Live AnalyserNode: RMS, bass/mid/treble, flux kick/snare/hat, buildup/drop |
| `src/draw/` | `musicClock`, log spectrum, color, deterministic RNG |
| `src/scenes/` | 9 Canvas2D scenes; **gold standard = `resonance-wave`** |
| `src/gl/post-pipeline.ts` | WebGL2: extract → 4-scale weighted bloom → bounded feedback → chroma/grain/vignette/Reinhard |
| `src/gl/filaments.ts` | Optional GPU filament pass under the same post stack |
| `src/post/bloom.ts` | Canvas2D bloom fallback if WebGL2 fails |
| `examples/engine-host.html` | File picker + Play + scene select + synthetic clock when no file |

### Public API (`createVisualEngine`)

```
start / stop
setFeatures(AudioFeatures)
setScene(id) / setParams / listScenes
resize / getState / captureFrame / destroy
registerScene
```

`createFeatureExtractor` exists but is **not** re-exported from `src/index.ts`. The host imports `dist/audio/feature-extractor.js` directly. `VisualEngineOptions` accepts `audioContext` / `sourceNode` but the engine never wires them — the host must push features.

### Pipeline

```
AudioFeatures → Canvas2D Hero (resonance-wave …)
  → upload RGBA8 → bloom mips (weights 0.50/0.28/0.14/0.08)
  → feedback 0…0.52 → tonemap → display
```

Motion law: `phase += musicClock(dt, energy, beatPulse, speed)`. Silence nearly freezes. HDR `RGBA16F` when FBO-complete, else RGBA8.

### Build / test

- `tsc` → `dist/` + `tools/fix-esm.mjs` (browser ESM extensions)
- Vitest on `src/**/*.test.ts` (mip, HDR probe, feedback bounds, RNG, bloom weights)
- No Vite app, no React, no export path
- `captureFrame()` is PNG `toBlob` only. `docs/CINEMATIC.md`: **Capture/export in production = UNVERIFIED**

### What to keep

The entire cinematic engine: scenes, GL post, filaments, feature types, `createVisualEngine`. Resonance Hero remains the quality ruler. Do not replace it with Studio’s Canvas-only `renderVisualizerScene` path.

### Library gaps this rebuild fills (without breaking the API)

| Gap | Action |
|-----|--------|
| `createFeatureExtractor` not public | Re-export from `src/index.ts` |
| No single-frame render for export | Add `step(dt)` on `VisualEngine` |
| WebGL buffer discarded before encode | Optional `preserveDrawingBuffer` |
| No offline PCM features | Add `createOfflineFeatureExtractor` (same band splits as live) |
| No video encode / mux | First-party vis-only WebCodecs + ISO-BMFF in `src/export/` |

---

## 2. Resonance Studio V5.6 — Arranger reference (lift UX, not the studio)

**Identity:** React + Vite + Tauri `5.6.0`, `schemaVersion` 5. Maps: `CURRENT.md`, `docs/V5.6-RELEASE.md`, `src/core/models.ts`, `src/ui/timeline/Timeline.tsx`, `src/core/exporter/*`.

### What the Arranger actually is

Studio is Arrange **and** Cutter **and** Mixer. Top bar: `File | Import | Export | ARRANGE | CUTTER`. Transport sits above a Timeline+Mixer row. Preview + Inspector sit above.

Default project is **four tracks**: V1, V2, A1, A2, plus a **VIS overlay lane that is not a `TrackId`**. VIS lives on `Project.visualizer` (`enabled`, `muted`, `sceneId`, window, `events[]`, `cues[]`). Dynamic audio up to 64. Groups, VOL automation, Write Volume, linked A/V, transitions — all studio.

### Track / VIS model (quote-level)

- `Track.kind`: `"video" | "audio"` only
- `VisualizerEvent`: `{ id, sceneId, startMs, durationMs }` — clips on the VIS lane
- Scene at time: covering event → last cue → base `sceneId` + window
- Audio import: single file appends to a preferred audio lane; 2+ files take the stem path (one track per file)
- Transport: Play/Pause/Stop, ±1f @ 30fps, Loop, Follow, IN/OUT, Split, Undo/Redo, Snap
- Preview **does not** call `createVisualEngine`. It paints `renderVisualizerScene()` on a 2D canvas. Studio vendored an older Visualz (`0.1.0-blueprint` @ `b67410c`) — Canvas2D only, plus LEXI family. **Not** the cinematic WebGL2 post in this repo.

### Visual language to echo

Tokens from `src/styles.css`: `--bg #080a0e`, `--panel #10141b`, `--accent #d4b45a` (VIS), `--audio #2f8a68`, `--playhead #ff5d6c`, Segoe / Cascadia. Lane grid: label column (≥80px) + body. VIS lane gold. Audio clips green. Ruler 26px.

### Export (what we steal vs what we refuse)

Studio export is H.264 MP4 via WebCodecs. **Frame Engine AILEXSI** (~8k lines) decodes *source video* for V-tracks. VIS-only Fertig never opens AFE: canvas → `renderVisualizerScene` → `VideoEncoder` → first-party `muxAvcToMp4`.

| Lift | Skip |
|------|------|
| ENC-01 `selectAvcEncoderConfig` (720p `avc1.42001f`, 1080p Level 4.0+) | Entire `src/core/frame-engine/` (AFE-01…25 stall stack) |
| Video-only ISO-BMFF mux (`mp4.ts` idea; no AAC required for vis-only) | Cutter, Mixer, groups, VOL/W, stem ZIP, 64-track collection |
| Per-frame vis paint + offline FFT features | Mediabunny (already removed in 5.6) |
| Fail loud if no AVC — **no WebM fallback** | HTMLVideo export fallback |

Studio `mp4.ts` is first-party, no AGPL, no npm muxer. Product policy: H.264 MP4 only.

---

## 3. Product data model — exactly 1 vis + 1 audio

Not Studio’s V1/V2/A1/A2. Not a generic NLE.

```
Project
  name, playheadMs, loop, zoomPxPerSec, scrollMs
  sceneId                 // default / cycle target (resonance-wave)
  inPointMs, outPointMs   // cutter marks
  source                  // the one imported file (objectUrl, peaks, duration)
  audio: AudioClip[]      // clips on the one audio track (may split)
  vis: VisClip[]          // clips on the one visual track (may split)
```

```
AudioClip  { id, name, startMs, durationMs, sourceInMs, sourceOutMs }
VisClip    { id, sceneId, startMs, durationMs, sourceInMs, sourceOutMs }
```

Rules:

1. Empty project: both tracks exist as **lanes**; both clip arrays are empty.
2. Import one audio file → one `AudioClip` on the audio track (start 0) → system **generates** one `VisClip` covering the same `[start, start+duration)` with `sceneId` (default `resonance-wave`).
3. Changing / cycling scene updates the vis clip **under the playhead** + `engine.setScene`. After a split, later vis clips keep their own scene. Re-import replaces the one source.
4. Timeline duration = last clip end (or 0). Playback and export map timeline → source time via `sourceInMs`/`sourceOutMs`.
5. Export range = current 1+1 timeline. Picture only — vis-only MP4. `sceneAt(time)` + `featureTimeAt(time)` so cuts and VIS switches land in the file.

This is still the 1+1 model (two tracks). Split creates more **clips**, not more tracks. VIS is a first-class track in the **product** UI even though Studio stored it as overlay state.

---

## 4. What to strip

| Studio / old visualz | Why gone |
|----------------------|----------|
| Cutter *transitions*, V1/V2 | No picture source except the engine — 1+1 trim/split was lifted instead |
| Mixer, pan, solo, master, meters | One audio file, unity gain |
| Dynamic A3…A64, stem ZIP, chapter groups | One audio track |
| VOL lane, Write Volume, clip fades/rate/lock | Out of scope |
| Inspector / File overlay / Help sheet / Snap/Undo | Not required for this cut |
| Tauri / IndexedDB project save | Local-first web host; blobs stay in-session |
| `examples/demo.html` inline sketch | Already deprecated; engine-host stays as library demo |
| Studio LEXI catalog / vendored old Visualz | This repo’s cinematic scenes + post are the renderer |

---

## 5. Host shape (Phase 2)

Vite + React app under `app/`, same stack family as 5.6. Tauri 2 host under `src-tauri/` (Windows EXE / local deploy). Imports the engine via `@ailexsi/visualz` → `src/`.

```
toolbar: Import · Export · ARRANGE|CUTTER · VIS prev/select/next · version
preview: createVisualEngine canvas (Hero + WebGL2 post)
cutter:  IN/OUT · Split · trim/ripple · extract/lift · cut-strip (CUTTER screen)
transport: Play / Pause / Stop / ±1f / Loop / IN / OUT / Split / timecode
timeline: ruler + VIS lane + Audio lane + playhead (+ trim handles in Cutter)
```

Workflow:

1. Import audio → decode → peaks + offline extractor + clip + generated vis span.
2. Play → MediaElement + live `createFeatureExtractor` → `engine.setFeatures`.
3. Pause / seek → offline features at playhead → `engine.step`.
4. Export → offscreen engine at 1280×720 or 1920×1080 → per-frame offline features → `step(1/fps)` → `VideoEncoder` (AVC) → first-party mux → `.mp4` download.

### Export honesty (slice)

Shipped: **vis-only H.264 MP4** (picture from the cinematic engine). Audio is **not** muxed in this slice — the file is meant to sit over the audio elsewhere. If `VideoEncoder` is missing, fail with an explicit message (no WebM). AAC mux and 5.6 AFE video-decode are follow-ups, not this cut.

---

## 6. License / deps

- Engine and muxer: first-party. No AGPL, no Butterchurn/projectM, no Mediabunny.
- App deps: React, Vite, TypeScript, Tauri 2 (`@tauri-apps/api` + dialog/fs) — same family as 5.6. No AGPL.
- Studio remains a read-only reference.

---

## 7. Windows EXE (added after Phase 2)

Mirrors 5.6 packaging, Visualz naming:

| 5.6 | Visualz |
|-----|---------|
| `productName` AILEXSI Resonance Studio V5.6 | `AILEXSI Visualz` |
| `com.ailexsi.resonance-studio-v5-5` | `com.ailexsi.visualz` |
| `frontendDist` `../dist` | `../app/dist` |
| `web:dev` :1421 | same |
| `npm run tauri:exe` + `scripts/copy-exe.ps1` | same → repo-root `AILEXSI Visualz.exe` |
| 愛 icons | copied from 5.6 (first-party) |
| App version | **`0.4.0`** (MSI-safe; Windows rejects non-numeric prereleases like `-arranger`) |

Rust entry is **minimal** (dialog + fs plugins + `allow_user_paths`). No last-project / 64-track media scope. Chrome export stays FSA/`<a download>`; EXE export uses Tauri save + write (WebView2 has no download shelf). Import stays `<input type="file">`.

---

## 8. Cutter + VIS function cycle (lifted from 5.6, 1+1 only)

Read-only Studio maps: `src/ui/screens/ScreenNav.tsx`, `src/core/timeline.ts` (`splitAtPlayhead`, `setInPoint` / `setOutPoint`, ripple trim, extract/lift), `src/core/visualizer.ts` (`nextSceneId`, `sceneAt`). Studio’s `src/ui/cutter/Cutter.tsx` is a **V1/V2 transition** editor — not lifted. Visualz Cutter is the timeline cut math + ARRANGE | CUTTER chrome.

| Studio | Visualz |
|--------|---------|
| Top bar `ARRANGE \| CUTTER` + Tab | Same `ScreenNav` subset |
| I / O / X, S split, Q / Alt+W ripple trim, `'` extract, `;` lift | Same keys on the 1+1 lanes (W = lift trim OUT, Alt+W ripple) |
| Dual-write linked A/V | Audio + VIS clips stay paired by the same edit |
| VIS scene picker + `nextSceneId` | Toolbar VIS prev / select / next and `[` / `]`; `createVisualEngine.setScene` |
| Transition stack / V1/V2 | Skipped |

Cutter panel: IN/OUT, Split, Trim IN/OUT, Ripple IN/OUT, Extract, Lift, plus a cut-strip of edit points. Arrange view keeps I/O/Split on the transport. Preview and export both use `sceneAt` / `featureTimeAt`.
