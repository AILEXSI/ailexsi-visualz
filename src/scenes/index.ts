import type { Scene } from "../types";
import { pulseOrbScene } from "./pulse-orb";
import { spectrumBarsScene } from "./spectrum-bars";
import { particleFieldScene } from "./particle-field";
import { resonanceWaveScene } from "./resonance-wave";
import { tunnelSpiralScene } from "./tunnel-spiral";
import { litaBloomScene } from "./lita-bloom";
import { auroraRibbonScene } from "./aurora-ribbon";
import { cymaticGridScene } from "./cymatic-grid";
import { kickSunScene } from "./kick-sun";

export const builtinScenes: Scene[] = [
  resonanceWaveScene,
  auroraRibbonScene,
  kickSunScene,
  litaBloomScene,
  spectrumBarsScene,
  cymaticGridScene,
  particleFieldScene,
  tunnelSpiralScene,
  pulseOrbScene,
];

export {
  pulseOrbScene,
  spectrumBarsScene,
  particleFieldScene,
  resonanceWaveScene,
  tunnelSpiralScene,
  litaBloomScene,
  auroraRibbonScene,
  cymaticGridScene,
  kickSunScene,
};
