import { describe, expect, it } from "vitest";
import { LEXI_ENERGY_HORIZON_DEFAULTS, LEXI_ENERGY_HORIZON_ID, lexiEnergyHorizonScene } from "./lexi-energy-horizon";
import { LEXI_ENERGY_FIELD_DEFAULTS, LEXI_ENERGY_FIELD_ID, lexiEnergyFieldScene } from "./lexi-energy-field";
import { LEXI_ENERGY_SPECTRUM_DEFAULTS, LEXI_ENERGY_SPECTRUM_ID, lexiEnergySpectrumScene } from "./lexi-energy-spectrum";
import { ENERGY_HORIZON_Y } from "./lexi-energy-math";
import { getCatalogEntry } from "./catalog";
import { builtinScenes } from "./index";

const RETAINED = [
  "lexi-terrain-gold",
  "lexi-terrain-gold-field",
  "lexi-terrain-gold-field-plus",
  "lexi-terrain-gold-hero",
  "lexi-terrain-gold-p12",
  "kaleido-loop",
  "kaleido-crystal",
  "kaleido-petal",
  "kaleido-tunnel",
];

describe("LEXI Energy catalog", () => {
  it("wires three new ids under LEXI Energy and keeps old stages", () => {
    expect(LEXI_ENERGY_HORIZON_ID).toBe("lexi-energy-horizon");
    expect(LEXI_ENERGY_FIELD_ID).toBe("lexi-energy-field");
    expect(LEXI_ENERGY_SPECTRUM_ID).toBe("lexi-energy-spectrum");
    expect(lexiEnergyHorizonScene.name).toBe("LEXI · Energy Horizon");
    expect(lexiEnergyFieldScene.name).toBe("LEXI · Energy Field");
    expect(lexiEnergySpectrumScene.name).toBe("LEXI · Energy Spectrum");

    expect(getCatalogEntry("lexi-energy-horizon")).toMatchObject({
      id: "lexi-energy-horizon",
      displayName: "LEXI · Energy Horizon",
      renderer: "lexi-energy-horizon",
      family: "LEXI Energy",
      params: LEXI_ENERGY_HORIZON_DEFAULTS,
    });
    expect(getCatalogEntry("lexi-energy-field")).toMatchObject({
      id: "lexi-energy-field",
      displayName: "LEXI · Energy Field",
      renderer: "lexi-energy-field",
      family: "LEXI Energy",
    });
    expect(getCatalogEntry("lexi-energy-spectrum")).toMatchObject({
      id: "lexi-energy-spectrum",
      displayName: "LEXI · Energy Spectrum",
      renderer: "lexi-energy-spectrum",
      family: "LEXI Energy",
    });

    expect(LEXI_ENERGY_HORIZON_DEFAULTS.horizonY).toBe(ENERGY_HORIZON_Y);
    expect(LEXI_ENERGY_FIELD_DEFAULTS.lineDensity).toBeGreaterThan(LEXI_ENERGY_HORIZON_DEFAULTS.lineDensity);
    expect(LEXI_ENERGY_SPECTRUM_DEFAULTS.spectrumAmount).toBeGreaterThan(
      LEXI_ENERGY_HORIZON_DEFAULTS.spectrumAmount,
    );

    for (const id of [
      ...RETAINED,
      "lexi-energy-horizon",
      "lexi-energy-field",
      "lexi-energy-spectrum",
    ]) {
      expect(builtinScenes.some((s) => s.id === id)).toBe(true);
    }
    expect(getCatalogEntry("lexi-terrain-gold")?.displayName).toBe("Terrain Gold · MotionGate");
    expect(getCatalogEntry("kaleido-loop")?.family).toBe("Kaleido Loop");
  });
});
