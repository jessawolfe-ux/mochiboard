// Mochiboard for Windows (and Linux): the same canvas as the Mac app (../web), with Rust doing what a web page can't:
// saving boards as files, link previews, asking Mochi (Claude Code, `claude -p`), saving videos, fonts and updates.
// The page talks to it through one command, `mb`, with the same {op, args} messages the Mac app's Swift side answers.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod prompts;
#[cfg(feature = "whisper")]
mod whisper;
#[cfg(not(feature = "whisper"))]
mod whisper { use serde_json::{json, Value}; pub fn status() -> Value { json!({ "ready": false }) } pub fn download() {} pub fn transcribe(_: &[f32]) -> Result<String, String> { Err("NEED_WHISPER".into()) } }

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::{json, Map, Value};
use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::{http, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

// ---------- where things live: %APPDATA%\Mochiboard on Windows (MB_DATA overrides it, for testing) ----------
fn support() -> PathBuf {
    if let Ok(p) = std::env::var("MB_DATA") { return PathBuf::from(p); }
    dirs::data_dir().unwrap_or_else(std::env::temp_dir).join("Mochiboard")
}
// where the boards live: the app's own folder, or one the person picked (Dropbox, OneDrive, a shared drive), remembered in location.json
fn picked_root() -> Option<PathBuf> { std::fs::read_to_string(support().join("location.json")).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()).and_then(|j| j["path"].as_str().map(PathBuf::from)) }
fn root() -> PathBuf { picked_root().filter(|p| p.is_dir()).unwrap_or_else(support) }
fn boards_dir() -> PathBuf { root().join("boards") }
fn media_dir() -> PathBuf { root().join("media") }
fn safe(v: Option<&Value>) -> String {
    let s = match v { Some(Value::String(s)) => s.clone(), Some(v) => v.to_string(), None => "x".into() };
    s.chars().filter(|c| c.is_alphanumeric() || *c == '-').collect()
}
fn s<'a>(a: &'a Value, k: &str) -> &'a str { a.get(k).and_then(|v| v.as_str()).unwrap_or("") }
static USAGE_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
async fn mb(app: tauri::AppHandle, op: String, args: Value) -> Result<Value, String> {
    let a = &args;
    match op.as_str() {
        "version" => Ok(json!(env!("CARGO_PKG_VERSION"))),
        "usage" => Ok(usage_summary()),
        "resetUsage" => { let _g = USAGE_LOCK.lock().unwrap(); let _ = std::fs::remove_file(support().join("usage.json")); Ok(json!(true)) }
        // boards: one JSON file each
        "list" => {
            let mut list: Vec<Value> = vec![];
            for e in std::fs::read_dir(boards_dir()).into_iter().flatten().flatten() {
                let p = e.path(); if p.extension().map_or(true, |x| x != "json") { continue; }
                let Ok(txt) = std::fs::read_to_string(&p) else { continue }; let Ok(j) = serde_json::from_str::<Value>(&txt) else { continue };
                let updated = e.metadata().and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map_or(0.0, |d| d.as_secs_f64());
                list.push(json!({ "id": j.get("id").cloned().unwrap_or(json!("")), "name": j.get("name").cloned().unwrap_or(json!("Untitled")),
                    "color": j.get("color").cloned().unwrap_or(json!("pink")), "folder": j.get("folder").cloned().unwrap_or(Value::Null),
                    "parent": j.get("parent").cloned().unwrap_or(Value::Null), "updated": updated }));
            }
            list.sort_by(|x, y| y["updated"].as_f64().partial_cmp(&x["updated"].as_f64()).unwrap_or(std::cmp::Ordering::Equal));
            Ok(json!(list))
        }
        "load" => Ok(std::fs::read_to_string(boards_dir().join(format!("{}.json", safe(a.get("id"))))).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(Value::Null)),
        "save" => {
            let b = a.get("board").ok_or("bad board")?; let f = boards_dir().join(format!("{}.json", safe(b.get("id")))); let tmp = f.with_extension("json.tmp");
            std::fs::write(&tmp, serde_json::to_vec(b).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            std::fs::rename(&tmp, &f).map_err(|e| e.to_string())?; Ok(json!(true))
        }
        "folders" => Ok(std::fs::read_to_string(root().join("folders.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(json!([]))),
        "saveFolders" => { std::fs::write(root().join("folders.json"), serde_json::to_vec(a.get("folders").unwrap_or(&json!([]))).unwrap()).map_err(|e| e.to_string())?; Ok(json!(true)) }
        "remove" => { let _ = std::fs::remove_file(boards_dir().join(format!("{}.json", safe(a.get("id"))))); Ok(json!(true)) }
        // the web
        "linkPreview" => Ok(link_preview(s(a, "url")).await),
        "fetchImage" => fetch_image(s(a, "url")).await.ok_or_else(|| "couldn't load that image".into()),
        // Mochi
        "connections" => Ok(connections().await),
        "ask" => ask(a).await.map(Value::String),
        "rewrite" => {
            let p = prompts::REWRITE.replace("{TITLE}", if s(a, "title").is_empty() { "Untitled" } else { s(a, "title") }).replace("{HOW}", s(a, "how"))
                .replace("{TEXT}", s(a, "text")).replace("{AROUND}", &s(a, "around").chars().take(1500).collect::<String>());
            run_claude(&p, &[], 180).await.map(|t| json!(t.trim()))
        }
        "higgsQuote" => run_claude(&prompts::HIGGS_QUOTE.replace("{MODEL}", or(s(a, "model"), "nano_banana_2")),
            &["mcp__claude_ai_higgsfield__balance", "mcp__claude_ai_higgsfield__models_explore", "mcp__claude_ai_higgsfield__show_plans_and_credits"], 180).await.map(Value::String),
        "higgsMake" => run_claude(&prompts::HIGGS_MAKE.replace("{MODEL}", or(s(a, "model"), "nano_banana_2")).replace("{STYLE}", or(s(a, "style"), "clean, modern, natural light"))
            .replace("{JOBS}", &a.get("images").unwrap_or(&json!([])).to_string()),
            &["mcp__claude_ai_higgsfield__generate_image_batch", "mcp__claude_ai_higgsfield__generate_image", "mcp__claude_ai_higgsfield__jobs_wait", "mcp__claude_ai_higgsfield__models_explore", "mcp__claude_ai_higgsfield__show_generation_by_ids"], 1200).await.map(Value::String),
        "drawFill" => run_claude(&prompts::DRAW_FILL.replace("{STYLE}", or(s(a, "style"), "soft pastel, rounded shapes, minimal")).replace("{JOBS}", &a.get("images").unwrap_or(&json!([])).to_string()), &[], 600).await.map(Value::String),
        // this computer
        "fonts" => Ok(json!(fonts())),
        "speechAuth" => Ok(json!("ok")),
        // voice memos → words with Whisper, on this computer (the page hands over 16 kHz mono audio)
        "whisperStatus" => Ok(whisper::status()),
        "whisperGet" => { whisper::download(); Ok(json!(true)) }
        "transcribe" => {
            let pcm = B64.decode(s(a, "pcm")).map_err(|_| "couldn't read that recording")?;
            let samples: Vec<f32> = pcm.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect();
            tokio::task::spawn_blocking(move || whisper::transcribe(&samples)).await.map_err(|e| e.to_string())?.map(Value::String)
        }
        "export" => Err("Saving a picture of the board is coming to Windows soon ✦".into()),
        "saveFile" => {
            let name = s(a, "name").replace(['/', '\\'], "-"); let ext = or(s(a, "ext"), "docx").to_string();
            let data = B64.decode(s(a, "data")).map_err(|_| "Nothing to save")?;
            let picked = app.dialog().file().set_file_name(format!("{}.{}", or(&name, "Document"), ext)).add_filter(ext.to_uppercase(), &[ext.as_str()]).blocking_save_file();
            match picked.and_then(|p| p.into_path().ok()) {
                Some(p) => { std::fs::write(&p, data).map_err(|e| e.to_string())?; Ok(json!(p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default())) }
                None => Ok(json!("")),
            }
        }
        "reveal" => { let _ = app.opener().open_path(boards_dir().to_string_lossy(), None::<&str>); Ok(json!(true)) }
        // connected folders: only the folders someone picks in the folder picker; disconnecting forgets the folder and never touches the files
        "connected" => Ok(connected_summary()),
        "connectFolder" => {
            let picked = app.dialog().file().set_title("Pick the folders Mochiboard can see").blocking_pick_folders().unwrap_or_default();
            let mut list = connected_list(); let mut added: Vec<String> = vec![];
            let home = dirs::home_dir().unwrap_or_default();
            for fp in picked { let Ok(p) = fp.into_path() else { continue };
                if p.parent().is_none() || p == home { if add_all_files(&mut list) { added.push("All my files".into()); } continue; }   // a whole drive or the home folder = "All my files"
                let ps = p.to_string_lossy().to_string(); if list.iter().any(|f| f["path"] == ps.as_str()) { continue; }
                let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| ps.clone());
                list.push(json!({ "id": uuid::Uuid::new_v4().to_string(), "path": ps, "name": name })); added.push(name);
            }
            save_connected(&list); Ok(json!({ "folders": connected_summary(), "added": added }))
        }
        // folders someone dragged in: dragging one in is the same as picking it, so it connects right away
        "connectPaths" => {
            let mut list = connected_list(); let mut added: Vec<String> = vec![]; let home = dirs::home_dir().unwrap_or_default();
            for v in a.get("paths").and_then(|v| v.as_array()).cloned().unwrap_or_default() { let Some(raw) = v.as_str() else { continue }; let p = PathBuf::from(raw); if !p.is_dir() { continue; }
                if p.parent().is_none() || p == home { if add_all_files(&mut list) { added.push("All my files".into()); } continue; }
                let ps = p.to_string_lossy().to_string(); if list.iter().any(|f| f["path"] == ps.as_str()) || inside_connected(&ps) { continue; }
                let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| ps.clone());
                list.push(json!({ "id": uuid::Uuid::new_v4().to_string(), "path": ps, "name": name })); added.push(name); save_connected(&list);
            }
            save_connected(&list); Ok(json!({ "folders": connected_summary(), "added": added }))
        }
        // "All my files": the whole home folder in one go (the page asks first)
        "connectAll" => { let mut list = connected_list(); let fresh = add_all_files(&mut list); save_connected(&list); Ok(json!({ "folders": connected_summary(), "added": if fresh { vec!["All my files"] } else { vec![] } })) }
        "disconnectFolder" => { let id = s(a, "id"); let list: Vec<Value> = connected_list().into_iter().filter(|f| f["id"] != id).collect(); save_connected(&list); Ok(connected_summary()) }
        "revealConnected" => {
            let id = s(a, "id"); let p = connected_list().into_iter().find(|f| f["id"] == id).and_then(|f| f["path"].as_str().map(String::from));
            match p { Some(p) if std::path::Path::new(&p).is_dir() => { let _ = app.opener().open_path(p, None::<&str>); Ok(json!(true)) }
                _ => Err("I can't find that folder anymore. Was it moved or renamed?".into()) }
        }
        // folder cards and file cards: read-only looks at what the person put on the board
        "listFolder" => { let p = s(a, "path"); if !inside_connected(p) { return Err("That folder isn’t connected anymore. Connect it again in Settings → General → Your files.".into()); } Ok(list_folder(p)) }
        "fileInfo" => { let mut m = Map::new(); for p in a.get("paths").and_then(|v| v.as_array()).cloned().unwrap_or_default() { if let Some(p) = p.as_str() { m.insert(p.to_string(), file_info(p)); } } Ok(Value::Object(m)) }
        "fileThumb" => Err("no preview".into()),   // the page draws a little badge instead
        "openFile" => { let p = s(a, "path"); if !std::path::Path::new(p).exists() { return Err("I can’t find that file anymore. Was it moved or renamed?".into()); } let _ = app.opener().open_path(p, None::<&str>); Ok(json!(true)) }
        "revealFile" => { let p = s(a, "path"); if !std::path::Path::new(p).exists() { return Err("I can’t find that file anymore. Was it moved or renamed?".into()); } let _ = app.opener().reveal_item_in_dir(p); Ok(json!(true)) }
        "pickFiles" => {
            let folders = a.get("folders").and_then(|v| v.as_bool()).unwrap_or(false); let mut d = app.dialog().file();
            if !s(a, "start").is_empty() { d = d.set_directory(s(a, "start")); }
            let picked: Vec<String> = if folders { d.set_title("Pick a folder to show on the board").blocking_pick_folders().unwrap_or_default() } else { d.set_title("Pick files to put on the board").blocking_pick_files().unwrap_or_default() }
                .into_iter().filter_map(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()).collect();
            Ok(json!(picked))
        }
        // a web page or game on this computer: serve its folder on localhost and hand back the address
        "serveFile" => serve_file(s(a, "path"), s(a, "root")).await,
        "lookAt" => Ok(json!([])),
        "videoURL" => { let p = s(a, "path"); if !std::path::Path::new(p).exists() { return Err("I can’t find that video anymore.".into()); } if !inside_connected(p) { return Err("Connect the folder this video is in, and it can play on the board.".into()); }
            let enc: String = p.replace('\\', "/").bytes().map(|b| if b.is_ascii_alphanumeric() || b"/-_.~".contains(&b) { (b as char).to_string() } else { format!("%{:02X}", b) }).collect();
            Ok(json!({ "url": format!("mbmedia://file/{}", enc.trim_start_matches('/')), "from": p })) }   // photographing pages off screen is Mac-only for now; Mochi still reads the page's HTML, CSS and art
        "readImage" => {
            let p = s(a, "path"); let d = std::fs::read(p).map_err(|_| "I couldn’t open that picture.")?; if d.len() > 6_000_000 { return Err("That picture is too big to bring in.".into()); }
            let ext = std::path::Path::new(p).extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
            Ok(json!({ "src": format!("data:{};base64,{}", mime(&ext), B64.encode(&d)) }))
        }
        "watchPaths" => Ok(json!(false)),   // the page looks again on its own every few seconds
        // where boards are saved
        "boardsHome" => Ok(library_home()),
        "moveBoards" => {
            let Some(u) = app.dialog().file().set_title("Pick where your boards live").blocking_pick_folder().and_then(|f| f.into_path().ok()) else { return Ok(json!({ "cancelled": true })) };
            if u.starts_with(support()) { return Err("That folder is inside Mochiboard itself. Pick somewhere else, like OneDrive or Documents.".into()); }
            let dest = if u.file_name().map_or(false, |n| n == "Mochiboard") || u.join("boards").is_dir() { u } else { u.join("Mochiboard") };
            move_library(&dest)?; Ok(library_home())
        }
        "resetBoardsHome" => { move_library(&support())?; let _ = std::fs::remove_file(support().join("location.json")); Ok(library_home()) }
        "openURL" => { let u = s(a, "url"); if u.starts_with("http") || u.starts_with("mailto:") || u.starts_with("spotify:") { let _ = app.opener().open_url(u, None::<&str>); } Ok(json!(true)) }
        // videos: saved as their own files in pieces (big files cross the bridge in chunks), shown through the mbmedia: address
        "mediaBegin" => {
            let ext: String = s(a, "ext").chars().filter(|c| c.is_alphanumeric()).take(5).collect();
            let name = format!("{}.{}", uuid::Uuid::new_v4(), if ext.is_empty() { "mp4".into() } else { ext });
            std::fs::write(media_dir().join(&name), b"").map_err(|e| e.to_string())?; Ok(json!(name))
        }
        "mediaChunk" => {
            use std::io::Write;
            let name = s(a, "name").replace(['/', '\\'], ""); let d = B64.decode(s(a, "data")).map_err(|_| "I couldn't save that video.")?;
            let mut f = std::fs::OpenOptions::new().append(true).open(media_dir().join(name)).map_err(|_| "I couldn't save that video.")?;
            f.write_all(&d).map_err(|e| e.to_string())?; Ok(json!(true))
        }
        "mediaEnd" => Ok(json!(format!("mbmedia://media/{}", s(a, "name").replace(['/', '\\'], "")))),
        // updates: GitHub Releases has a Windows installer next to the Mac zip
        "updateCheck" => Ok(update_check().await),
        "updatePrepare" => Err("Automatic updates are coming to Windows soon.".into()),
        "updateNow" => update_now(&app).await.map(Value::String),
        // a self-test hook for building: only there when MB_SELFTEST is set
        "log" if std::env::var("MB_SELFTEST").is_ok() => { println!("SELFTEST {}", s(a, "msg")); Ok(json!(true)) }
        "quit" if std::env::var("MB_SELFTEST").is_ok() => { app.exit(0); Ok(json!(true)) }
        _ => Err(format!("unknown op {op}")),
    }
}
fn or<'a>(v: &'a str, d: &'a str) -> &'a str { if v.is_empty() { d } else { v } }

// ---------- link previews: the page's title, description and picture ----------
fn client() -> reqwest::Client { reqwest::Client::builder().user_agent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Mochiboard").timeout(Duration::from_secs(15)).build().unwrap() }
async fn link_preview(u: &str) -> Value {
    let host = reqwest::Url::parse(u).ok().and_then(|x| x.host_str().map(String::from)).unwrap_or_else(|| u.to_string());
    let html = match client().get(u).send().await { Ok(r) => r.text().await.unwrap_or_default(), Err(_) => String::new() };
    let html: String = html.chars().take(400_000).collect();
    let meta = |keys: &[&str]| -> Option<String> {
        for k in keys {
            for pat in [format!(r#"(?i)<meta[^>]+(?:property|name)=["']{k}["'][^>]+content=["']([^"']*)["']"#), format!(r#"(?i)<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']{k}["']"#)] {
                if let Some(c) = regex::Regex::new(&pat).ok()?.captures(&html) { return Some(c[1].to_string()); }
            }
        }
        None
    };
    let mut title = meta(&["og:title", "twitter:title"]).unwrap_or_default();
    if title.is_empty() { if let Some(c) = regex::Regex::new(r"(?is)<title[^>]*>([^<]*)</title>").unwrap().captures(&html) { title = c[1].to_string(); } }
    let mut image = meta(&["og:image", "twitter:image"]).unwrap_or_default();
    if !image.is_empty() { if let Ok(base) = reqwest::Url::parse(u) { if let Ok(abs) = base.join(&image) { image = abs.to_string(); } } }
    let decode = |s: String| s.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", "\"").trim().to_string();
    json!({ "title": decode(if title.is_empty() { host.clone() } else { title }), "desc": decode(meta(&["og:description", "description"]).unwrap_or(host)), "image": image })
}
// pictures from Mobbin or Higgsfield come in as links; bring them home as data so they're saved with the board
async fn fetch_image(u: &str) -> Option<Value> {
    let r = client().get(u).timeout(Duration::from_secs(30)).send().await.ok()?;
    let t = r.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("image/jpeg").split(';').next().unwrap_or("image/jpeg").to_string();
    let b = r.bytes().await.ok()?; if b.len() < 200 { return None; }
    Some(json!(format!("data:{t};base64,{}", B64.encode(&b))))
}

// ---------- Mochi: Claude Code on this computer ----------
fn find_claude() -> Option<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    let mut spots: Vec<PathBuf> = vec![];
    if cfg!(windows) {
        spots.push(home.join(".local").join("bin").join("claude.exe"));   // the official installer
        if let Some(d) = dirs::data_dir() { spots.push(d.join("npm").join("claude.cmd")); spots.push(d.join("npm").join("claude.exe")); }   // npm install -g
        if let Some(d) = dirs::data_local_dir() { spots.push(d.join("Programs").join("claude").join("claude.exe")); }
    } else {
        for p in [".local/bin/claude", ".claude/local/claude", ".npm-global/bin/claude", ".volta/bin/claude", ".bun/bin/claude"] { spots.push(home.join(p)); }
        spots.push("/opt/homebrew/bin/claude".into()); spots.push("/usr/local/bin/claude".into());
    }
    if let Some(hit) = spots.into_iter().find(|p| p.is_file()) { return Some(hit); }
    // anywhere else on the PATH
    let finder = if cfg!(windows) { ("where", vec!["claude"]) } else { ("/bin/zsh", vec!["-lc", "command -v claude"]) };
    let mut c = std::process::Command::new(finder.0); c.args(&finder.1);
    #[cfg(windows)] { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
    let out = c.output().ok()?; String::from_utf8_lossy(&out.stdout).lines().map(|l| PathBuf::from(l.trim())).find(|p| p.is_file())
}
fn claude_cmd(claude: &PathBuf) -> tokio::process::Command {
    let mut c = tokio::process::Command::new(claude);
    c.current_dir(support()).kill_on_drop(true);
    #[cfg(windows)] { c.creation_flags(0x0800_0000); }   // no black console window flashing up
    #[cfg(not(windows))] { let path = std::env::var("PATH").unwrap_or_default(); c.env("PATH", format!("{path}:/opt/homebrew/bin:/usr/local/bin:{}/.local/bin", dirs::home_dir().unwrap_or_default().display())); }
    c
}
async fn connections() -> Value {
    let Some(claude) = find_claude() else { return json!({ "claude": false, "mobbin": false, "higgsfield": false }) };
    let out = claude_cmd(&claude).args(["mcp", "list"]).stdin(std::process::Stdio::null()).output().await;
    let text = out.map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase()).unwrap_or_default();
    let ok = |n: &str| text.lines().any(|l| l.contains(n) && l.contains("connected") && !l.contains("needs"));
    json!({ "claude": true, "mobbin": ok("mobbin"), "higgsfield": ok("higgsfield") })
}
// the prompt goes in through stdin: a board can be far longer than Windows allows on a command line
async fn run_claude(prompt: &str, tools: &[&str], timeout: u64) -> Result<String, String> { run_claude_in(prompt, tools, &[], timeout).await }
async fn run_claude_in(prompt: &str, tools: &[&str], dirs: &[String], timeout: u64) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;
    let claude = find_claude().ok_or("I need Claude Code to think. Set it up from mochiboard.app/connect.html, then try again.")?;
    let mut c = claude_cmd(&claude); c.args(["-p", "--output-format", "json"]);
    if !tools.is_empty() { c.args(["--allowedTools", &tools.join(",")]); }
    for d in dirs { c.args(["--add-dir", d]); }
    let mut child = c.stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).spawn().map_err(|e| e.to_string())?;
    let mut stdin = child.stdin.take().unwrap(); let p = prompt.to_string();
    tokio::spawn(async move { let _ = stdin.write_all(p.as_bytes()).await; let _ = stdin.shutdown().await; });
    let out = tokio::time::timeout(Duration::from_secs(timeout), child.wait_with_output()).await.map_err(|_| "Claude took too long to answer.")?.map_err(|e| e.to_string())?;
    let j: Option<Value> = serde_json::from_slice(&out.stdout).ok();
    let text = claude_result(j.as_ref(), &out.stdout);
    // a failed answer (not signed in, no plan…) comes back as an error, not as words for Mochi to read
    if j.as_ref().and_then(|j| j.get("is_error")).and_then(|v| v.as_bool()) == Some(true) { return Err(text.chars().take(300).collect()); }
    if !out.status.success() && text.is_empty() { return Err(String::from_utf8_lossy(&out.stderr).chars().take(300).collect::<String>().trim().to_string().pipe_or("Claude Code didn't answer")); }
    Ok(text)
}
trait PipeOr { fn pipe_or(self, d: &str) -> String; }
impl PipeOr for String { fn pipe_or(self, d: &str) -> String { if self.is_empty() { d.into() } else { self } } }
async fn ask(a: &Value) -> Result<String, String> {
    let mobbin = a.get("mobbin").and_then(|v| v.as_bool()).unwrap_or(true);
    let higgs = a.get("higgs").and_then(|v| v.as_bool()).unwrap_or(true);
    let confirmed = a.get("confirmed").and_then(|v| v.as_bool()).unwrap_or(false);
    let prompt = prompts::ASK.replace("{REQUEST}", s(a, "prompt")).replace("{BOARD}", &a.get("board").unwrap_or(&json!({})).to_string())
        .replace("{MOBBIN_OFF}", if mobbin { "" } else { prompts::MOBBIN_OFF }).replace("{HIGGS_OFF}", if higgs { "" } else { prompts::HIGGS_OFF })
        .replace("{HIGGS_RULE}", if confirmed { prompts::HIGGS_YES } else { prompts::HIGGS_NO });
    // only the helpers the person has switched on; the image generator only after they tap yes
    let mut tools: Vec<&str> = if mobbin { vec!["mcp__claude_ai_Mobbin__search_screens", "mcp__claude_ai_Mobbin__search_flows", "mcp__claude_ai_Mobbin__search_sections"] } else { vec![] };
    if confirmed && higgs { tools.extend(["mcp__claude_ai_higgsfield__generate_image", "mcp__claude_ai_higgsfield__generate_image_batch", "mcp__claude_ai_higgsfield__jobs_wait", "mcp__claude_ai_higgsfield__models_explore", "mcp__claude_ai_higgsfield__show_generation_by_ids"]); }   // Claude usually reaches for generate_image (one picture)
    // their files: only connected folders, only when they've let Mochi read them, and only tools that read
    let files = a.get("files").and_then(|v| v.as_bool()).unwrap_or(false);
    let readable: Vec<(String, String)> = if files { connected_list().iter().filter_map(|f| { let p = f["path"].as_str()?.to_string(); if std::path::Path::new(&p).is_dir() { Some((f["name"].as_str().unwrap_or(&p).to_string(), p)) } else { None } }).collect() } else { vec![] };
    let mut prompt = prompt;
    if !readable.is_empty() {
        tools.extend(["Read", "Glob", "Grep"]);
        prompt.push_str(&prompts::FILES.replace("{FOLDERS}", &readable.iter().map(|(n, p)| format!("\"{n}\" = {p}")).collect::<Vec<_>>().join(", ")));
    }
    else { prompt.push_str(&prompts::NO_FILES.replace("{OFF}", if files { "" } else { " (they switched off letting you read them)" })); }
    prompt.push_str(prompts::DESIGN);
    let dirs: Vec<String> = readable.into_iter().map(|(_, p)| p).collect();
    run_claude_in(&prompt, &tools, &dirs, 300).await
}
// Claude Code's JSON answer: note what it used (usage.json, same as the Mac app), hand back just the words
fn claude_result(j: Option<&Value>, raw: &[u8]) -> String {
    let Some(j) = j else { return String::from_utf8_lossy(raw).to_string() };
    let Some(result) = j.get("result").and_then(|v| v.as_str()) else { return String::from_utf8_lossy(raw).to_string() };
    let u = j.get("usage").cloned().unwrap_or(json!({})); let n = |k: &str| u.get(k).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let entry = json!([chrono::Utc::now().timestamp() as f64, n("input_tokens") + n("cache_creation_input_tokens") + n("cache_read_input_tokens"), n("output_tokens"), j.get("total_cost_usd").and_then(|v| v.as_f64()).unwrap_or(0.0)]);
    let _g = USAGE_LOCK.lock().unwrap(); let f = support().join("usage.json");
    let mut all: Vec<Value> = std::fs::read_to_string(&f).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    all.push(entry); if all.len() > 5000 { let k = all.len() - 5000; all.drain(0..k); }
    let _ = std::fs::write(&f, serde_json::to_vec(&all).unwrap());
    result.to_string()
}
// connected folders live in one small file next to the boards: [{id, path, name}]
fn connected_list() -> Vec<Value> { std::fs::read_to_string(support().join("connected.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default() }
fn save_connected(list: &[Value]) { let _ = std::fs::write(support().join("connected.json"), serde_json::to_vec(list).unwrap_or_default()); }
fn add_all_files(list: &mut Vec<Value>) -> bool {
    if list.iter().any(|f| f["all"] == "1") { return false; }
    let home = dirs::home_dir().unwrap_or_default().to_string_lossy().to_string();
    list.insert(0, json!({ "id": uuid::Uuid::new_v4().to_string(), "path": home, "name": "All my files", "all": "1" })); true
}
fn connected_summary() -> Value {
    let home = dirs::home_dir().map(|h| h.to_string_lossy().to_string()).unwrap_or_default();
    json!(connected_list().iter().map(|f| {
        let p = f["path"].as_str().unwrap_or(""); let here = std::path::Path::new(p).is_dir();
        let n = if here { std::fs::read_dir(p).into_iter().flatten().flatten().filter(|e| !e.file_name().to_string_lossy().starts_with('.')).count() } else { 0 };
        let shown = if !home.is_empty() && p.starts_with(&home) { format!("~{}", &p[home.len()..]) } else { p.to_string() };
        json!({ "id": f["id"], "name": f["name"], "path": shown, "abs": p, "missing": !here, "count": n, "all": f["all"] == "1" })
    }).collect::<Vec<_>>())
}
fn usage_summary() -> Value {
    let all: Vec<Value> = { let _g = USAGE_LOCK.lock().unwrap(); std::fs::read_to_string(support().join("usage.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default() };
    let now = chrono::Local::now(); let day = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_local_timezone(chrono::Local).single().map_or(0, |d| d.timestamp()) as f64;
    let week = now.timestamp() as f64 - 7.0 * 86400.0;
    let sum = |since: f64| { let xs: Vec<&Value> = all.iter().filter(|e| e[0].as_f64().unwrap_or(0.0) >= since).collect();
        let f = |i: usize| xs.iter().map(|e| e[i].as_f64().unwrap_or(0.0)).sum::<f64>(); json!({ "asks": xs.len(), "tokensIn": f(1), "tokensOut": f(2), "cost": f(3) }) };
    json!({ "today": sum(day), "week": sum(week), "all": sum(0.0), "since": all.first().and_then(|e| e[0].as_f64()).unwrap_or(0.0) })
}

// ---------- fonts on this computer, for the font menus ----------
fn fonts() -> Vec<String> {
    let mut db = fontdb::Database::new(); db.load_system_fonts();
    let mut names: Vec<String> = db.faces().flat_map(|f| f.families.iter().map(|(n, _)| n.clone())).filter(|n| !n.starts_with('.') && !n.starts_with('@')).collect();
    names.sort_by_key(|n| n.to_lowercase()); names.dedup(); names
}

// ---------- updates ----------
fn newer(a: &str, b: &str) -> bool {
    let p = |s: &str| s.trim_start_matches('v').split('.').map(|x| x.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
    let (x, y) = (p(a), p(b)); for i in 0..x.len().max(y.len()) { let (m, n) = (x.get(i).copied().unwrap_or(0), y.get(i).copied().unwrap_or(0)); if m != n { return m > n; } } false
}
const INSTALLER: &str = "Mochiboard-Setup.exe";
// test builds (made on the windows branch) look at a private feed instead of the public releases, with a build number to compare
const FEED: Option<&str> = option_env!("MB_UPDATE_FEED");
const BUILD: Option<&str> = option_env!("MB_BUILD");
async fn latest_release() -> Option<Value> {
    let api = std::env::var("MB_RELEASE_API").ok().or(FEED.map(String::from)).unwrap_or_else(|| "https://api.github.com/repos/jessawolfe-ux/mochiboard/releases/latest".into());
    client().get(api).header("Accept", "application/vnd.github+json").send().await.ok()?.json().await.ok()
}
fn installer_url(r: &Value) -> Option<String> {
    r.get("assets")?.as_array()?.iter().find(|x| x["name"].as_str() == Some(INSTALLER))?.get("browser_download_url")?.as_str().map(String::from)
}
async fn update_check() -> Value {
    let me = env!("CARGO_PKG_VERSION");
    let Some(r) = latest_release().await else { return json!({ "release": true, "offline": true, "since": me }) };
    let tag = r["tag_name"].as_str().unwrap_or("").to_string();
    let notes: Vec<String> = r["body"].as_str().unwrap_or("").lines().map(str::trim).filter(|l| l.starts_with("- ")).map(|l| l[2..].to_string()).collect();
    // only offer it once that release has a Windows installer
    let mine: u64 = BUILD.and_then(|b| b.parse().ok()).unwrap_or(0);
    let fresh = match (FEED, r.get("build").and_then(|b| b.as_u64())) { (Some(_), Some(b)) => b > mine, _ => newer(&tag, me) };
    let behind = if fresh && installer_url(&r).is_some() { 1 } else { 0 };
    json!({ "release": true, "behind": behind, "notes": notes, "since": if FEED.is_some() { format!("{me}, test build {}", BUILD.unwrap_or("?")) } else { me.to_string() }, "latest": if FEED.is_some() { format!("{tag} (test {})", r.get("build").and_then(|b| b.as_u64()).unwrap_or(0)) } else { tag } })
}
// download the new installer, start it, and step aside so it can replace this copy
async fn update_now(app: &tauri::AppHandle) -> Result<String, String> {
    let r = latest_release().await.ok_or("I couldn't reach GitHub just now.")?;
    let url = installer_url(&r).ok_or("The Windows version of this update isn't ready yet. Try again in a bit.")?;
    let bytes = client().get(url).timeout(Duration::from_secs(600)).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    let f = std::env::temp_dir().join(format!("mochiboard-update-{}.exe", uuid::Uuid::new_v4()));
    std::fs::write(&f, &bytes).map_err(|e| e.to_string())?;
    std::process::Command::new(&f).arg("/P").spawn().map_err(|e| e.to_string())?;   // /P: the installer's quiet mode, just a progress bar
    let h = app.clone(); tokio::spawn(async move { tokio::time::sleep(Duration::from_millis(400)).await; h.exit(0); });
    Ok("updating".into())
}

// ---------- videos no board points to anymore are cleared out after a couple of days (so undo still has them for a while) ----------
fn sweep_media() {
    let used: String = std::fs::read_dir(boards_dir()).into_iter().flatten().flatten().filter_map(|e| std::fs::read_to_string(e.path()).ok()).collect();
    let old = std::time::SystemTime::now() - Duration::from_secs(2 * 86400);
    for e in std::fs::read_dir(media_dir()).into_iter().flatten().flatten() {
        let n = e.file_name().to_string_lossy().to_string();
        if !used.contains(&n) && e.metadata().and_then(|m| m.modified()).map_or(false, |t| t < old) { let _ = std::fs::remove_file(e.path()); }
    }
}
// mbmedia://media/<name> (http://mbmedia.localhost/media/<name> on Windows): streams a saved video, with byte ranges so scrubbing works
fn media_response(req: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let name = req.uri().path().rsplit('/').next().unwrap_or("").to_string();
    let bad = |code: u16| http::Response::builder().status(code).header("Access-Control-Allow-Origin", "*").body(vec![]).unwrap();
    // /file/<path>: a video in one of their connected folders, played in place
    let f = if let Some(rest) = req.uri().path().strip_prefix("/file/") { let p = pct_decode(rest); if !inside_connected(&p) { return bad(403); } PathBuf::from(p) }
        else { if name.is_empty() || name.contains("..") { return bad(404); } media_dir().join(&name) }; let Ok(meta) = std::fs::metadata(&f) else { return bad(404) }; let size = meta.len(); if size == 0 { return bad(404); }
    let (mut start, mut end, mut partial) = (0u64, size - 1, false);
    if let Some(r) = req.headers().get("range").and_then(|v| v.to_str().ok()).and_then(|r| r.strip_prefix("bytes=")) {
        partial = true; let mut it = r.splitn(2, '-'); let (a, b) = (it.next().unwrap_or(""), it.next().unwrap_or(""));
        if a.is_empty() { if let Ok(n) = b.parse::<u64>() { start = size.saturating_sub(n); } } else { start = a.parse().unwrap_or(0); if let Ok(e) = b.parse::<u64>() { end = e.min(size - 1); } }
        end = end.min(start + 8 * 1024 * 1024 - 1).min(size - 1);   // hand it over in pieces of up to 8 MB
    }
    if start > end { return bad(416); }
    use std::io::{Read, Seek, SeekFrom};
    let mut buf = vec![0u8; (end - start + 1) as usize];
    let ok = std::fs::File::open(&f).and_then(|mut h| { h.seek(SeekFrom::Start(start))?; h.read_exact(&mut buf) }).is_ok(); if !ok { return bad(500); }
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    let mime = match ext.as_str() { "mp4" | "m4v" => "video/mp4", "mov" => "video/quicktime", "webm" => "video/webm", "jpg" => "image/jpeg", "png" => "image/png", _ => "application/octet-stream" };
    let mut r = http::Response::builder().status(if partial { 206 } else { 200 }).header("Content-Type", mime).header("Content-Length", buf.len().to_string())
        .header("Accept-Ranges", "bytes").header("Access-Control-Allow-Origin", "*").header("Access-Control-Expose-Headers", "Content-Range, Content-Length");
    if partial { r = r.header("Content-Range", format!("bytes {start}-{end}/{size}")); }
    r.body(buf).unwrap()
}

// Windows: let the board use the camera and microphone (for videos and voice memos), like the Mac app does.
// Only those two; Windows' own privacy switches still decide whether the app may use them at all.
#[cfg(windows)]
fn allow_media(w: &tauri::WebviewWindow) {
    let _ = w.with_webview(|wv| unsafe {
        use webview2_com::{Microsoft::Web::WebView2::Win32::*, PermissionRequestedEventHandler};
        let Ok(core) = wv.controller().CoreWebView2() else { return };
        let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
            if let Some(args) = args {
                let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                args.PermissionKind(&mut kind)?;
                if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA { args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?; }
            }
            Ok(())
        }));
        let mut token = 0i64;
        let _ = core.add_PermissionRequested(&handler, &mut token);
    });
}

fn main() {
    let _ = std::fs::create_dir_all(boards_dir()); let _ = std::fs::create_dir_all(media_dir());
    std::thread::spawn(sweep_media);
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("mbmedia", |_ctx, req, responder| { std::thread::spawn(move || responder.respond(media_response(req))); })
        .invoke_handler(tauri::generate_handler![mb])
        .setup(|app| {
            #[cfg(windows)] if let Some(w) = app.get_webview_window("main") { allow_media(&w); }
            if let Ok(js) = std::env::var("MB_SELFTEST").map(|p| std::fs::read_to_string(p).unwrap_or_default()) {
                let w = app.get_webview_window("main").unwrap();
                std::thread::spawn(move || { std::thread::sleep(Duration::from_secs(5)); let _ = w.eval(&js); });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Mochiboard couldn't start");
}
#[allow(dead_code)]
fn _unused(_: Map<String, Value>) {}

// ---------- folder cards, file cards and where boards are saved ----------
fn canon(p: &str) -> PathBuf { std::fs::canonicalize(p).unwrap_or_else(|_| PathBuf::from(p)) }
fn inside_connected(p: &str) -> bool { let want = canon(p); connected_list().iter().any(|f| f["path"].as_str().map_or(false, |r| want.starts_with(canon(r)))) }
fn secs(t: std::io::Result<std::time::SystemTime>) -> f64 { t.ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map_or(0.0, |d| d.as_secs_f64()) }
fn hidden(name: &str, meta: &std::fs::Metadata) -> bool {
    #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if meta.file_attributes() & 0x2 != 0 { return true; } }
    let _ = meta; name.starts_with('.') || name.eq_ignore_ascii_case("desktop.ini") || name.eq_ignore_ascii_case("thumbs.db")
}
fn list_folder(p: &str) -> Value {
    let Ok(rd) = std::fs::read_dir(p) else { return json!({ "missing": true, "items": [] }) };
    let mut out: Vec<Value> = rd.flatten().filter_map(|e| {
        let meta = e.metadata().ok()?; let name = e.file_name().to_string_lossy().to_string(); if hidden(&name, &meta) { return None; }
        let path = e.path(); let dir = meta.is_dir();
        Some(json!({ "name": name, "path": path.to_string_lossy(), "dir": dir, "ext": if dir { String::new() } else { path.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default() }, "size": meta.len(), "mod": secs(meta.modified()) }))
    }).collect();
    out.sort_by(|a, b| b["dir"].as_bool().cmp(&a["dir"].as_bool()).then_with(|| a["name"].as_str().unwrap_or("").to_lowercase().cmp(&b["name"].as_str().unwrap_or("").to_lowercase())));
    let total = out.len(); out.truncate(400);
    json!({ "missing": false, "total": total, "items": out })
}
fn file_info(p: &str) -> Value {
    match std::fs::metadata(p) { Ok(m) => json!({ "exists": true, "dir": m.is_dir(), "size": m.len(), "mod": secs(m.modified()), "kind": "" }), Err(_) => json!({ "exists": false }) }
}
fn library_home() -> Value {
    let r = root(); let n = std::fs::read_dir(r.join("boards")).into_iter().flatten().flatten().filter(|e| e.path().extension().map_or(false, |x| x == "json")).count();
    let home = dirs::home_dir().unwrap_or_default();
    let shown = match r.strip_prefix(&home) { Ok(rest) => format!("~{}{}", std::path::MAIN_SEPARATOR, rest.display()), Err(_) => r.display().to_string() };
    let missing = picked_root().filter(|p| !p.is_dir()).map(|p| json!(p.display().to_string())).unwrap_or(Value::Null);
    json!({ "path": shown, "custom": r != support(), "missing": missing, "count": n })
}
// copy every board, video and the library file into the new home, check they arrived, then clear the old copies (a newer board already there stays)
fn move_library(dest: &PathBuf) -> Result<(), String> {
    let from = root(); if canon(&dest.to_string_lossy()) == canon(&from.to_string_lossy()) { return Ok(()); }
    let modt = |p: &PathBuf| std::fs::metadata(p).and_then(|m| m.modified()).ok();
    let mut moved: Vec<(PathBuf, PathBuf)> = vec![];
    for sub in ["boards", "media"] {
        let (a, b) = (from.join(sub), dest.join(sub)); std::fs::create_dir_all(&b).map_err(|e| format!("I couldn't make a folder there: {e}"))?;
        for e in std::fs::read_dir(&a).into_iter().flatten().flatten() {
            let f = e.path(); let name = e.file_name(); let n = name.to_string_lossy(); if n.starts_with('.') || n.ends_with(".tmp") { continue; }
            let t = b.join(&name);
            if t.exists() { if modt(&t) >= modt(&f) { moved.push((f, t)); continue; } let _ = std::fs::remove_file(&t); }
            std::fs::copy(&f, &t).map_err(|e| format!("I couldn't copy {n}: {e}"))?; moved.push((f, t));
        }
    }
    let read = |p: PathBuf| { // the older list (folders only, saved before projects existed) counts too
        let v = std::fs::read_to_string(p).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()).unwrap_or(json!({}));
        match v { Value::Array(a) if !a.is_empty() => json!({ "projects": [], "folders": a }), Value::Object(_) => v, _ => json!({}) } };
    let (mine, theirs) = (read(from.join("folders.json")), read(dest.join("folders.json")));
    if mine.as_object().map_or(false, |m| !m.is_empty()) || theirs.as_object().map_or(false, |m| !m.is_empty()) {
        let mut merged = if theirs.is_object() { theirs.clone() } else { json!({}) };
        for key in ["projects", "folders"] {
            let b = mine[key].as_array().cloned().unwrap_or_default(); let ids: Vec<Value> = b.iter().map(|x| x["id"].clone()).collect();
            let mut list: Vec<Value> = theirs[key].as_array().cloned().unwrap_or_default().into_iter().filter(|x| !ids.contains(&x["id"])).collect(); list.extend(b);
            merged[key] = json!(list);
        }
        std::fs::write(dest.join("folders.json"), serde_json::to_vec(&merged).unwrap_or_default()).map_err(|_| "I couldn't write the library file there.".to_string())?;
    }
    if moved.iter().any(|(_, t)| !t.exists()) { return Err("Some boards didn't arrive, so I left everything where it was.".into()); }
    // only the app's own private folder is emptied; a picked folder (maybe shared with another computer) keeps its copies
    if canon(&from.to_string_lossy()) == canon(&support().to_string_lossy()) { for (f, _) in &moved { let _ = std::fs::remove_file(f); } let _ = std::fs::remove_file(from.join("folders.json")); }
    if canon(&dest.to_string_lossy()) == canon(&support().to_string_lossy()) { let _ = std::fs::remove_file(support().join("location.json")); }
    else { let _ = std::fs::write(support().join("location.json"), serde_json::to_vec(&json!({ "path": dest.to_string_lossy() })).unwrap_or_default()); }
    Ok(())
}

// ---------- a tiny web server for one folder, only reachable from this computer (127.0.0.1); same folder, same port; files are never cached ----------
static SERVERS: Mutex<Vec<(PathBuf, u16)>> = Mutex::new(Vec::new());
fn mime(ext: &str) -> &'static str {
    match ext { "html" | "htm" => "text/html; charset=utf-8", "js" | "mjs" => "text/javascript", "css" => "text/css", "json" => "application/json", "png" => "image/png", "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif", "webp" => "image/webp", "svg" => "image/svg+xml", "ico" => "image/x-icon", "mp3" => "audio/mpeg", "wav" => "audio/wav", "ogg" => "audio/ogg", "m4a" => "audio/mp4",
        "mp4" => "video/mp4", "webm" => "video/webm", "wasm" => "application/wasm", "glb" => "model/gltf-binary", "gltf" => "model/gltf+json", "txt" | "md" => "text/plain; charset=utf-8",
        "woff2" => "font/woff2", "woff" => "font/woff", "ttf" => "font/ttf", "otf" => "font/otf", "xml" => "application/xml", "csv" => "text/csv", _ => "application/octet-stream" }
}
async fn serve_file(path: &str, root: &str) -> Result<Value, String> {
    let f = PathBuf::from(path); if !f.exists() { return Err("I can’t find that file anymore. Was it moved or renamed?".into()); }
    if !inside_connected(path) { return Err("Connect the folder it lives in first, then press Play again ✦".into()); }   // only folders they chose are ever shared
    let mut r = f.parent().map(PathBuf::from).unwrap_or_default(); if !root.is_empty() && inside_connected(root) && f.starts_with(root) { r = PathBuf::from(root); }
    let rel: String = f.strip_prefix(&r).map(|p| p.components().map(|c| url_encode(&c.as_os_str().to_string_lossy())).collect::<Vec<_>>().join("/")).unwrap_or_default();
    if let Some((_, port)) = SERVERS.lock().unwrap().iter().find(|(p, _)| *p == r) { return Ok(json!(format!("http://localhost:{port}/{rel}"))); }
    let mut h: u32 = 2166136261; for b in r.to_string_lossy().bytes() { h = (h ^ b as u32).wrapping_mul(16777619); }
    let base = 8100 + (h % 800) as u16;
    for port in base..base + 24 {
        let Ok(l) = tokio::net::TcpListener::bind(("127.0.0.1", port)).await else { continue };
        { let mut list = SERVERS.lock().unwrap();   // another page from this folder got a server first while we were binding: use that one
          if let Some((_, p2)) = list.iter().find(|(p, _)| *p == r) { return Ok(json!(format!("http://localhost:{p2}/{rel}"))); }
          list.push((r.clone(), port)); }
        let root = r.clone();
        tokio::spawn(async move { loop { let Ok((sock, _)) = l.accept().await else { break }; let root = root.clone(); tokio::spawn(async move { let _ = answer(sock, root, port).await; }); } });
        return Ok(json!(format!("http://localhost:{port}/{rel}")));
    }
    Err("I couldn’t find a free port to run it on.".into())
}
async fn answer(mut sock: tokio::net::TcpStream, root: PathBuf, port: u16) -> std::io::Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buf = vec![]; let mut chunk = [0u8; 8192];
    loop { let n = sock.read(&mut chunk).await?; if n == 0 { return Ok(()); } buf.extend_from_slice(&chunk[..n]); if buf.windows(4).any(|w| w == b"\r\n\r\n") || buf.len() > 1_000_000 { break; } }
    let head = String::from_utf8_lossy(&buf).to_string(); let mut lines = head.split("\r\n"); let first: Vec<&str> = lines.next().unwrap_or("").split(' ').collect();
    let send = |status: &str, ctype: &str, body: Vec<u8>, extra: String| format!("HTTP/1.1 {status}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\n{extra}\r\n", body.len()).into_bytes().into_iter().chain(body).collect::<Vec<u8>>();
    if first.len() < 2 || (first[0] != "GET" && first[0] != "HEAD") { return sock.write_all(&send("405 Method Not Allowed", "text/plain", vec![], String::new())).await; }
    // only pages on this computer asking by its local name; a website pretending to be localhost (DNS rebinding) is turned away
    let host = head.split("\r\n").find(|l| l.to_lowercase().starts_with("host:")).map(|l| l[5..].trim().to_lowercase()).unwrap_or_default();
    if host != format!("localhost:{port}") && host != format!("127.0.0.1:{port}") { return sock.write_all(&send("403 Forbidden", "text/plain", vec![], String::new())).await; }
    let mut rel = url_decode(first[1].split('?').next().unwrap_or("/")); if rel.ends_with('/') { rel.push_str("index.html"); }
    // each piece must be a plain name: no "..", no drive letters or backslashes that would jump out of the folder on Windows
    let mut f = root.clone(); for part in rel.split('/').filter(|p| !p.is_empty()) {
        if part == ".." || part.contains(':') || part.contains('\\') || std::path::Path::new(part).is_absolute() { return sock.write_all(&send("404 Not Found", "text/plain", b"Not found".to_vec(), String::new())).await; }
        f.push(part); }
    if !canon(&f.to_string_lossy()).starts_with(canon(&root.to_string_lossy())) { return sock.write_all(&send("404 Not Found", "text/plain", b"Not found".to_vec(), String::new())).await; }
    if f.is_dir() { f.push("index.html"); }
    let Ok(data) = tokio::fs::read(&f).await else { return sock.write_all(&send("404 Not Found", "text/plain", format!("Not found: {rel}").into_bytes(), String::new())).await };
    let ctype = mime(&f.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default()); let size = data.len();
    if let Some(r) = lines.find(|l| l.to_lowercase().starts_with("range: bytes=")) {
        let spec = &r[13..]; let (a, b) = spec.split_once('-').unwrap_or((spec, ""));
        let (start, end) = if a.trim().is_empty() { (size.saturating_sub(b.trim().parse().unwrap_or(0)), size.saturating_sub(1)) } else { (a.trim().parse().unwrap_or(0), b.trim().parse().unwrap_or(size.saturating_sub(1)).min(size.saturating_sub(1))) };
        let body = if start <= end && start < size { data[start..=end].to_vec() } else { vec![] };
        let extra = format!("Content-Range: bytes {start}-{}/{size}\r\n", start + body.len().saturating_sub(1));
        return sock.write_all(&send("206 Partial Content", ctype, if first[0] == "HEAD" { vec![] } else { body }, extra)).await;
    }
    sock.write_all(&send("200 OK", ctype, if first[0] == "HEAD" { vec![] } else { data }, String::new())).await
}
fn url_decode(s: &str) -> String { let b = s.as_bytes(); let mut out = vec![]; let mut i = 0;
    while i < b.len() { if b[i] == b'%' && i + 2 < b.len() { if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) { out.push(v); i += 3; continue; } } out.push(b[i]); i += 1; }
    String::from_utf8_lossy(&out).to_string() }
fn url_encode(s: &str) -> String { s.bytes().map(|c| if c.is_ascii_alphanumeric() || b"-._~!$&'()*+,;=@".contains(&c) { (c as char).to_string() } else { format!("%{c:02X}") }).collect() }
fn pct_decode(s: &str) -> String { let b = s.as_bytes(); let mut out = vec![]; let mut i = 0; while i < b.len() { if b[i] == b'%' && i + 2 < b.len() + 0 && i + 2 <= b.len() - 1 { if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) { out.push(v); i += 3; continue; } } out.push(b[i]); i += 1; }
    let t = String::from_utf8_lossy(&out).to_string(); if cfg!(windows) { t.replace('/', "\\") } else if t.starts_with('/') { t } else { format!("/{t}") } }
