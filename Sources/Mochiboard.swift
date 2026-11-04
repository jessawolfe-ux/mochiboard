// Mochiboard: a Mac app around the canvas in web/. Swift handles what a web page can't:
// saving boards as files, fetching link previews, and asking Mochi (Claude Code, run locally with `claude -p`).
import AppKit
import UniformTypeIdentifiers
import Speech
import Vision
import CoreImage
@preconcurrency import WebKit

let isBeta = [".beta", ".testing"].contains { (Bundle.main.bundleIdentifier ?? "").hasSuffix($0) }   // the in-progress build, with its own boards folder
let support = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/" + (isBeta ? "Mochiboard Testing" : "Mochiboard"))
let boardsDir = support.appendingPathComponent("boards")
let mediaDir = support.appendingPathComponent("media", isDirectory: true)   // videos live here as their own files; boards just point at them
final class MediaScheme: NSObject, WKURLSchemeHandler {
    static func mime(_ ext: String) -> String { ["mp4": "video/mp4", "m4v": "video/mp4", "mov": "video/quicktime", "webm": "video/webm", "jpg": "image/jpeg", "png": "image/png"][ext.lowercased()] ?? "application/octet-stream" }
    func webView(_ w: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let name = url.lastPathComponent, f = mediaDir.appendingPathComponent(name)
        guard !name.isEmpty, !name.contains(".."), let size = (try? FileManager.default.attributesOfItem(atPath: f.path)[.size] as? NSNumber)?.int64Value, size > 0,
              let h = try? FileHandle(forReadingFrom: f) else { return task.didFailWithError(NSError(domain: "Mochiboard", code: 404)) }
        defer { try? h.close() }
        var start: Int64 = 0, end: Int64 = size - 1, partial = false
        if let r = task.request.value(forHTTPHeaderField: "Range"), r.hasPrefix("bytes=") {
            let p = r.dropFirst(6).split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false).map(String.init); partial = true
            if p[0].isEmpty, p.count > 1, let n = Int64(p[1]) { start = max(0, size - n) }   // "bytes=-500": the last 500
            else { start = Int64(p[0]) ?? 0; if p.count > 1, let e = Int64(p[1]) { end = min(e, size - 1) } }
        }
        guard start <= end else { return task.didFailWithError(NSError(domain: "Mochiboard", code: 416)) }
        try? h.seek(toOffset: UInt64(start)); let data = h.readData(ofLength: Int(end - start + 1))
        var head = ["Content-Type": MediaScheme.mime(f.pathExtension), "Content-Length": "\(data.count)", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*"]
        if partial { head["Content-Range"] = "bytes \(start)-\(start + Int64(data.count) - 1)/\(size)" }
        task.didReceive(HTTPURLResponse(url: url, statusCode: partial ? 206 : 200, httpVersion: "HTTP/1.1", headerFields: head)!)
        task.didReceive(data); task.didFinish()
    }
    func webView(_ w: WKWebView, stop task: WKURLSchemeTask) {}
}

// JSON can't hold "not a number" or infinity, and writing one throws (which quits the app), so swap them for 0 first
func jsonSafe(_ v: Any) -> Any {
    if let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), !n.doubleValue.isFinite { return 0 }
    if let d = v as? [String: Any] { return d.mapValues(jsonSafe) }
    if let a = v as? [Any] { return a.map(jsonSafe) }
    return v
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var popups: [NSWindow] = []   // pop-up windows pages open (like Spotify's sign-in)
    // watch the boards folder: a board added from outside (Claude Code, a copied file) shows up without a restart
    var boardsWatch: DispatchSourceFileSystemObject?, boardNames = Set<String>(), boardsTick: DispatchWorkItem?
    func boardFiles() -> Set<String> { Set(((try? FileManager.default.contentsOfDirectory(atPath: boardsDir.path)) ?? []).filter { $0.hasSuffix(".json") }) }
    func watchBoards() {
        boardNames = boardFiles()
        let fd = open(boardsDir.path, O_EVTONLY); guard fd >= 0 else { return }
        let src = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: .write, queue: .main)
        src.setEventHandler { [weak self] in
            guard let self = self else { return }
            self.boardsTick?.cancel()
            let t = DispatchWorkItem { [weak self] in   // our own saves rewrite files too, so only speak up when boards come or go
                guard let self = self else { return }
                let now = self.boardFiles(); if now == self.boardNames { return }
                self.boardNames = now; self.web.evaluateJavaScript("window.__boardsChanged && __boardsChanged()")
            }
            self.boardsTick = t; DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: t)
        }
        src.setCancelHandler { close(fd) }; src.resume(); boardsWatch = src
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        try? FileManager.default.createDirectory(at: boardsDir, withIntermediateDirectories: true)
        buildMenu()
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "mb")
        config.setURLSchemeHandler(MediaScheme(), forURLScheme: "mbmedia")
        try? FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true); DispatchQueue.global(qos: .utility).async { self.sweepMedia() }
        // tell the page it's in the app (it makes room for the window buttons)
        config.userContentController.addUserScript(WKUserScript(source: "document.documentElement.classList.add('native')" + (isBeta ? "; document.documentElement.classList.add('beta')" : ""), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")   // the page can read its own files (Mochi's music loads into memory to loop perfectly); WebKit still limits it to the app's web folder
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.titlebarAppearsTransparent = true; window.titleVisibility = .hidden; window.title = isBeta ? "Mochiboard Testing" : "Mochiboard"
        window.backgroundColor = NSColor(red: 0.984, green: 0.973, blue: 0.988, alpha: 1)
        window.minSize = NSSize(width: 380, height: 520)   // narrow enough to sit beside other apps; below 700 wide it switches to the phone layout
        let host = NSView(); window.contentView = host
        web.frame = host.bounds; web.autoresizingMask = [.width, .height]; host.addSubview(web)
        // a strip at the top of the sidebar to drag the window by (the page fills the whole window, title bar included)
        let strip = DragStrip(frame: NSRect(x: 76, y: host.bounds.height - 40, width: 156, height: 40)); strip.autoresizingMask = [.minYMargin]; host.addSubview(strip)
        window.center(); window.setFrameAutosaveName(isBeta ? "Mochiboard Testing" : "Mochiboard")
        let page = Bundle.main.resourceURL!.appendingPathComponent("web/index.html")
        web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        watchBoards()
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

    // links on the board open in the browser, not inside the app
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = a.request.url, a.navigationType == .linkActivated, u.scheme?.hasPrefix("http") == true { NSWorkspace.shared.open(u); decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }

    // MARK: messages from the page: {id, op, args}; answered with __mbReply(id, ok, value)
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let body = m.body as? [String: Any], let id = body["id"] as? Int, let op = body["op"] as? String else { return }
        let args = body["args"] as? [String: Any] ?? [:]
        let reply: (Bool, Any) -> Void = { [weak self] ok, value in
            let json = (try? JSONSerialization.data(withJSONObject: [jsonSafe(value)], options: [.fragmentsAllowed])).flatMap { String(data: $0, encoding: .utf8) } ?? "[null]"
            DispatchQueue.main.async { self?.web.evaluateJavaScript("__mbReply(\(id), \(ok), \(json)[0])") }
        }
        switch op {
        case "usage": reply(true, usageSummary())
        case "version": reply(true, appVersion)
        case "resetUsage": usageLock.lock(); try? FileManager.default.removeItem(at: usageFile); usageLock.unlock(); reply(true, true)
        case "list":
            let files = (try? FileManager.default.contentsOfDirectory(at: boardsDir, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
            let list: [[String: Any]] = files.filter { $0.pathExtension == "json" }.compactMap { f in
                guard let d = try? Data(contentsOf: f), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return nil }
                let mod = (try? f.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                return ["id": j["id"] ?? "", "name": j["name"] ?? "Untitled", "color": j["color"] ?? "pink", "folder": j["folder"] ?? NSNull(), "parent": j["parent"] ?? NSNull(), "updated": mod.timeIntervalSince1970]
            }.sorted { ($0["updated"] as! Double) > ($1["updated"] as! Double) }
            reply(true, list)
        case "load":
            let f = boardsDir.appendingPathComponent("\(safe(args["id"])).json")
            if let d = try? Data(contentsOf: f), let j = try? JSONSerialization.jsonObject(with: d) { reply(true, j) } else { reply(true, NSNull()) }
        case "save":
            guard let b = args["board"] as? [String: Any], let d = try? JSONSerialization.data(withJSONObject: jsonSafe(b)) else { return reply(false, "bad board") }
            let f = boardsDir.appendingPathComponent("\(safe(b["id"])).json"), tmp = f.appendingPathExtension("tmp")
            do { try d.write(to: tmp); _ = try? FileManager.default.removeItem(at: f); try FileManager.default.moveItem(at: tmp, to: f); reply(true, true) } catch { reply(false, error.localizedDescription) }
        // folders live in one small file next to the boards: [{id, name, open}]
        case "folders":
            let f = support.appendingPathComponent("folders.json")
            if let d = try? Data(contentsOf: f), let j = try? JSONSerialization.jsonObject(with: d) { reply(true, j) } else { reply(true, [Any]()) }
        case "saveFolders":
            guard let d = try? JSONSerialization.data(withJSONObject: jsonSafe(args["folders"] ?? [])) else { return reply(false, "bad folders") }
            do { try d.write(to: support.appendingPathComponent("folders.json"), options: .atomic); reply(true, true) } catch { reply(false, error.localizedDescription) }
        case "remove":
            try? FileManager.default.removeItem(at: boardsDir.appendingPathComponent("\(safe(args["id"])).json")); reply(true, true)
        case "linkPreview":
            linkPreview(args["url"] as? String ?? "") { reply(true, $0) }
        case "linkShot":
            LinkShot(args["url"] as? String ?? "", window: self.window) { reply($0 != nil, $0 ?? "no screenshot") }
        case "ask":
            askMochi(args["prompt"] as? String ?? "", args["board"] ?? [:], confirmed: args["confirmed"] as? Bool ?? false, mobbin: args["mobbin"] as? Bool ?? true, higgs: args["higgs"] as? Bool ?? true) { ok, text in reply(ok, text) }
        case "rewrite":
            rewriteText(args["text"] as? String ?? "", how: args["how"] as? String ?? "", title: args["title"] as? String ?? "", around: args["around"] as? String ?? "") { ok, text in reply(ok, text) }
        case "connections":
            connections { reply(true, $0) }
        case "removeBg": removeBackground(args["src"] as? String ?? "") { reply($0, $1) }
        case "fetchImage":
            fetchImage(args["url"] as? String ?? "") { reply($0 != nil, $0 ?? "couldn't load that image") }
        // export what's on screen inside a rectangle as a crisp PNG or a real PDF, then let the person pick where to save it
        case "export":
            let r = CGRect(x: args["x"] as? Double ?? 0, y: args["y"] as? Double ?? 0, width: max(1, args["w"] as? Double ?? 1), height: max(1, args["h"] as? Double ?? 1))
            let pdf = args["pdf"] as? Bool ?? false, name = (args["name"] as? String ?? "Mochiboard").replacingOccurrences(of: "/", with: "-"), scale = args["scale"] as? Double ?? 2
            let finish: (Data?) -> Void = { [weak self] data in
                DispatchQueue.main.async {
                    guard let self, let data else { return reply(false, "I couldn't capture that") }
                    let panel = NSSavePanel(); panel.nameFieldStringValue = name + (pdf ? ".pdf" : ".png"); panel.allowedContentTypes = [pdf ? .pdf : .png]
                    panel.beginSheetModal(for: self.window) { resp in
                        guard resp == .OK, let u = panel.url else { return reply(true, "") }
                        do { try data.write(to: u); reply(true, u.lastPathComponent) } catch { reply(false, error.localizedDescription) }
                    }
                }
            }
            if pdf { let cfg = WKPDFConfiguration(); cfg.rect = r; web.createPDF(configuration: cfg) { finish(try? $0.get()) } }
            else {
                let alpha = args["alpha"] as? Bool ?? false
                let snap: (@escaping (NSImage?) -> Void) -> Void = { [weak web] done in
                    guard let web else { return done(nil) }
                    let cfg = WKSnapshotConfiguration(); cfg.rect = r; cfg.snapshotWidth = NSNumber(value: min(r.width * scale, 8000))
                    web.takeSnapshot(with: cfg) { img, _ in done(img) }
                }
                if !alpha {
                    snap { img in
                        guard let img, let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return finish(nil) }
                        finish(NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:]))
                    }
                } else {
                    // a transparent PNG from an opaque web view: the same pixels on white and on black differ by exactly (1 − alpha)
                    snap { [weak web] white in
                        guard let web else { return finish(nil) }
                        web.evaluateJavaScript("document.body.classList.add('exp-black')") { _, _ in
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                                snap { black in
                                    web.evaluateJavaScript("document.body.classList.remove('exp-black')", completionHandler: nil)
                                    guard let white, let black else { return finish(nil) }
                                    finish(alphaPNG(white: white, black: black))
                                }
                            }
                        }
                    }
                }
            }
        // save a file the page made (a Word doc): ask where, then write it
        case "saveFile":
            let name = (args["name"] as? String ?? "Document").replacingOccurrences(of: "/", with: "-"), ext = args["ext"] as? String ?? "docx"
            guard let b64 = args["data"] as? String, let data = Data(base64Encoded: b64) else { reply(false, "Nothing to save"); break }
            let panel = NSSavePanel(); panel.nameFieldStringValue = name + "." + ext
            if let t = UTType(filenameExtension: ext) { panel.allowedContentTypes = [t] }
            panel.beginSheetModal(for: window) { resp in
                guard resp == .OK, let u = panel.url else { return reply(true, "") }
                do { try data.write(to: u); reply(true, u.lastPathComponent) } catch { reply(false, error.localizedDescription) }
            }
        // a doc as a real, paged PDF: ask where to save it, then let macOS's print engine lay the pages out (proper page breaks, sharp selectable text)
        case "docPDF":
            let html = args["html"] as? String ?? "", name = (args["name"] as? String ?? "Document").replacingOccurrences(of: "/", with: "-")
            let paper = (args["paper"] as? String) == "a4" ? NSSize(width: 595.28, height: 841.89) : NSSize(width: 612, height: 792)
            let panel = NSSavePanel(); panel.nameFieldStringValue = name + ".pdf"; panel.allowedContentTypes = [.pdf]
            panel.beginSheetModal(for: window) { [weak self] resp in
                guard let self, resp == .OK, let u = panel.url else { return reply(true, "") }
                DocPrinter(html: html, to: u, paper: paper, window: self.window) { ok, msg in reply(ok, msg) }
            }
        // Higgsfield, two steps: look up the price and balance (never generates), then generate (only called after the person taps yes)
        case "higgsQuote":
            runClaude("""
            Use the Higgsfield tools ONLY to look things up. Do NOT generate anything. Find my current credit balance, and the credit cost to generate ONE image with the \(args["model"] as? String ?? "nano_banana_2") model at standard quality.
            Reply with ONLY one JSON object, no other words: {"balance": number, "perImage": number, "model": "the model's name"}. If you can't find a number, use null for it.
            """, tools: ["mcp__claude_ai_higgsfield__balance", "mcp__claude_ai_higgsfield__models_explore", "mcp__claude_ai_higgsfield__show_plans_and_credits"], timeout: 180) { ok, t in reply(ok, t) }
        case "higgsMake":
            let jobs = (try? JSONSerialization.data(withJSONObject: jsonSafe(args["images"] ?? []))).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            runClaude("""
            The person has CONFIRMED spending Higgsfield credits on these images for a website/app mockup. Generate exactly one image for each item, using the \(args["model"] as? String ?? "nano_banana_2") model, \
            with the aspect ratio given (or the closest one the model supports). Write a vivid, specific prompt from each item's "label" and the shared "style" (\(args["style"] as? String ?? "clean, modern, natural light")). \
            No text or logos inside the images. Use one batch if you can, then wait for the jobs to finish.
            Items: \(jobs)
            Reply with ONLY one JSON object, no other words: {"images": [{"id": "the item's id", "url": "the finished image's direct url"}]}
            """, tools: ["mcp__claude_ai_higgsfield__generate_image_batch", "mcp__claude_ai_higgsfield__generate_image", "mcp__claude_ai_higgsfield__jobs_wait", "mcp__claude_ai_higgsfield__models_explore", "mcp__claude_ai_higgsfield__show_generation_by_ids"], timeout: 1200) { ok, t in reply(ok, t) }
        // no Higgsfield? Claude can still draw simple flat illustrations as SVG (free, no credits)
        case "drawFill":
            let jobs = (try? JSONSerialization.data(withJSONObject: jsonSafe(args["images"] ?? []))).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            runClaude("""
            Draw a simple, friendly flat illustration as SVG for each item below (for a website/app mockup). Style: \(args["style"] as? String ?? "soft pastel, rounded shapes, minimal") . \
            Each SVG must use viewBox "0 0 W H" matching the item's w and h, fill the whole frame with a background, use only basic shapes and paths, no text, no external images, under 3500 characters.
            Items: \(jobs)
            Reply with ONLY one JSON object, no other words: {"images": [{"id": "the item's id", "svg": "<svg ...>...</svg>"}]}
            """, tools: [], timeout: 600) { ok, t in reply(ok, t) }
        case "fonts":
            reply(true, NSFontManager.shared.availableFontFamilies.filter { !$0.hasPrefix(".") }.sorted())
        case "speechAuth":
            SFSpeechRecognizer.requestAuthorization { st in reply(true, st == .authorized ? "ok" : st == .notDetermined ? "ask" : "off") }
        case "transcribe":
            transcribe(args["audio"] as? String ?? "") { ok, text in reply(ok, text) }
        // updates: the installer records where the repo lives; check GitHub for new commits, and update with one tap
        case "mediaBegin":
            let ext = String((args["ext"] as? String ?? "mp4").filter { $0.isLetter || $0.isNumber }.prefix(5)), name = UUID().uuidString.lowercased() + "." + (ext.isEmpty ? "mp4" : ext)
            FileManager.default.createFile(atPath: mediaDir.appendingPathComponent(name).path, contents: nil); reply(true, name)
        case "mediaChunk":
            let name = (args["name"] as? String ?? "").replacingOccurrences(of: "/", with: ""), f = mediaDir.appendingPathComponent(name)
            guard !name.isEmpty, let d = Data(base64Encoded: args["data"] as? String ?? ""), let h = try? FileHandle(forWritingTo: f) else { return reply(false, "I couldn't save that video.") }
            h.seekToEndOfFile(); h.write(d); try? h.close(); reply(true, true)
        case "mediaEnd":
            reply(true, "mbmedia://media/" + (args["name"] as? String ?? "").replacingOccurrences(of: "/", with: ""))
        case "updateCheck":
            // a preview of the update bar for testing: defaults write io.github.jessawolfe-ux.mochiboard previewUpdate -bool YES
            if UserDefaults.standard.bool(forKey: "previewUpdate") {
                return reply(true, ["release": true, "behind": 1, "latest": "v1.4.0", "since": appVersion, "preview": true,
                                    "notes": ["Widgets: choose what shows on each board", "A Start recording button for voice memos", "Dot grids in little shapes: hearts, crosses and more"]])
            }
            checkForUpdate { reply(true, $0) }
        case "updatePrepare":   // automatic updates: download and unpack the new version now, swap it in when Mochiboard quits
            if UserDefaults.standard.bool(forKey: "previewUpdate") { return reply(true, "preview") }
            if repoDir != nil { return reply(false, "This copy updates from its folder, so it can't update by itself.") }
            prepareUpdate { ok, msg in reply(ok, msg) }
        case "updateNow":
            if UserDefaults.standard.bool(forKey: "previewUpdate") { return reply(false, "This is just a preview, so nothing changed ✦") }
            startUpdate { ok, msg in reply(ok, msg) }
        case "reveal":
            NSWorkspace.shared.activateFileViewerSelecting([boardsDir]); reply(true, true)
        case "openURL":
            if let u = URL(string: args["url"] as? String ?? "") { NSWorkspace.shared.open(u) }; reply(true, true)
        default: reply(false, "unknown op \(op)")
        }
    }
    func safe(_ v: Any?) -> String { String(describing: v ?? "x").filter { $0.isLetter || $0.isNumber || $0 == "-" } }

    // MARK: link previews: the page's title, description and image (og: tags)
    func linkPreview(_ s: String, done: @escaping ([String: String]) -> Void) {
        guard let url = URL(string: s) else { return done(["title": s, "desc": s, "image": ""]) }
        var req = URLRequest(url: url, timeoutInterval: 10)
        req.setValue("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Mochiboard", forHTTPHeaderField: "User-Agent")
        URLSession.shared.dataTask(with: req) { data, _, _ in
            let html = String(data: (data ?? Data()).prefix(400_000), encoding: .utf8) ?? String(decoding: (data ?? Data()).prefix(400_000), as: UTF8.self)
            func meta(_ keys: [String]) -> String? {
                for k in keys {
                    for pat in ["<meta[^>]+(?:property|name)=[\"']\(k)[\"'][^>]+content=[\"']([^\"']*)[\"']", "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+(?:property|name)=[\"']\(k)[\"']"] {
                        if let r = html.range(of: pat, options: [.regularExpression, .caseInsensitive]) {
                            let tag = String(html[r]); if let c = tag.range(of: "content=[\"']([^\"']*)", options: .regularExpression) { return String(tag[c].dropFirst(9)) }
                        }
                    }
                }
                return nil
            }
            var title = meta(["og:title", "twitter:title"]) ?? ""
            if title.isEmpty, let r = html.range(of: "<title[^>]*>([^<]*)</title>", options: [.regularExpression, .caseInsensitive]) { title = String(html[r]).replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression) }
            var image = meta(["og:image", "twitter:image"]) ?? ""
            if !image.isEmpty, let abs = URL(string: image, relativeTo: url) { image = abs.absoluteString }
            let decode = { (s: String) in s.replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&quot;", with: "\"").trimmingCharacters(in: .whitespacesAndNewlines) }
            done(["title": decode(title.isEmpty ? (url.host ?? s) : title), "desc": decode(meta(["og:description", "description"]) ?? (url.host ?? s)), "image": image])
        }.resume()
    }

    // MARK: Mochi: asks Claude Code on this Mac (`claude -p`), which answers with JSON actions for the canvas
    // where Claude Code lives. Looked up again whenever it's missing, so installing it while Mochiboard is open just works (no restart)
    var foundClaude: String?
    var claudePath: String? {
        if let c = foundClaude, FileManager.default.isExecutableFile(atPath: c) { return c }
        foundClaude = findClaude(); return foundClaude
    }
    func findClaude() -> String? {
        let fm = FileManager.default, home = NSHomeDirectory()
        // the usual homes first: the official installer, the older local install, Homebrew, npm / nvm / volta / bun
        var spots = ["\(home)/.local/bin/claude", "\(home)/.claude/local/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude",
                     "\(home)/.npm-global/bin/claude", "\(home)/.volta/bin/claude", "\(home)/.bun/bin/claude"]
        if let vs = try? fm.contentsOfDirectory(atPath: "\(home)/.nvm/versions/node") { spots += vs.sorted().reversed().map { "\(home)/.nvm/versions/node/\($0)/bin/claude" } }
        if let hit = spots.first(where: { fm.isExecutableFile(atPath: $0) }) { return hit }
        // anywhere else the person's own shell knows about (their .zshrc included), with a time limit in case the shell is slow
        for args in [["-lc", "command -v claude"], ["-lic", "command -v claude"]] {
            let p = Process(), out = Pipe(); p.executableURL = URL(fileURLWithPath: "/bin/zsh"); p.arguments = args
            p.standardOutput = out; p.standardError = Pipe(); p.standardInput = FileHandle.nullDevice
            do { try p.run() } catch { continue }
            let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }; DispatchQueue.global().asyncAfter(deadline: .now() + 6, execute: killer)
            let d = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit(); killer.cancel()
            let path = (String(data: d, encoding: .utf8) ?? "").split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.last { $0.hasPrefix("/") }
            if let path, fm.isExecutableFile(atPath: path) { return path }
        }
        return nil
    }
    // which helpers Mochi can use: Claude Code itself, and the Mobbin / Higgsfield connections in the person's Claude account
    func connections(done: @escaping ([String: Any]) -> Void) {
        guard let claude = claudePath else { return done(["claude": false, "mobbin": false, "higgsfield": false]) }
        DispatchQueue.global().async {
            // Claude checks every connection live, and one can blip for a moment, so a helper that's in the list but not "connected" gets one more look
            func look() -> [Substring] {
                let p = Process(), out = Pipe(); p.executableURL = URL(fileURLWithPath: claude); p.arguments = ["mcp", "list"]
                p.currentDirectoryURL = support; p.standardOutput = out; p.standardError = FileHandle.nullDevice; p.standardInput = FileHandle.nullDevice
                try? p.run(); let d = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit()
                return (String(data: d, encoding: .utf8) ?? "").lowercased().split(separator: "\n")
            }
            var lines = look()
            let ok = { (name: String) in lines.contains { $0.contains(name) && $0.contains("connected") && !$0.contains("needs") } }
            let listed = { (name: String) in lines.contains { $0.contains(name) && !$0.contains("needs") } }
            if (listed("mobbin") && !ok("mobbin")) || (listed("higgsfield") && !ok("higgsfield")) { Thread.sleep(forTimeInterval: 1.5); lines = look() }
            done(["claude": true, "mobbin": ok("mobbin"), "higgsfield": ok("higgsfield")])
        }
    }
    // pictures from Mobbin or Higgsfield come in as links; bring them home as data, so they're saved with the board
    // lift the subject out of a picture: macOS's own Vision model finds it, nothing leaves the Mac. Answers a PNG data URL with a see-through background.
    func removeBackground(_ src: String, _ done: @escaping (Bool, Any) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard #available(macOS 14.0, *) else { return done(false, "needs macOS 14") }
            var data: Data? = nil
            if src.hasPrefix("data:"), let comma = src.firstIndex(of: ",") { data = Data(base64Encoded: String(src[src.index(after: comma)...]), options: .ignoreUnknownCharacters) }
            else if src.hasPrefix("/") { data = try? Data(contentsOf: URL(fileURLWithPath: src)) }
            else if let u = URL(string: src), u.isFileURL { data = try? Data(contentsOf: u) }
            guard let d = data, let ns = NSImage(data: d), let cg = ns.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return done(false, "couldn't read that picture") }
            do {
                let req = VNGenerateForegroundInstanceMaskRequest(), handler = VNImageRequestHandler(cgImage: cg, options: [:])
                try handler.perform([req])
                guard let r = req.results?.first, !r.allInstances.isEmpty else { return done(false, "no subject") }
                let pb = try r.generateMaskedImage(ofInstances: r.allInstances, from: handler, croppedToInstancesExtent: false)
                let ci = CIImage(cvPixelBuffer: pb)
                guard let out = CIContext().createCGImage(ci, from: ci.extent), let png = NSBitmapImageRep(cgImage: out).representation(using: .png, properties: [:]) else { return done(false, "couldn't make the cut-out") }
                done(true, "data:image/png;base64," + png.base64EncodedString())
            } catch { done(false, "couldn't lift the subject out: \(error.localizedDescription)") }
        }
    }
    func fetchImage(_ s: String, done: @escaping (String?) -> Void) {
        guard let url = URL(string: s) else { return done(nil) }
        URLSession.shared.dataTask(with: URLRequest(url: url, timeoutInterval: 30)) { data, resp, _ in
            guard let data, data.count > 200 else { return done(nil) }
            let type = (resp as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type") ?? "image/jpeg"
            done("data:\(type.split(separator: ";").first ?? "image/jpeg");base64,\(data.base64EncodedString())")
        }.resume()
    }
    func askMochi(_ request: String, _ board: Any, confirmed: Bool, mobbin: Bool, higgs: Bool, done: @escaping (Bool, String) -> Void) {
        guard let claude = claudePath else { return done(false, "I need Claude Code to think. Set it up from mochiboard.app/connect.html, then try again.") }
        let boardJSON = (try? JSONSerialization.data(withJSONObject: jsonSafe(board))).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let prompt = """
        You are Mochi, a cute, warm little pixel goo who lives on a creative planning canvas app called Mochiboard. \
        You help designers and creative people plan: you add cards, sort ideas into groups, make moodboard plans and checklists, and spot what's missing.

        The person asked you: \(request)

        Here is their board as JSON. Positions are in pixels (x grows right, y grows down). A note card is about 220 x 140, a checklist about 240 x 180, a color swatch 120 x 150, a title is one line of big text. \
        "unsorted" holds ideas waiting in the side tray, not yet on the board. Cards marked "selected" are what they have selected right now. Follow "mochiStyle" in the board JSON for your tone. "recentChat" is your conversation so far on this board: use it to understand follow-ups like "now make them pink". \
        When they say "this", "these" or "it", they mean the selected cards. They can ask you to change ANY words, labels, colors or list items on any card, \
        including cards you made: use "edit" for that (only send the fields that change), and "remove" only when they ask to delete something.
        \(boardJSON)

        Reply with ONLY one JSON object, no other words before or after it. Use only the keys you need:
        {"say": "a short, friendly reply in first person (1 to 3 sentences, no em dashes)",
         "next": ["2 or 3 things they might want next, written as short requests they can tap (under 6 words each, e.g. 'Make the mobile version'), specific to what you just did"],
         "add": [{"type": "note" | "todo" | "title" | "swatch" | "doc" | "font", "text": "... (a doc's title)", "items": ["for todo"], "hex": "#rrggbb for swatch", "label": "swatch name",
                  "color": "white|pink|butter|mint|lilac|sky|peach", "x": 0, "y": 0, "tag": "optional tiny handwritten label", "body": "for a doc: its full text",
                  "name": "optional bold name above a note's words", "in": "optional: a collection id, or the name of a collection in this reply, to stack it inside"}],
         "titles": [{"text": "group name", "x": 0, "y": 0}],
         "collections": [{"name": "Loading", "color": "white|pink|butter|mint|lilac|sky|peach", "x": 0, "y": 0}],
         "screens": [{"name": "Log in", "device": "iPhone|Android|iPad|Desktop", "note": "1 to 2 sentences: what this screen is and what it does",
                      "items": [{"piece": "Nav bar", "title": "Sign in"}, {"piece": "Heading", "text": "Welcome back", "sub": "Log in to continue"},
                                {"piece": "Input", "label": "Email", "text": "you@example.com"}, {"piece": "Button", "text": "Log in"}, {"piece": "Tab bar", "tabs": [["home", "Home"], ["person_outline", "Profile"]]}]}],
         "move": [{"id": "existing card id", "x": 0, "y": 0, "color": "optional new color"}],
         "edit": [{"id": "existing card id", "text": "new words (a note, title, list heading, or a link's title)", "items": ["the full new list, for a todo"], "desc": "a link's note",
                   "color": "white|pink|butter|mint|lilac|sky|peach", "tag": "the little handwritten label above a card (\"\" removes it)", "hex": "#rrggbb", "label": "swatch name",
                   "name": "a note's bold name", "in": "a collection id to move it into (null takes it out)", "size": "text size: s|m|l|xl", "bold": true, "italic": false, "under": false, "strike": false}],
         "remove": ["card id"],
         "place": [{"id": "an unsorted card id", "x": 0, "y": 0}],
         "connect": [["card id", "card id"]],
         "projects": {"create": ["project name"], "rename": [{"from": "old name", "to": "new name"}]},
         "folders": {"create": [{"name": "folder name", "project": "project name or null"}], "rename": [{"from": "old folder name", "to": "new name"}],
                     "file": [{"folder": "folder name", "project": "project name, or null to take it out of its project"}],
                     "move": [{"board": "board id", "folder": "folder name, or null to take it out of its folder"}]}}
        "library" is their whole Mochiboard: projects hold folders, folders hold boards. Use "projects"/"folders" when they ask to organize, group, file or move boards, folders or projects. \
        Moving a board into a folder that doesn't exist yet creates it; filing a folder into a project that doesn't exist yet creates the project. Never invent board ids: only use ids from "library".
        A "coll" card is a COLLECTION: a named column whose "kids" stack inside it automatically (you never position its kids). \
        Prefer collections for grouping (screen states, themes, steps): make them with "collections" and put cards in with "in". \
        WIREFRAMES: when they ask for wireframes, screens, mockups, a flow or an app layout, ALWAYS use "screens" (real wireframe pieces the app lays out for you), not notes. \
        List each screen's pieces top to bottom; the app stacks them, puts "Nav bar" at the top and "Tab bar" at the bottom, and draws arrows between screens in order. \
        Pieces and their words: "Nav bar" {title, icon}, "Tab bar" {tabs: [[material_icon_name, label]], active}, "Heading" {text, sub, align}, "Text" {text, size, weight, align}, \
        "Input" {label, text}, "Search" {text}, "Button" {text, style: "primary"|"secondary"}, "Card" {title, text}, "List row" {title, sub, icon} (use "rows": [{title, sub}] for several), \
        "Toggle" {text, on}, "Checkbox" {text, on}, "Avatar" {size, align}, "Image" {h, img: "what picture goes here"}, "Icon" {name, size, align}, "Divider", "Space" {h}. Icons are Material Icons names (home, search, settings, favorite_border, person_outline, notifications_none, shopping_bag, add, close). \
        WEBSITES: for a website or landing page use ONE screen with "device": "Desktop" and full-width sections top to bottom: "Header" {logo, links, cta}, "Hero" {title, text, cta, cta2, img}, \
        "Logos" {title}, "Features" {title, items: [{icon, title, text}]}, "Stats" {items: [{value, label}]}, "Testimonials" {title, items: [{quote, name}]}, "Gallery" {title, imgs: ["label", ...]}, \
        "Pricing" {title, plans: [{name, price, features: [...], cta}]}, "CTA" {title, text, cta}, "Footer" {logo, text, cols: [["Heading", ["link", ...]]]}. A full page is usually 6 to 9 sections. \
        IMAGES: every "img"/"imgs" value is a short, vivid description of the photo that belongs there (e.g. "a dog walker laughing with a golden retriever in a sunny park"); the app shows it as a labeled placeholder the person can fill later. \
        LOOK: add "theme" to a screen to style it: {"bg": "#hex", "text": "#hex", "muted": "#hex", "primary": "#hex", "onPrimary": "#hex", "surface": "#hex", "font": "font family", "headFont": "font family"}. \
        Use the board's saved colors ("styles.colors") when there are some, fonts from "fontsOnThisMac" or Google Fonts, and leave "theme" out when they ask for plain or gray wireframes. \
        Use real, specific words for the product (not "Lorem"). Put the explanation of each screen in its "note" (that becomes a note under the screen); don't also add separate notes for them. \
        FONTS: when they ask to explore, compare or suggest fonts or type, add "font" cards ({"type": "font", "font": "exact family name", "sample": "a short line in their product's voice", "tag": "why it fits, 2 to 4 words"}), never plain notes with font names. \
        Prefer families in "fontsOnThisMac"; you may also suggest Google Fonts by their exact name (the app loads them). A good exploration is 4 to 8 fonts, grouped by mood with titles. \
        When you organize, lay groups out as tidy columns about 250 px apart with a title 90 px above each group, and keep new things clear of cards you are not moving. \
        Keep note text short (under 20 words). Never invent ids: only use ids from the board.

        You may also have two design helpers (only if their tools are available to you\(mobbin ? "" : "; Mobbin is TURNED OFF by the person, never use it")\(higgs ? "" : "; Higgsfield is TURNED OFF by the person, never generate images or suggest it")):
        - Mobbin (real app screenshots): when they ask for UI references, inspiration or examples of screens or flows, search Mobbin and return the best 4 to 8 \
        as "images": [{"url": "the screen image url", "caption": "App name · what the screen is", "x": 0, "y": 0}].
        - Higgsfield (image generation, costs the person credits): \(confirmed
            ? "they have CONFIRMED. Generate what they asked for with Higgsfield (one image unless they asked for more; use the nano_banana_2 model), wait for it to finish, and return it in \"images\" with a short caption."
            : "they have NOT confirmed spending credits yet. Do NOT generate. If their request needs a generated image, describe in \"say\" what you would make and that it uses a few Higgsfield credits, and add \"confirm\": \"a 2 to 5 word label for the button\". Everything else in the request you can still do now.")
        If a helper isn't available, say so kindly in "say" and suggest connecting it in Mochiboard's sidebar.
        """
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process(), out = Pipe(), err = Pipe()
            p.executableURL = URL(fileURLWithPath: claude)
            // only the helpers the person has switched on in Settings
            var tools = mobbin ? ["mcp__claude_ai_Mobbin__search_screens", "mcp__claude_ai_Mobbin__search_flows", "mcp__claude_ai_Mobbin__search_sections"] : []
            // the generator is only switched on after the person taps "yes" in the app: spending credits needs their say-so
            if confirmed && higgs { tools += ["mcp__claude_ai_higgsfield__generate_image", "mcp__claude_ai_higgsfield__generate_image_batch", "mcp__claude_ai_higgsfield__jobs_wait", "mcp__claude_ai_higgsfield__models_explore", "mcp__claude_ai_higgsfield__show_generation_by_ids"] }   // Claude usually reaches for generate_image (one picture); without it, the yes led nowhere
            p.arguments = ["-p", prompt, "--output-format", "json"] + (tools.isEmpty ? [] : ["--allowedTools", tools.joined(separator: ",")])
            p.currentDirectoryURL = support
            var env = ProcessInfo.processInfo.environment; env["PATH"] = (env["PATH"] ?? "") + ":/opt/homebrew/bin:/usr/local/bin:" + NSString(string: "~/.local/bin").expandingTildeInPath
            p.environment = env; p.standardOutput = out; p.standardError = err; p.standardInput = FileHandle.nullDevice
            do { try p.run() } catch { return done(false, error.localizedDescription) }
            let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }
            DispatchQueue.global().asyncAfter(deadline: .now() + 300, execute: killer)
            let data = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit(); killer.cancel()
            let text = self.claudeResult(data)
            // a failed answer (not signed in, no plan…) comes back as an error, not as words for Mochi to read
            if ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["is_error"] as? Bool == true { return done(false, String(text.prefix(300))) }
            if p.terminationStatus != 0 && text.isEmpty {
                let e = String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "Claude Code didn't answer"
                return done(false, String(e.prefix(300)))
            }
            done(true, text)
        }
    }

    // Mochi in a doc: rewrite just the selected words ("shorter", "friendlier", or anything typed) and hand back only the new words
    func rewriteText(_ text: String, how: String, title: String, around: String, done: @escaping (Bool, String) -> Void) {
        guard let claude = claudePath else { return done(false, "I need Claude Code to think. Set it up from mochiboard.app/connect.html, then try again.") }
        let prompt = """
        You are Mochi, a warm little helper inside a document editor. Rewrite the selected text from the person's document "\(title.isEmpty ? "Untitled" : title)".

        What they want: \(how)

        Selected text:
        <<<
        \(text)
        >>>

        A little of the text around it, only for context (do not rewrite this):
        <<<
        \(String(around.prefix(1500)))
        >>>

        Rules: keep their meaning, facts, names and numbers (never invent new facts). Keep their voice unless they asked to change it. Keep roughly the same shape (one paragraph stays one paragraph; a list stays a list, one item per line starting with "- "). \
        Reply with ONLY the rewritten text: no quotes around it, no intro, no explanation, no markdown headings.
        """
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process(), out = Pipe(), err = Pipe()
            p.executableURL = URL(fileURLWithPath: claude)
            p.arguments = ["-p", prompt, "--output-format", "json"]
            p.currentDirectoryURL = support
            var env = ProcessInfo.processInfo.environment; env["PATH"] = (env["PATH"] ?? "") + ":/opt/homebrew/bin:/usr/local/bin:" + NSString(string: "~/.local/bin").expandingTildeInPath
            p.environment = env; p.standardOutput = out; p.standardError = err; p.standardInput = FileHandle.nullDevice
            do { try p.run() } catch { return done(false, error.localizedDescription) }
            let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }; DispatchQueue.global().asyncAfter(deadline: .now() + 180, execute: killer)
            let data = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit(); killer.cancel()
            let text = self.claudeResult(data)
            if ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["is_error"] as? Bool == true { return done(false, String(text.prefix(300))) }
            if p.terminationStatus != 0 && text.isEmpty { return done(false, String((String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "Claude Code didn't answer").prefix(300))) }
            done(true, text.trimmingCharacters(in: .whitespacesAndNewlines))
        }
    }

    // MARK: Claude usage: Claude Code reports what each request used; Mochi keeps a small tally on this Mac (usage.json)
    var usageFile: URL { support.appendingPathComponent("usage.json") }
    let usageLock = NSLock()
    // reads Claude Code's JSON answer: notes the usage, hands back just the words
    func claudeResult(_ data: Data) -> String {
        guard let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let result = j["result"] as? String else { return String(data: data, encoding: .utf8) ?? "" }
        let u = j["usage"] as? [String: Any] ?? [:]
        let n = { (k: String) in (u[k] as? NSNumber)?.intValue ?? 0 }
        let entry: [Any] = [Date().timeIntervalSince1970, n("input_tokens") + n("cache_creation_input_tokens") + n("cache_read_input_tokens"), n("output_tokens"), (j["total_cost_usd"] as? NSNumber)?.doubleValue ?? 0]
        usageLock.lock(); defer { usageLock.unlock() }
        var all = ((try? Data(contentsOf: usageFile)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [[Any]] }) ?? []
        all.append(entry); if all.count > 5000 { all.removeFirst(all.count - 5000) }
        if let d = try? JSONSerialization.data(withJSONObject: all) { try? d.write(to: usageFile) }
        return result
    }
    // today, the last 7 days and everything: asks, tokens (in, including the context Claude re-reads, and out) and the pay-per-request estimate
    func usageSummary() -> [String: Any] {
        usageLock.lock(); let all = ((try? Data(contentsOf: usageFile)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [[Any]] }) ?? []; usageLock.unlock()
        let now = Date(), day = Calendar.current.startOfDay(for: now).timeIntervalSince1970, week = now.timeIntervalSince1970 - 7 * 86400
        func sum(_ since: Double) -> [String: Any] {
            let xs = all.filter { (($0.first as? NSNumber)?.doubleValue ?? 0) >= since }
            let f = { (i: Int) in xs.reduce(0.0) { $0 + ((($1.count > i ? $1[i] : 0) as? NSNumber)?.doubleValue ?? 0) } }
            return ["asks": xs.count, "tokensIn": f(1), "tokensOut": f(2), "cost": f(3)]
        }
        return ["today": sum(day), "week": sum(week), "all": sum(0), "since": (all.first?.first as? NSNumber)?.doubleValue ?? 0]
    }

    // MARK: updates
    // the folder the app was built from (written into Info.plist by install.sh), if it's still a git checkout
    var repoDir: String? {
        guard let p = Bundle.main.object(forInfoDictionaryKey: "MBRepo") as? String, FileManager.default.fileExists(atPath: p + "/.git") else { return nil }
        return p
    }
    @discardableResult func git(_ args: [String], in dir: String, timeout: Double = 30) -> (ok: Bool, out: String) {
        let p = Process(), out = Pipe(); p.executableURL = URL(fileURLWithPath: "/usr/bin/git"); p.arguments = ["-C", dir] + args
        p.standardOutput = out; p.standardError = Pipe(); p.standardInput = FileHandle.nullDevice
        var env = ProcessInfo.processInfo.environment; env["GIT_TERMINAL_PROMPT"] = "0"; p.environment = env
        do { try p.run() } catch { return (false, "") }
        let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }; DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: killer)
        let d = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit(); killer.cancel()
        return (p.terminationStatus == 0, (String(data: d, encoding: .utf8) ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
    }
    // downloaded copies (no git folder) update from GitHub Releases instead
    let releaseAPI = ProcessInfo.processInfo.environment["MB_RELEASE_API"] ?? "https://api.github.com/repos/jessawolfe-ux/mochiboard/releases/latest"   // the override is only for testing updates
    var appVersion: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0" }
    func newer(_ a: String, than b: String) -> Bool {
        let x = a.trimmingCharacters(in: CharacterSet(charactersIn: "v")).split(separator: ".").map { Int($0) ?? 0 }, y = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(x.count, y.count) { let p = i < x.count ? x[i] : 0, q = i < y.count ? y[i] : 0; if p != q { return p > q } }
        return false
    }
    func latestRelease(done: @escaping ([String: Any]?) -> Void) {
        var req = URLRequest(url: URL(string: releaseAPI)!, timeoutInterval: 30); req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        URLSession.shared.dataTask(with: req) { d, _, _ in done(d.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }) }.resume()
    }
    func checkForUpdate(done: @escaping ([String: Any]) -> Void) {
        guard let dir = repoDir else {
            return latestRelease { r in
                guard let r, let tag = r["tag_name"] as? String else { return done(["release": true, "offline": true, "since": self.appVersion]) }
                let notes = (r["body"] as? String ?? "").split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { $0.hasPrefix("- ") }.map { String($0.dropFirst(2)) }
                done(["release": true, "behind": self.newer(tag, than: self.appVersion) ? 1 : 0, "notes": notes, "since": self.appVersion, "latest": tag])
            }
        }
        DispatchQueue.global().async {
            let here = self.git(["log", "-1", "--format=%cs"], in: dir).out
            guard self.git(["fetch", "--quiet", "origin"], in: dir, timeout: 40).ok else { return done(["repo": true, "offline": true, "since": here]) }
            let behind = Int(self.git(["rev-list", "--count", "HEAD..@{u}"], in: dir).out) ?? 0
            // the friendly notes: lines added to WHATSNEW.md since this copy
            let diff = self.git(["diff", "HEAD", "@{u}", "--", "WHATSNEW.md"], in: dir).out
            let notes = diff.split(separator: "\n").filter { $0.hasPrefix("+- ") }.map { String($0.dropFirst(3)) }
            done(["repo": true, "behind": behind, "notes": notes, "since": here])
        }
    }
    // a downloaded copy: fetch the new zip, unpack it, and swap it in after this one quits
    func updateFromRelease(done: @escaping (Bool, String) -> Void) {
        latestRelease { r in
            guard let assets = r?["assets"] as? [[String: Any]], let url = assets.first(where: { ($0["name"] as? String) == "Mochiboard.zip" })?["browser_download_url"] as? String, let u = URL(string: url) else { return done(false, "I couldn't find the new version on GitHub. Try again in a bit.") }
            URLSession.shared.downloadTask(with: u) { file, _, err in
                guard let file else { return done(false, err?.localizedDescription ?? "The download didn't finish.") }
                let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("mochiboard-update-\(UUID().uuidString)")
                try? FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
                let zip = tmp.appendingPathComponent("Mochiboard.zip"); try? FileManager.default.moveItem(at: file, to: zip)
                let unzip = Process(); unzip.executableURL = URL(fileURLWithPath: "/usr/bin/ditto"); unzip.arguments = ["-x", "-k", zip.path, tmp.path]
                try? unzip.run(); unzip.waitUntilExit()
                let fresh = tmp.appendingPathComponent("Mochiboard.app").path
                guard FileManager.default.fileExists(atPath: fresh + "/Contents/MacOS/Mochiboard") else { return done(false, "The new version didn't unpack properly.") }
                let app = Bundle.main.bundlePath
                let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/bash")
                p.arguments = ["-c", "nohup bash -c 'sleep 1.5; rm -rf \"$1\" && /usr/bin/ditto \"$0\" \"$1\" && xattr -dr com.apple.quarantine \"$1\"; open \"$1\"' \"$0\" \"$1\" >/dev/null 2>&1 &", fresh, app]
                do { try p.run(); p.waitUntilExit() } catch { return done(false, error.localizedDescription) }
                done(true, "updating")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { NSApp.terminate(nil) }
            }.resume()
        }
    }
    // videos no board points to anymore (deleted cards, replaced recordings) are cleared out after a couple of days, so undo still has them for a while
    func sweepMedia() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: mediaDir, includingPropertiesForKeys: [.contentModificationDateKey]), !files.isEmpty else { return }
        var used = ""; for b in (try? fm.contentsOfDirectory(at: boardsDir, includingPropertiesForKeys: nil)) ?? [] where b.pathExtension == "json" { used += (try? String(contentsOf: b, encoding: .utf8)) ?? "" }
        let old = Date().addingTimeInterval(-2 * 86400)
        for f in files where !used.contains(f.lastPathComponent) {
            if let d = try? f.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, d < old { try? fm.removeItem(at: f) }
        }
    }
    // ---- automatic updates: the new version waits here until Mochiboard quits ----
    var pendingDir: URL { support.appendingPathComponent("pending-update", isDirectory: true) }
    var pendingApp: URL { pendingDir.appendingPathComponent("Mochiboard.app", isDirectory: true) }
    func version(of app: URL) -> String? { (NSDictionary(contentsOf: app.appendingPathComponent("Contents/Info.plist")) as? [String: Any])?["CFBundleShortVersionString"] as? String }
    func prepareUpdate(done: @escaping (Bool, String) -> Void) {
        latestRelease { r in
            guard let r, let tag = r["tag_name"] as? String else { return done(false, "I couldn't reach GitHub just now.") }
            if let v = self.version(of: self.pendingApp), !self.newer(tag, than: v) { return done(true, v) }   // already waiting
            guard let assets = r["assets"] as? [[String: Any]], let url = assets.first(where: { ($0["name"] as? String) == "Mochiboard.zip" })?["browser_download_url"] as? String, let u = URL(string: url) else { return done(false, "The new version isn't there yet.") }
            URLSession.shared.downloadTask(with: u) { file, _, err in
                guard let file else { return done(false, err?.localizedDescription ?? "The download didn't finish.") }
                let fm = FileManager.default, tmp = fm.temporaryDirectory.appendingPathComponent("mochiboard-pending-\(UUID().uuidString)")
                try? fm.createDirectory(at: tmp, withIntermediateDirectories: true)
                let zip = tmp.appendingPathComponent("Mochiboard.zip"); try? fm.moveItem(at: file, to: zip)
                let unzip = Process(); unzip.executableURL = URL(fileURLWithPath: "/usr/bin/ditto"); unzip.arguments = ["-x", "-k", zip.path, tmp.path]
                try? unzip.run(); unzip.waitUntilExit()
                let fresh = tmp.appendingPathComponent("Mochiboard.app")
                guard fm.fileExists(atPath: fresh.path + "/Contents/MacOS/Mochiboard") else { return done(false, "The new version didn't unpack properly.") }
                try? fm.removeItem(at: self.pendingDir); try? fm.createDirectory(at: self.pendingDir, withIntermediateDirectories: true)
                do { try fm.moveItem(at: fresh, to: self.pendingApp) } catch { return done(false, error.localizedDescription) }
                try? fm.removeItem(at: tmp)
                done(true, self.version(of: self.pendingApp) ?? tag)
            }.resume()
        }
    }
    // on quit: if a newer version is waiting, a tiny helper swaps it in once this app has fully closed (it doesn't reopen; the next launch is just newer)
    func applicationWillTerminate(_ n: Notification) {
        guard repoDir == nil, let v = version(of: pendingApp) else { return }
        if !newer(v, than: appVersion) { try? FileManager.default.removeItem(at: pendingDir); return }
        let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/bash")
        p.arguments = ["-c", "nohup bash -c 'while kill -0 \"$2\" 2>/dev/null; do sleep 0.3; done; rm -rf \"$1\" && /usr/bin/ditto \"$0\" \"$1\" && xattr -dr com.apple.quarantine \"$1\"; rm -rf \"$3\"' \"$0\" \"$1\" \"$2\" \"$3\" >/dev/null 2>&1 &",
                       pendingApp.path, Bundle.main.bundlePath, String(ProcessInfo.processInfo.processIdentifier), pendingDir.path]
        try? p.run(); p.waitUntilExit()
    }
    func startUpdate(done: @escaping (Bool, String) -> Void) {
        guard let dir = repoDir else { return updateFromRelease(done: done) }
        DispatchQueue.global().async {
            // only a clean fast-forward: never touch someone's own changes
            if !self.git(["status", "--porcelain", "--untracked-files=no"], in: dir).out.isEmpty { return done(false, "Your Mochiboard folder has changes of its own, so I won't update over them. Run ./install.sh --update in Terminal to see what's up.") }
            if !self.git(["merge-base", "--is-ancestor", "HEAD", "@{u}"], in: dir).ok { return done(false, "This copy has gone its own way from GitHub, so I'll leave it alone.") }
            // the installer pulls, rebuilds and reopens the app; it runs on its own so it can quit this one
            let log = support.appendingPathComponent("update.log").path
            let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/bash")
            p.arguments = ["-c", "cd \"$0\" && nohup ./install.sh --update > \"$1\" 2>&1 &", dir, log]
            do { try p.run(); p.waitUntilExit(); done(true, "updating") } catch { done(false, error.localizedDescription) }
        }
    }

    // run Claude Code with a prompt and a short list of allowed tools; replies with its text
    func runClaude(_ prompt: String, tools: [String], timeout: Double, done: @escaping (Bool, String) -> Void) {
        guard let claude = claudePath else { return done(false, "I need Claude Code to do that.") }
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process(), out = Pipe(), err = Pipe()
            p.executableURL = URL(fileURLWithPath: claude)
            p.arguments = ["-p", prompt, "--output-format", "json"] + (tools.isEmpty ? [] : ["--allowedTools", tools.joined(separator: ",")])
            p.currentDirectoryURL = support
            var env = ProcessInfo.processInfo.environment; env["PATH"] = (env["PATH"] ?? "") + ":/opt/homebrew/bin:/usr/local/bin:" + NSString(string: "~/.local/bin").expandingTildeInPath
            p.environment = env; p.standardOutput = out; p.standardError = err; p.standardInput = FileHandle.nullDevice
            do { try p.run() } catch { return done(false, error.localizedDescription) }
            let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: killer)
            let data = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit(); killer.cancel()
            let text = self.claudeResult(data)
            // a failed answer (not signed in, no plan…) comes back as an error, not as words for Mochi to read
            if ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["is_error"] as? Bool == true { return done(false, String(text.prefix(300))) }
            if p.terminationStatus != 0 && text.isEmpty { return done(false, String((String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "Claude Code didn't answer").prefix(300))) }
            done(true, text)
        }
    }

    // MARK: menus (Edit is what makes copy, paste and undo work in the text)
    func buildMenu() {
        let main = NSMenu()
        let app = NSMenuItem(); main.addItem(app); let am = NSMenu(); app.submenu = am
        am.addItem(withTitle: "About Mochiboard", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        am.addItem(.separator()); am.addItem(withTitle: "Hide Mochiboard", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        am.addItem(withTitle: "Quit Mochiboard", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let edit = NSMenuItem(); main.addItem(edit); let em = NSMenu(title: "Edit"); edit.submenu = em
        em.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        em.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        em.addItem(.separator())
        em.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        em.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        em.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        em.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let win = NSMenuItem(); main.addItem(win); let wm = NSMenu(title: "Window"); win.submenu = wm
        wm.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        wm.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        NSApp.mainMenu = main; NSApp.windowsMenu = wm
    }
}

// Prints a doc's HTML into a PDF file on real pages. It renders in its own hidden web view (so the doc on screen is untouched),
// waits for fonts and pictures, then runs a print operation that saves to the chosen file instead of a printer.
// MARK: link screenshots: the page rendered off screen in its own web view, handed back as a small JPEG
final class LinkShot: NSObject, WKNavigationDelegate {
    static var live: [LinkShot] = []
    let view: WKWebView, done: (String?) -> Void
    var finished = false
    @discardableResult init(_ s: String, window: NSWindow, done: @escaping (String?) -> Void) {
        let cfg = WKWebViewConfiguration(); cfg.websiteDataStore = .nonPersistent()   // no cookies kept, nothing shared with the board's own web view
        view = WKWebView(frame: NSRect(x: -10000, y: 0, width: 1280, height: 800), configuration: cfg)
        self.done = done
        super.init()
        view.navigationDelegate = self; view.alphaValue = 0
        view.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
        window.contentView?.addSubview(view)   // it needs to be in a window to render; it sits off screen and invisible
        LinkShot.live.append(self)
        guard let url = URL(string: s), ["http", "https"].contains(url.scheme ?? "") else { finish(nil); return }
        view.load(URLRequest(url: url, timeoutInterval: 12))
        DispatchQueue.main.asyncAfter(deadline: .now() + 14) { [weak self] in self?.snap() }   // a slow page still gets a shot of whatever has arrived
    }
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { self.snap() } }   // a moment for fonts, pictures and the first animations
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { snap() }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { finish(nil) }
    func snap() {
        guard !finished else { return }
        let c = WKSnapshotConfiguration(); c.rect = view.bounds; c.snapshotWidth = 640   // boards stay light: a 640-wide JPEG is about 100–200 KB
        view.takeSnapshot(with: c) { img, _ in
            guard let img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let jpg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.72]) else { return self.finish(nil) }
            self.finish("data:image/jpeg;base64," + jpg.base64EncodedString())
        }
    }
    func finish(_ v: String?) { guard !finished else { return }; finished = true; view.removeFromSuperview(); LinkShot.live.removeAll { $0 === self }; done(v) }
}

final class DocPrinter: NSObject, WKNavigationDelegate {
    static var live: [DocPrinter] = []
    let view: WKWebView, url: URL, paper: NSSize, window: NSWindow, done: (Bool, String) -> Void
    var tmp: URL?
    @discardableResult init(html: String, to url: URL, paper: NSSize, window: NSWindow, done: @escaping (Bool, String) -> Void) {
        let w = paper.width * 96 / 72   // CSS pixels across the page
        view = WKWebView(frame: NSRect(x: -10000, y: 0, width: w, height: 1200))
        self.url = url; self.paper = paper; self.window = window; self.done = done
        super.init()
        view.navigationDelegate = self; view.alphaValue = 0
        window.contentView?.addSubview(view)   // printing needs the view in a window; it sits off screen and invisible
        DocPrinter.live.append(self)
        // the doc points at the app's own fonts ("__WEB__/fonts/…"); it loads from a file so it's allowed to read them
        let web = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
        let file = support.appendingPathComponent("print-\(UUID().uuidString).html")
        try? html.replacingOccurrences(of: "__WEB__/", with: web.absoluteString).write(to: file, atomically: true, encoding: .utf8)
        tmp = file
        view.loadFileURL(file, allowingReadAccessTo: URL(fileURLWithPath: "/"))
    }
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
        // give web fonts and pictures a moment to arrive, then print
        w.evaluateJavaScript("document.fonts ? document.fonts.ready.then(() => 1) : 1") { _, _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { self.printNow() }
        }
    }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { finish(false, e.localizedDescription) }
    func printNow() {
        let info = NSPrintInfo(dictionary: [NSPrintInfo.AttributeKey.jobSavingURL: url])
        info.jobDisposition = .save; info.paperSize = paper
        info.topMargin = 58; info.bottomMargin = 61; info.leftMargin = 61; info.rightMargin = 61   // about 0.8in top, 0.85in sides and bottom (WebKit's print ignores CSS page margins)
        info.horizontalPagination = .fit; info.verticalPagination = .automatic
        info.isHorizontallyCentered = false; info.isVerticallyCentered = false
        let op = view.printOperation(with: info)
        op.showsPrintPanel = false; op.showsProgressPanel = false
        op.view?.frame = view.bounds
        op.runModal(for: window, delegate: self, didRun: #selector(printed(_:success:contextInfo:)), contextInfo: nil)
    }
    @objc func printed(_ op: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
        // printing reports back on a background thread; views may only be touched on the main one
        DispatchQueue.main.async {
            let saved = FileManager.default.fileExists(atPath: self.url.path)   // the file is the truth (the success flag can come back false even when it saved)
            self.finish(saved, saved ? self.url.lastPathComponent : "The PDF didn't save")
        }
    }
    func finish(_ ok: Bool, _ msg: String) { view.removeFromSuperview(); if let tmp { try? FileManager.default.removeItem(at: tmp) }; done(ok, msg); DocPrinter.live.removeAll { $0 === self } }
}

final class DragStrip: NSView {
    override func mouseDown(with e: NSEvent) { window?.performDrag(with: e) }
    override func mouseUp(with e: NSEvent) { if e.clickCount == 2 { window?.performZoom(nil) } }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()

// the image button's file picker (a web page can't open one inside the app on its own)
extension AppDelegate {
    // the microphone, for voice memos (macOS asks the person once)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)   // the microphone for voice memos, the camera for video cards (macOS still asks the person once)
    }
    // voice memo → words, using Apple's speech recognition on this Mac (on-device when the Mac supports it)
    func transcribe(_ dataURL: String, done: @escaping (Bool, String) -> Void) {
        guard let comma = dataURL.firstIndex(of: ","), let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else { return done(false, "couldn't read that recording") }
        let ext = dataURL.contains("audio/webm") ? "webm" : dataURL.contains("audio/wav") ? "wav" : "m4a"
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("mochiboard-memo-\(UUID().uuidString).\(ext)")
        do { try data.write(to: file) } catch { return done(false, "couldn't save the recording") }
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { return done(false, "Speech recognition is off. Turn it on for Mochiboard in System Settings → Privacy & Security → Speech Recognition.") }
            guard let rec = SFSpeechRecognizer(), rec.isAvailable else { return done(false, "Speech recognition isn't available right now") }
            let req = SFSpeechURLRecognitionRequest(url: file); req.shouldReportPartialResults = false
            if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
            var finished = false
            rec.recognitionTask(with: req) { result, error in
                if finished { return }
                if let result, result.isFinal { finished = true; try? FileManager.default.removeItem(at: file); done(true, result.bestTranscription.formattedString) }
                else if let error { finished = true; try? FileManager.default.removeItem(at: file); done(false, error.localizedDescription) }
            }
        }
    }
    // pop-up windows a page asks for (like Spotify's sign-in): a real little window that shares cookies with the board, so signing in sticks
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let w = CGFloat(truncating: windowFeatures.width ?? 520), h = CGFloat(truncating: windowFeatures.height ?? 720)
        let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: max(380, w), height: max(480, h)), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        let pv = WKWebView(frame: win.contentView!.bounds, configuration: configuration); pv.autoresizingMask = [.width, .height]; pv.uiDelegate = self
        win.contentView = pv; win.title = action.request.url?.host ?? "Mochiboard"; win.isReleasedWhenClosed = false; win.center(); win.makeKeyAndOrderFront(nil)
        popups.append(win); return pv
    }
    func webViewDidClose(_ webView: WKWebView) { popups.removeAll { w in if w.contentView === webView { w.close(); return true }; return false } }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = parameters.allowsMultipleSelection; panel.canChooseDirectories = false
        panel.allowedContentTypes = [.image]
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }
}

// two snapshots of the same pixels, one over white and one over black: alpha = 1 − (white − black), and the black one is already the premultiplied color
func alphaPNG(white: NSImage, black: NSImage) -> Data? {
    guard let cw = white.cgImage(forProposedRect: nil, context: nil, hints: nil), let cb = black.cgImage(forProposedRect: nil, context: nil, hints: nil), cw.width == cb.width, cw.height == cb.height else { return nil }
    let w = cw.width, h = cw.height, n = w * h * 4, space = CGColorSpaceCreateDeviceRGB()
    let info = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    func bytes(_ img: CGImage) -> [UInt8]? {
        var buf = [UInt8](repeating: 0, count: n)
        let ok: Bool = buf.withUnsafeMutableBytes { raw in
            guard let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: space, bitmapInfo: info) else { return false }
            ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h)); return true
        }
        return ok ? buf : nil
    }
    guard let W = bytes(cw), var B = bytes(cb) else { return nil }
    var i = 0
    while i < n {
        let d = (Int(W[i]) - Int(B[i]) + Int(W[i + 1]) - Int(B[i + 1]) + Int(W[i + 2]) - Int(B[i + 2])) / 3
        B[i + 3] = UInt8(max(0, min(255, 255 - d))); i += 4
    }
    guard let prov = CGDataProvider(data: Data(B) as CFData),
          let out = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4, space: space, bitmapInfo: CGBitmapInfo(rawValue: info), provider: prov, decode: nil, shouldInterpolate: true, intent: .defaultIntent) else { return nil }
    return NSBitmapImageRep(cgImage: out).representation(using: .png, properties: [:])
}
