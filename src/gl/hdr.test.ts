import { describe, it, expect } from "vitest";
import { chooseHdrFormat } from "./hdr";

const BYTE = {
  RGBA: 0x1908,
  RGBA8: 0x8058,
  UNSIGNED_BYTE: 0x1401,
};

describe("chooseHdrFormat", () => {
  it("falls back to RGBA8 without extension", () => {
    const fmt = chooseHdrFormat({
      ...BYTE,
      getExtension: () => null,
    });
    expect(fmt.hdr).toBe(false);
    expect(fmt.label).toBe("RGBA8");
    expect(fmt.type).toBe(BYTE.UNSIGNED_BYTE);
  });

  it("selects RGBA16F when extension and enums exist", () => {
    const fmt = chooseHdrFormat({
      ...BYTE,
      RGBA16F: 0x881a,
      HALF_FLOAT: 0x140b,
      getExtension: (name: string) => (name === "EXT_color_buffer_float" ? {} : null),
    });
    expect(fmt.hdr).toBe(true);
    expect(fmt.label).toBe("RGBA16F");
    expect(fmt.internalFormat).toBe(0x881a);
  });

  it("falls back if enums missing even with extension", () => {
    const fmt = chooseHdrFormat({
      ...BYTE,
      getExtension: () => ({}),
    });
    expect(fmt.hdr).toBe(false);
    expect(fmt.label).toBe("RGBA8");
  });
});
