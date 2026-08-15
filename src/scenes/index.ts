/**
 * AILEXSI Visualz — Scene registry
 */

import { registerScene } from "../index";
import { pulseOrbScene } from "./pulse-orb";
import { spectrumBarsScene } from "./spectrum-bars";
import { particleFieldScene } from "./particle-field";
import { resonanceWaveScene } from "./resonance-wave";
import { tunnelSpiralScene } from "./tunnel-spiral";
import { litaBloomScene } from "./lita-bloom";

/** Call once at startup to register all built-in scenes */
export function registerBuiltinScenes(): void {
  registerScene(pulseOrbScene);
  registerScene(spectrumBarsScene);
  registerScene(particleFieldScene);
  registerScene(resonanceWaveScene);
  registerScene(tunnelSpiralScene);
  registerScene(litaBloomScene);
}

export {
  pulseOrbScene,
  spectrumBarsScene,
  particleFieldScene,
  resonanceWaveScene,
  tunnelSpiralScene,
  litaBloomScene,
};
