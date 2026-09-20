import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KALEIDO_TUNNEL_DEFAULTS,
  KALEIDO_TUNNEL_ID,
  createKaleidoMotionState,
  kaleidoTunnelScene,
  stepKaleidoMotion,
} from "./kaleido-tunnel";
import { kaleidoPoseHash, kaleidoPoseKey } from "./kaleido-math";
import { getCatalogEntry } from "./catalog";
import { builtinScenes } from "./index";

function silent(timeMs: number) {
  return { timeMs, rms: 0, bass: 0, kick: 0, beatPulse: 0 };
}

function music(timeMs: number) {
  const t = timeMs / 1000;
  const kick = t % 0.5 < 0.04 ? 1 : 0;
  return { timeMs, rms: 0.42, bass: 0.55, kick, beatPulse: kick };
}

describe("Kaleido · Tunnel", () => {
  it("keeps its own id and does not overwrite kaleido-loop presets", () => {
    expect(KALEIDO_TUNNEL_ID).toBe("kaleido-tunnel");
    expect(kaleidoTunnelScene.id).toBe("kaleido-tunnel");
    expect(kaleidoTunnelScene.name).toBe("Kaleido · Tunnel");
    expect(getCatalogEntry("kaleido-tunnel")).toMatchObject({
      id: "kaleido-tunnel",
      displayName: "Kaleido · Tunnel",
      renderer: "kaleido-tunnel",
      family: "Kaleido Loop",
      params: KALEIDO_TUNNEL_DEFAULTS,
    });
    expect(getCatalogEntry("kaleido-loop-cyan-pulse")?.renderer).toBe("kaleido-loop");
    expect(builtinScenes.some((s) => s.id === "kaleido-tunnel")).toBe(true);
    expect(KALEIDO_TUNNEL_DEFAULTS).toMatchObject({
      mirrors: 12,
      periodBeats: 16,
      rotSpeed: 0.7,
      bloom: 0.55,
      hueDrift: 20,
      pulseAmount: 0.4,
    });
  });

  it("draw path is perspective rings — travel uses fract(row+u), no camera shake", () => {
    const src = readFileSync(new URL("./kaleido-tunnel.ts", import.meta.url), "utf8");
    expect(src).toMatch(/TUNNEL DRAW PATH/);
    expect(src).toMatch(/paintKaleidoTunnel/);
    expect(src).toMatch(/kaleidoFract\(i \/ rings \+ uu/);
    expect(src).not.toMatch(/cameraShake|shake/);
  });

  it("A/B: music advances depth u; silence after decay freezes travel", () => {
    const s = createKaleidoMotionState();
    const dt = 1 / 30;
    const hash0 = kaleidoPoseHash(kaleidoPoseKey(s.u));
    for (let i = 1; i <= 240; i++) {
      stepKaleidoMotion(s, music(i * dt * 1000), { dt, flowSpeed: 0.7, periodSec: 8 });
    }
    expect(s.u).toBeGreaterThan(0.01);
    expect(kaleidoPoseHash(kaleidoPoseKey(s.u))).not.toBe(hash0);

    const s2 = createKaleidoMotionState();
    for (let i = 1; i <= 60; i++) {
      stepKaleidoMotion(s2, music(i * dt * 1000), { dt, flowSpeed: 0.7, periodSec: 8 });
    }
    stepKaleidoMotion(s2, { timeMs: 61 * dt * 1000, rms: 0, bass: 0, kick: 1, beatPulse: 1 }, { dt, flowSpeed: 0.7, periodSec: 8 });
    for (let i = 62; i <= 62 + 180; i++) {
      stepKaleidoMotion(s2, silent(i * dt * 1000), { dt, flowSpeed: 0.7, periodSec: 8 });
    }
    const frozen = s2.u;
    const h = kaleidoPoseHash(kaleidoPoseKey(s2.u));
    for (let i = 243; i <= 243 + 240; i++) {
      stepKaleidoMotion(s2, silent(i * dt * 1000), { dt, flowSpeed: 0.7, periodSec: 8 });
    }
    expect(s2.gate).toBe(0);
    expect(s2.u).toBe(frozen);
    expect(kaleidoPoseHash(kaleidoPoseKey(s2.u))).toBe(h);
  });
});
