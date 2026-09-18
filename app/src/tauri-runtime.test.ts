import { describe, expect, it } from "vitest";
import { isTauriRuntime } from "./tauri-runtime";

describe("isTauriRuntime", () => {
  it("is false in Node / vitest", () => {
    expect(isTauriRuntime(undefined)).toBe(false);
    expect(isTauriRuntime({})).toBe(false);
  });

  it("is true when Tauri internals exist", () => {
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true);
  });
});
