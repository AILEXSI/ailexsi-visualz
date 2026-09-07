# VISUALZ 0.3 — CINEMATIC

Gold standard: **resonance-wave** (Resonance Hero). New scenes that miss this bar do not ship.

## Status map

| Piece | Class |
|-------|--------|
| Canvas2D scene renderer | IMPLEMENTED |
| `createVisualEngine` + WebGL2 post | IMPLEMENTED |
| 4-scale bloom with perceptual weights | IMPLEMENTED |
| Feedback trails (bounded, kick/drop/silence) | IMPLEMENTED |
| Deterministic RNG (`songTime + trackSeed + id`) | IMPLEMENTED |
| HDR target `RGBA16F` when `EXT_color_buffer_float` + complete FBO | IMPLEMENTED / SUPPORTED WITH FALLBACK |
| RGBA8 fallback | IMPLEMENTED |
| Tone mapping (Reinhard + gamma) | IMPLEMENTED |
| Unit tests: mip, weights, hdr probe, feedback bounds, RNG | VERIFIED (node/vitest files exist; npm install 502 here) |
| Algorithm checks via `tools/verify-render-math.mjs` | VERIFIED |
| Shader compile / FBO in a real browser | UNVERIFIED in this environment |
| GPU scene filaments | PLANNED |
| `examples/engine-host.html` as canonical host | IMPLEMENTED (needs `npm run build`) |
| `examples/demo.html` inline renderer | DEPRECATED (kept, not the engine) |
| Spectrum / Aurora at Hero bar | PLANNED |
| Capture/export in production | UNVERIFIED |

## Pipeline that exists

```
Audio analysis → Visual state → Canvas2D Hero
  → Upload RGBA8 scene
  → Bright extract
  → Mip bloom 1/2 1/4 1/8 1/16 (weights 0.50/0.28/0.14/0.08 normalized)
  → Ping-pong feedback (0…0.52, silence drains)
  → Chroma + grain + vignette + Reinhard
  → Display
```

## HDR decision

1. Query `EXT_color_buffer_float`.
2. Missing → RGBA8.
3. Present → 4×4 RGBA16F / HALF_FLOAT FBO.
4. Incomplete FBO → RGBA8.
5. Never assume the enum exists.

## Canonical run path

```
npm install && npm run build
# serve repo root → examples/engine-host.html
```
