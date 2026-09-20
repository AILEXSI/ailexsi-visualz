/**
 * Shared VIS style registry. UI families and apply-on-click read this only.
 * Existing cinematic scenes are wired, not rebuilt. Kaleido Loop is a new family.
 */

import type { SceneParams } from "../types";
import { KALEIDO_LOOP_PRESETS, type KaleidoPresetId } from "./kaleido-loop";
import { KALEIDO_CRYSTAL_DEFAULTS } from "./kaleido-crystal";
import { KALEIDO_PETAL_DEFAULTS } from "./kaleido-petal";
import { KALEIDO_TUNNEL_DEFAULTS } from "./kaleido-tunnel";
import { LEXI_TERRAIN_GOLD_DEFAULTS } from "./lexi-terrain-gold";
import { LEXI_TERRAIN_GOLD_FIELD_DEFAULTS } from "./lexi-terrain-gold-field";
import { LEXI_TERRAIN_GOLD_FIELD_PLUS_DEFAULTS } from "./lexi-terrain-gold-field-plus";
import { LEXI_TERRAIN_GOLD_HERO_DEFAULTS } from "./lexi-terrain-gold-hero";
import { LEXI_TERRAIN_GOLD_P12_DEFAULTS } from "./lexi-terrain-gold-p12";
import { LEXI_ENERGY_HORIZON_DEFAULTS } from "./lexi-energy-horizon";
import { LEXI_ENERGY_FIELD_DEFAULTS } from "./lexi-energy-field";
import { LEXI_ENERGY_SPECTRUM_DEFAULTS } from "./lexi-energy-spectrum";

export const VIS_FAMILIES = [
  "LEXI",
  "LEXI Terrain Gold",
  "LEXI Energy",
  "Classic",
  "Flow",
  "Geometry",
  "Synthwave",
  "Particle-Nebula",
  "Kaleido Loop",
] as const;

export type VisFamilyId = (typeof VIS_FAMILIES)[number];

export interface SceneCatalogEntry {
  id: string;
  displayName: string;
  shortName: string;
  family: VisFamilyId;
  description: string;
  renderer: string;
  mode?: "loop-seamless";
  preset?: KaleidoPresetId;
  params?: Partial<SceneParams>;
}

export const SCENE_CATALOG: readonly SceneCatalogEntry[] = [
  // LEXI Terrain Gold stages: new stages = new ids. Never overwrite/delete an older stage.
  {
    id: "lexi-terrain-gold",
    displayName: "Terrain Gold · MotionGate",
    shortName: "MotionGate",
    family: "LEXI Terrain Gold",
    description: "Latest: 100% audio-gated motion. Pass 1+2 look, MotionGate travel.",
    renderer: "lexi-terrain-gold",
    mode: "loop-seamless",
    params: LEXI_TERRAIN_GOLD_DEFAULTS,
  },
  {
    id: "lexi-terrain-gold-field",
    displayName: "Terrain Gold · Field Draw",
    shortName: "Field Draw",
    family: "LEXI Terrain Gold",
    description: "Polylines + ridge points in the heightfield. 100% audio motion. No dune fill.",
    renderer: "lexi-terrain-gold-field",
    mode: "loop-seamless",
    params: LEXI_TERRAIN_GOLD_FIELD_DEFAULTS,
  },
  {
    id: "lexi-terrain-gold-field-plus",
    displayName: "Terrain Gold · Field Draw Plus",
    shortName: "Field Plus",
    family: "LEXI Terrain Gold",
    description: "Field Draw Plus — harder ridges, peak filaments, stronger Z. No dune fill.",
    renderer: "lexi-terrain-gold-field-plus",
    mode: "loop-seamless",
    params: LEXI_TERRAIN_GOLD_FIELD_PLUS_DEFAULTS,
  },
  {
    id: "lexi-terrain-gold-hero",
    displayName: "Terrain Gold · Hero Look",
    shortName: "Hero Look",
    family: "LEXI Terrain Gold",
    description: "Hero Look canvas preview — thick ridge ribbons, volume fog, sparse bokeh.",
    renderer: "lexi-terrain-gold-hero",
    mode: "loop-seamless",
    params: LEXI_TERRAIN_GOLD_HERO_DEFAULTS,
  },
  {
    id: "lexi-terrain-gold-p12",
    displayName: "Terrain Gold · Pass 1+2 (clock)",
    shortName: "P1+2 clock",
    family: "LEXI Terrain Gold",
    description: "Retained Pass 1+2: time-driven u/parx/motes + light bass ampLift.",
    renderer: "lexi-terrain-gold-p12",
    mode: "loop-seamless",
    params: LEXI_TERRAIN_GOLD_P12_DEFAULTS,
  },
  {
    id: "lexi-energy-horizon",
    displayName: "LEXI · Energy Horizon",
    shortName: "Energy Horizon",
    family: "LEXI Energy",
    description: "Frontal gold energy field — vanishing-point horizon, lines on black.",
    renderer: "lexi-energy-horizon",
    mode: "loop-seamless",
    params: LEXI_ENERGY_HORIZON_DEFAULTS,
  },
  {
    id: "lexi-energy-field",
    displayName: "LEXI · Energy Field",
    shortName: "Energy Field",
    family: "LEXI Energy",
    description: "Denser converging energy lines. Black gaps. Audio-gated travel.",
    renderer: "lexi-energy-field",
    mode: "loop-seamless",
    params: LEXI_ENERGY_FIELD_DEFAULTS,
  },
  {
    id: "lexi-energy-spectrum",
    displayName: "LEXI · Energy Spectrum",
    shortName: "Energy Spectrum",
    family: "LEXI Energy",
    description: "Energy field plus irregular vertical wisps above the horizon.",
    renderer: "lexi-energy-spectrum",
    mode: "loop-seamless",
    params: LEXI_ENERGY_SPECTRUM_DEFAULTS,
  },
  {
    id: "resonance-wave",
    displayName: "Resonance Wave",
    shortName: "Wave",
    family: "Classic",
    description: "Resonance Hero — gold standard",
    renderer: "resonance-wave",
  },
  {
    id: "spectrum-bars",
    displayName: "Spectrum Bars",
    shortName: "Bars",
    family: "Classic",
    description: "Mirrored frequency bars",
    renderer: "spectrum-bars",
  },
  {
    id: "pulse-orb",
    displayName: "Pulse Orb",
    shortName: "Orb",
    family: "Classic",
    description: "Centered orb with reactive pulse",
    renderer: "pulse-orb",
  },
  {
    id: "kick-sun",
    displayName: "Kick Sun",
    shortName: "Sun",
    family: "Classic",
    description: "Soft sun + kick rays",
    renderer: "kick-sun",
  },
  {
    id: "lita-bloom",
    displayName: "Lita Bloom",
    shortName: "Bloom",
    family: "Classic",
    description: "Teardrop bloom",
    renderer: "lita-bloom",
  },
  {
    id: "aurora-ribbon",
    displayName: "Aurora Ribbon",
    shortName: "Aurora",
    family: "Flow",
    description: "Flowing aurora ribbons",
    renderer: "aurora-ribbon",
  },
  {
    id: "tunnel-spiral",
    displayName: "Tunnel Spiral",
    shortName: "Tunnel",
    family: "Flow",
    description: "Rotating depth rings",
    renderer: "tunnel-spiral",
  },
  {
    id: "cymatic-grid",
    displayName: "Cymatic Grid",
    shortName: "Grid",
    family: "Geometry",
    description: "Cymatic lattice",
    renderer: "cymatic-grid",
  },
  {
    id: "kick-sun-synth",
    displayName: "Kick Sun",
    shortName: "Sun",
    family: "Synthwave",
    description: "Kick sun in the Synthwave family",
    renderer: "kick-sun",
  },
  {
    id: "lita-bloom-synth",
    displayName: "Lita Bloom",
    shortName: "Bloom",
    family: "Synthwave",
    description: "Lita bloom in the Synthwave family",
    renderer: "lita-bloom",
  },
  {
    id: "particle-field",
    displayName: "Particle Field",
    shortName: "Field",
    family: "Particle-Nebula",
    description: "Reactive particle field",
    renderer: "particle-field",
  },
  {
    id: "kaleido-loop",
    displayName: "Kaleido Loop",
    shortName: "Kaleido",
    family: "Kaleido Loop",
    description: "Seamless neon kaleidoscope tunnel",
    renderer: "kaleido-loop",
    mode: "loop-seamless",
    preset: "gold-gate",
    params: KALEIDO_LOOP_PRESETS["gold-gate"],
  },
  {
    id: "kaleido-loop-gold-gate",
    displayName: "Gold Gate",
    shortName: "Gold Gate",
    family: "Kaleido Loop",
    description: "Kaleido Loop preset — gold gate",
    renderer: "kaleido-loop",
    mode: "loop-seamless",
    preset: "gold-gate",
    params: KALEIDO_LOOP_PRESETS["gold-gate"],
  },
  {
    id: "kaleido-loop-pink-core",
    displayName: "Pink Core",
    shortName: "Pink Core",
    family: "Kaleido Loop",
    description: "Kaleido Loop preset — pink core",
    renderer: "kaleido-loop",
    mode: "loop-seamless",
    preset: "pink-core",
    params: KALEIDO_LOOP_PRESETS["pink-core"],
  },
  {
    id: "kaleido-loop-cyan-pulse",
    displayName: "Cyan Pulse",
    shortName: "Cyan Pulse",
    family: "Kaleido Loop",
    description: "Kaleido Loop preset — cyan pulse",
    renderer: "kaleido-loop",
    mode: "loop-seamless",
    preset: "cyan-pulse",
    params: KALEIDO_LOOP_PRESETS["cyan-pulse"],
  },
  {
    id: "kaleido-crystal",
    displayName: "Kaleido · Crystal",
    shortName: "Crystal",
    family: "Kaleido Loop",
    description: "Hard prism facets — ice-white + gold, gated spin, kick edge flash",
    renderer: "kaleido-crystal",
    mode: "loop-seamless",
    params: KALEIDO_CRYSTAL_DEFAULTS,
  },
  {
    id: "kaleido-petal",
    displayName: "Kaleido · Petal",
    shortName: "Petal",
    family: "Kaleido Loop",
    description: "Soft petal flower — pink-gold, rms breathe, gated hue",
    renderer: "kaleido-petal",
    mode: "loop-seamless",
    params: KALEIDO_PETAL_DEFAULTS,
  },
  {
    id: "kaleido-tunnel",
    displayName: "Kaleido · Tunnel",
    shortName: "Tunnel",
    family: "Kaleido Loop",
    description: "Perspective mirrored rings — gated inward travel, neon",
    renderer: "kaleido-tunnel",
    mode: "loop-seamless",
    params: KALEIDO_TUNNEL_DEFAULTS,
  },
];

const BY_ID = new Map(SCENE_CATALOG.map((e) => [e.id, e]));

export function getCatalogEntry(id: string): SceneCatalogEntry | undefined {
  return BY_ID.get(id);
}

export function catalogEntriesFor(family?: VisFamilyId): readonly SceneCatalogEntry[] {
  if (!family) return SCENE_CATALOG;
  return SCENE_CATALOG.filter((e) => e.family === family);
}

export function catalogRendererIds(): string[] {
  return [...new Set(SCENE_CATALOG.map((e) => e.renderer))];
}
