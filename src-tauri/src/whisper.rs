// Writing out voice memos on Windows (and Linux): Whisper (whisper.cpp) running right here, nothing sent anywhere.
// The model is a one-time download the person says yes to; after that it works offline.
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::{Arc, Mutex};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";   // multilingual, about 140 MB
const MODEL_SIZE_MIN: u64 = 100_000_000;
static DOWNLOADING: AtomicBool = AtomicBool::new(false);
static GOT: AtomicU64 = AtomicU64::new(0);
static TOTAL: AtomicU64 = AtomicU64::new(0);
static FAILED: Mutex<Option<String>> = Mutex::new(None);
static CTX: Mutex<Option<Arc<WhisperContext>>> = Mutex::new(None);

fn model() -> std::path::PathBuf { super::support().join("whisper").join("ggml-base.bin") }
fn ready() -> bool { std::fs::metadata(model()).map_or(false, |m| m.len() > MODEL_SIZE_MIN) }

pub fn status() -> Value {
    let (got, total) = (GOT.load(Relaxed), TOTAL.load(Relaxed));
    json!({ "ready": ready(), "downloading": DOWNLOADING.load(Relaxed), "progress": if total > 0 { got as f64 / total as f64 } else { 0.0 },
            "error": FAILED.lock().unwrap_or_else(|e| e.into_inner()).clone(), "sizeMB": 142 })
}

pub fn download() {
    if ready() || DOWNLOADING.swap(true, Relaxed) { return; }
    *FAILED.lock().unwrap_or_else(|e| e.into_inner()) = None; GOT.store(0, Relaxed); TOTAL.store(0, Relaxed);
    tauri::async_runtime::spawn(async {
        let r = fetch().await;
        if let Err(e) = r { *FAILED.lock().unwrap_or_else(|e| e.into_inner()) = Some(e); }
        DOWNLOADING.store(false, Relaxed);
    });
}
async fn fetch() -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    let dir = model().parent().ok_or("Invalid whisper model path")?.to_path_buf(); tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let part = dir.join("ggml-base.bin.part");
    let client = reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
    let mut resp = client.get(MODEL_URL).send().await.map_err(|_| "I couldn't reach the download. Check your internet and try again.")?;
    if !resp.status().is_success() { return Err(format!("The download didn't start ({}).", resp.status())); }
    TOTAL.store(resp.content_length().unwrap_or(147_964_211), Relaxed);
    let mut f = tokio::fs::File::create(&part).await.map_err(|e| e.to_string())?;
    loop {
        let chunk = tokio::time::timeout(std::time::Duration::from_secs(30), resp.chunk())
            .await
            .map_err(|_| "The download timed out. Try again.")?
            .map_err(|_| "The download stopped partway. Try again.")?;
        let Some(chunk) = chunk else { break; };
        f.write_all(&chunk).await.map_err(|e| e.to_string())?; GOT.fetch_add(chunk.len() as u64, Relaxed);
    }
    f.flush().await.map_err(|e| e.to_string())?; drop(f);
    if std::fs::metadata(&part).map_or(0, |m| m.len()) < MODEL_SIZE_MIN { let _ = std::fs::remove_file(&part); return Err("The download came through incomplete. Try again.".into()); }
    std::fs::rename(&part, model()).map_err(|e| e.to_string())
}

pub fn transcribe(samples: &[f32]) -> Result<String, String> {
    if !ready() { return Err("NEED_WHISPER".into()); }
    if samples.len() < 1600 { return Ok(String::new()); }   // under a tenth of a second
    let ctx = {
        let mut slot = CTX.lock().unwrap();
        if slot.is_none() {
            let c = WhisperContext::new_with_params(model(), WhisperContextParameters::default()).map_err(|e| format!("Whisper couldn't start: {e}"))?;
            *slot = Some(Arc::new(c));
        }
        slot.as_ref().unwrap().clone()
    };
    let mut state = ctx.create_state().map_err(|e| e.to_string())?;
    let mut p = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    p.set_language(Some("auto"));
    p.set_n_threads(std::thread::available_parallelism().map_or(4, |n| n.get().min(8)) as i32);
    p.set_print_special(false); p.set_print_progress(false); p.set_print_realtime(false); p.set_print_timestamps(false);
    p.set_suppress_blank(true);
    state.full(p, samples).map_err(|e| format!("Whisper couldn't finish: {e}"))?;
    let text: Vec<String> = state.as_iter().map(|seg| seg.to_string().trim().to_string()).filter(|t| !t.is_empty()).collect();
    Ok(text.join(" ").replace("  ", " ").trim().to_string())
}
