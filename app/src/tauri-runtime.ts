/** True inside the WebView2 / Tauri exe. Chrome and vitest stay false. */
export function isTauriRuntime(
  global: unknown = typeof window !== "undefined" ? window : undefined,
): boolean {
  if (!global || typeof global !== "object") return false;
  return Boolean((global as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}
