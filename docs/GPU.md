# GPU layer — reality

## BROWSER VERIFIED (this environment)

Headless Chrome 148 + ANGLE SwiftShader WebGL2
`examples/gpu-smoke.html`

```
WebGL2: yes
EXT_color_buffer_float: yes
HDR framebuffer: RGBA16F
Framebuffer complete: yes
Shaders: pass
Bloom: pass
Feedback: pass
Tone map: pass
Hero frame: rendered
GPU filaments: pass
```

Not a discrete-GPU vendor driver. Software WebGL still compiles and completes FBOs.

Run:

```
python3 -m http.server 8765
google-chrome --headless=new --no-sandbox --enable-webgl \
  --use-gl=angle --use-angle=swiftshader-webgl \
  --dump-dom http://127.0.0.1:8765/examples/gpu-smoke.html
```

`--disable-gpu` makes WebGL2 fail. That is expected.

## What is GPU-native

| Piece | Status |
|-------|--------|
| Post bloom / feedback / tonemap | GPU (WebGL2) |
| Instanced filament pass | GPU |
| Resonance Hero body (rings, canvas strokes, core) | Canvas2D |
| Scene upload | still UNSIGNED_BYTE canvas → texture |

Hero is **hybrid**, not fully GPU-rendered.

## Switch

`params.gpuFilaments` default **true**. Set `false` for Canvas-only Hero under the same post stack.

One post stack. No second renderer.
