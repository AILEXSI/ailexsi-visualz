/**
 * Shared VIS style registry. UI families and apply-on-click read this only.
 * Existing cinematic scenes are wired, not rebuilt. Kaleido Loop is a new family.
 */

import type { SceneParams } from "../types";
import { KALEIDO_LOOP_PRESETS, type KaleidoPresetId } from "./kaleido-loop";
import { LEXI_TERRAIN_GOLD_DEFAULTS } from "./lexi-terrain-gold";

export const VIS_FAMILIES = [
  "LEXI",
  "LEXI Terrain Gold",
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
  {
    id: "lexi-terrain-gold",
    displayName: "Terrain Gold",
    shortName: "Terrain",
    family: "LEXI Terrain Gold",
    description: "Gold particle dunes, horizon mountains, fog — not Kaleido",
    renderer: "lexi-terrain-gold",
    mode: "loop-seamless",
    params: LEXI_TERRAIN_GOLD_DEFAULTS,
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
