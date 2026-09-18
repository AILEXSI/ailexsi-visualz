/**
 * EXE save via plugin-dialog + plugin-fs.
 * Chrome keeps File System Access / <a download>. Import stays on <input type="file">.
 */

import { isTauriRuntime } from "./tauri-runtime";

export async function pickTauriSavePath(suggestedName: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const dialog = await import("@tauri-apps/plugin-dialog");
  const picked = await dialog.save({
    defaultPath: suggestedName,
    filters: [{ name: "MP4", extensions: ["mp4"] }],
  });
  return typeof picked === "string" && picked.length > 0 ? picked : null;
}

export async function writeTauriFile(path: string, bytes: Uint8Array): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  const fs = await import("@tauri-apps/plugin-fs");
  await invoke("allow_user_paths", { paths: [path] });
  await fs.writeFile(path, bytes);
}
