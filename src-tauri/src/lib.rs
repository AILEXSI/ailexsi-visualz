//! Minimal Tauri 2 host for the Visualz Arranger.
//! No last-project / multi-track media scope — import stays on the web file input.
//! User-picked export paths are granted one file at a time (same idea as 5.6).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![allow_user_paths])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// User-picked / remembered paths only. Does not allow C:\ wholesale.
#[tauri::command]
fn allow_user_paths(app: tauri::AppHandle, paths: Vec<String>) {
    use tauri_plugin_fs::FsExt;
    for path in paths {
        if path.is_empty() {
            continue;
        }
        let _ = app.fs_scope().allow_file(&path);
    }
}
