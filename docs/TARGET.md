# Visual target

Reference the user named: HeavyM-class music visuals — audio-reactive, lush, stage-ready.
Not a clone. Not their shaders. Same *feeling* of quality.

## What that look actually is

HeavyM (and Magic / Resolume / good MilkDrop presets) share a stack:

1. **The picture is layered** — generative field + glow + trail + a little chromatic smear. One flat stroke looks cheap.
2. **Parameters ride the song** — each knob can bind to bass / mid / treble / onset / BPM. Motion does not free-run on a wall clock.
3. **Post exists** — bloom, blur, swell, feedback. The raw geometry is only the skeleton.
4. **Density with softness** — many fine elements, low contrast noise, not 16 fat rectangles.
5. **Silence is still** — when the track breathes out, the image settles.

We do **not** take: their ISF library, mapping engine, AI media gen, or brand.

## Gap vs Visualz 0.1

| Layer | HeavyM-class | Visualz now |
|-------|----------------|-------------|
| Renderer | GPU shaders + post | Canvas 2D strokes |
| Reactivity | per-parameter audio bind + tempo | RMS/bands/onset, song-lock started |
| Look | bloom, feedback, materials | hard clear, coarse lines (being fixed) |
| Library | hundreds of generative looks | 6 scenes |
| Output | live mapping / high-res | Studio pane + captureFrame |

## Road that stays ours

**Now (Canvas, own code)**  
- `musicClock` everywhere  
- alpha trail in the engine  
- log spectrum, peak caps, rounded bars  
- glow as stacked radial / additive passes  
- bind `intensity` / `complexity` to bass vs treble inside scenes

**Next (still ownable)**  
- WebGL2 fullscreen pass: own fragment scenes + a tiny post stack (bloom, trail, grain)  
- feature bus from `ailexsi-analyser` (better onset / BPM than AnalyserNode)  
- scene crossfade  
- export path through Resonance Exporter (Grant-gated)

**Not in scope**  
- projection mapping / edge blend  
- importing random ISF packs blindly  
- Butterchurn / projectM / AGPL

## Pass / fail for a scene

A scene ships only if:

- mute the audio → motion dies  
- kick → visible pulse, not a random spin  
- highs → detail, not the same bass blob  
- still frame looks designed, not debug geometry
