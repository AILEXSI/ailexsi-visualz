/**
 * AILEXSI Visualz — Built-in scenes
 */

import type { Scene } from "../types";
import { pulseOrbScene } from "./pulse-orb";
import { spectrumBarsScene } from "./spectrum-bars";
import { particleFieldScene } from "./particle-field";
import { resonanceWaveScene } from "./resonance-wave";
import { tunnelSpiralScene } from "./tunnel-spiral";
import { litaBloomScene } from "./lita-bloom";

export const builtinScenes: Scene[] = [
  pulseOrbScene,
  spectrumBarsScene,
  particleFieldScene,
  resonanceWaveScene,
  tunnelSpiralScene,
  litaBloomScene,
];

export {
  pulseOrbScene,
  spectrumBarsScene,
  particleFieldScene,
  resonanceWaveScene,
  tunnelSpiralScene,
  litaBloomScene,
};
