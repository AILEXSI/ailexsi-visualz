import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "../../app/src");

describe("Wave-History Preview/Export transport", () => {
  it("Preview and Export attach the same analyzer helper", () => {
    const preview = readFileSync(join(app, "ui/Preview.tsx"), "utf8");
    const exp = readFileSync(join(app, "export/vis-export.ts"), "utf8");
    expect(preview).toContain("createWaveHistoryAnalyzer");
    expect(preview).toContain("featuresWithWaveHistory");
    expect(exp).toContain("createWaveHistoryAnalyzer");
    expect(exp).toContain("featuresWithWaveHistory");
    expect(preview).toContain("audio.currentTime * 1000");
    expect(exp).toContain("featuresWithWaveHistory(raw, wave, featMs)");
  });
});
