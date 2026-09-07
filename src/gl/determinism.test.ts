import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("no accidental Math.random in engine core", () => {
  it("core draw/gl/audio/resonance-wave stay deterministic", () => {
    const files = [
      join(root, "draw/rng.ts"),
      join(root, "draw/motion.ts"),
      join(root, "gl/post-pipeline.ts"),
      join(root, "gl/feedback.ts"),
      join(root, "scenes/resonance-wave.ts"),
      join(root, "audio/feature-extractor.ts"),
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src.includes("Math.random"), f).toBe(false);
    }
  });
});
