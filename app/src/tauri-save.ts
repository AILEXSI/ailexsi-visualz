/**
 * EXE save via plugin-dialog + plugin-fs.
 * Chrome keeps File System Access / <a download>. Import stays on <input type="file">.
 */

import { isTauriRuntime } from "./tauri-runtime";

export async function pickTauriSavePath(
  suggestedName: string,
  filters = [{ name: "MP4", extensions: ["mp4"] }],
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const dialog = await import("@tauri-apps/plugin-dialog");
  const picked = await dialog.save({
    defaultPath: suggestedName,
    filters,
  });
  return typeof picked === "string" && picked.length > 0 ? picked : null;
}

export async function pickTauriOpenPath(
  filters = [{ name: "Visualz", extensions: ["json"] }],
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const dialog = await import("@tauri-apps/plugin-dialog");
  const picked = await dialog.open({
    multiple: false,
    filters,
  });
  return typeof picked === "string" && picked.length > 0 ? picked : null;
}

export async function readTauriFileText(path: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  const fs = await import("@tauri-apps/plugin-fs");
  await invoke("allow_user_paths", { paths: [path] });
  return fs.readTextFile(path);
}

export async function writeTauriFile(path: string, bytes: Uint8Array): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  const fs = await import("@tauri-apps/plugin-fs");
  await invoke("allow_user_paths", { paths: [path] });
  await fs.writeFile(path, bytes);
}
