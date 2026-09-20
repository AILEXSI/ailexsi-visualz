//! Minimal Tauri 2 host for the Visualz Arranger.
//! No last-project / multi-track media scope — import stays on the web file input.
//! User-picked export paths are granted one file at a time (same idea as 5.6).
//! Primary Export MP4 muxes VIS + A1 with ffmpeg (never ships vis-only as success).

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![allow_user_paths, ffmpeg_mux_vis_a1])
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegMuxResult {
    command: String,
    probe_json: String,
    has_audio: bool,
    audio_codec: Option<String>,
}

fn quote_arg(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\\\""))
}

fn display_bin_name(bin: &str) -> String {
    let path = Path::new(bin);
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(bin);
    if name == "ffmpeg" || name == "ffmpeg.exe" {
        "ffmpeg".to_string()
    } else {
        quote_arg(bin)
    }
}

/// Canonical string started / logged / tested.
fn quote_ffmpeg_mux_command(bin: &str, vis: &str, wav: &str, out: &str) -> String {
    format!(
        "{} -y -i {} -i {} -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest {}",
        display_bin_name(bin),
        quote_arg(vis),
        quote_arg(wav),
        quote_arg(out)
    )
}

fn command_exists(bin: &str) -> bool {
    Command::new(bin)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn resolve_bin(name: &str) -> Result<PathBuf, String> {
    let candidates = if cfg!(windows) {
        vec![format!("{name}.exe"), name.to_string()]
    } else {
        vec![name.to_string()]
    };
    for cand in &candidates {
        if command_exists(cand) {
            return Ok(PathBuf::from(cand));
        }
    }
    Err(format!(
        "FAIL: {name} not found on PATH. Export MP4 requires ffmpeg to mux VIS H.264 + A1 audio (AAC 320k). \
         Vis-only is not a silent fallback. Install ffmpeg (DreamBrain77) or add it to PATH, then retry Export MP4."
    ))
}

fn run_ffmpeg_mux(bin: &Path, vis: &str, wav: &str, out: &str) -> Result<String, String> {
    // Mandatory: -map 0:v:0 -map 1:a:0 and -c:a aac (never drop the audio encoder).
    let args = [
        "-y",
        "-i",
        vis,
        "-i",
        wav,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "320k",
        "-shortest",
        out,
    ];
    let command = quote_ffmpeg_mux_command(&bin.display().to_string(), vis, wav, out);
    eprintln!("[visualz-export] {command}");
    let output = Command::new(bin)
        .args(args)
        .output()
        .map_err(|e| format!("FAIL: could not start ffmpeg: {e}. command: {command}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "FAIL: ffmpeg mux failed ({}). command: {command}\n{stderr}",
            output.status
        ));
    }
    Ok(command)
}

fn run_ffprobe(out: &str) -> Result<String, String> {
    let bin = resolve_bin("ffprobe")?;
    let output = Command::new(bin)
        .args([
            "-v",
            "error",
            "-show_streams",
            "-print_format",
            "json",
            out,
        ])
        .output()
        .map_err(|e| format!("FAIL: could not start ffprobe: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FAIL: ffprobe failed on muxed MP4.\n{stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn probe_audio(probe_json: &str) -> (bool, Option<String>) {
    let parsed: serde_json::Value = serde_json::from_str(probe_json).unwrap_or(serde_json::json!({}));
    let Some(streams) = parsed.get("streams").and_then(|s| s.as_array()) else {
        return (false, None);
    };
    for stream in streams {
        if stream.get("codec_type").and_then(|v| v.as_str()) == Some("audio") {
            let codec = stream
                .get("codec_name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            return (true, codec);
        }
    }
    (false, None)
}

/// Mux vis-only H.264 + ranged A1 WAV → one MP4 with AAC. Fails if ffmpeg is missing or no audio stream.
#[tauri::command]
fn ffmpeg_mux_vis_a1(vis_path: String, wav_path: String, out_path: String) -> Result<FfmpegMuxResult, String> {
    if vis_path.is_empty() || wav_path.is_empty() || out_path.is_empty() {
        return Err("FAIL: ffmpeg mux needs visTemp.mp4, a1Range.wav, and an output path.".into());
    }
    let ffmpeg = resolve_bin("ffmpeg")?;
    let command = run_ffmpeg_mux(&ffmpeg, &vis_path, &wav_path, &out_path)?;
    let probe_json = match run_ffprobe(&out_path) {
        Ok(json) => json,
        Err(err) => {
            // ffprobe missing: still refuse to claim success without a later JS box probe.
            return Err(format!(
                "{err} command: {command}. Export cannot show Fertig without an audio stream probe."
            ));
        }
    };
    let (has_audio, audio_codec) = probe_audio(&probe_json);
    if !has_audio {
        return Err(format!(
            "FAIL: Export MP4 has no audio stream (ffprobe has no codec_type=audio). Silent vis-only is not a success. command: {command}\n{probe_json}"
        ));
    }
    Ok(FfmpegMuxResult {
        command,
        probe_json,
        has_audio,
        audio_codec,
    })
}
