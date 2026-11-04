<p align="center"><img src="assets/icon.png" width="140" alt="Mochiboard"></p>

<h1 align="center">Mochiboard™</h1>
<p align="center"><b>A cozy planning canvas for your Mac, with Mochi inside.</b></p>
<p align="center"><img src="assets/readme-cover.jpg" width="720" alt="A drawing of Mochiboard: someone asks Mochi for a landing page and she builds it"></p>

---

Mochiboard™ is a free, open-source Mac and Windows app for the messy part before you open your design tools. Drop notes, pictures, links, checklists and colors on an endless board, arrange them however makes sense to *you*, and ask Mochi (a tiny pixel goo who thinks with Claude Code) to sort, plan, explore and build.

**See it in action:** [jessa.art/mochiboard](https://jessa.art/#mochiboard.html)

## What's inside

**The canvas**
- 🗺️ Infinite board. Pan with two fingers, pinch to zoom, cards tilt a little like real paper (or sit straight, your call).
- 🗒️ Notes, titles, checklists, docs, collections, links, images (with crop), voice memos that write themselves out, colors that name themselves, shapes, stamps, drawing, and curvy connectors.
- 🧠 ADHD-friendly: **⌘K** drops an idea into **Unsorted** without losing your place, and **F** focuses on just what you're working on.
- 📐 Wireframes: screens, boxes, text (with your Mac's fonts), Material icons, ready-made pieces (nav bars, tab bars, inputs, cards…) and whole website sections. Things snap into line as you move them.
- 🗂️ Projects, folders and boards, with a home page for all of them. Right-click anything to rename, move, duplicate or delete.
- 🌙 Light and dark mode, undo (⌘Z), and export any card or board as an image or PDF.

**Mochi**
- 🫧 Chat with her about your board. She can add, edit, sort and connect cards, make collections and folders, and always suggests a few things to do next.
- 🔤 Ask her to explore fonts and she puts real type specimens on the board, from your Mac or Google Fonts.
- 📱 Describe a flow and she builds real wireframe screens. Ask for a landing page and she builds a full page in your colors and fonts.
- ✨ She takes you right to whatever she made, and it glows for a second.

**Mochi's helpers (optional)**, using the connections in your Claude account:
- **Mobbin** for real app screens as inspiration.
- **Higgsfield** to fill image spots with real pictures. It costs credits, so Mochi always shows the price and your balance first and waits for your yes. That check can't be turned off.
- No Higgsfield? Mochi can draw simple illustrations for free, or leave the spots as labeled placeholders.

## Download

**[⬇ Download Mochiboard for Mac](https://github.com/jessawolfe-ux/mochiboard/releases/latest/download/Mochiboard.zip)** (macOS 13 or newer, Apple chip or Intel)

1. Unzip it and drag **Mochiboard** into your Applications folder.
2. Open it. It's signed and notarized with Apple, so it opens on the first double-click.

Mochiboard updates itself from Settings after that. For Mochi's thinking, add [Claude Code](https://claude.com/claude-code).

## Install from the code

You need a Mac (macOS 13 or newer). For Mochi's thinking, install [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/jessawolfe-ux/mochiboard.git
cd mochiboard
./install.sh
```

The first time it opens, Mochi walks you through setup and a short tour. After that, Mochiboard checks for new versions on its own. When one is ready, a little dot shows on the ⚙ and Settings lists what's new, with an **Update now** button (it pulls from GitHub, rebuilds and reopens in about 30 seconds; your boards are never touched). You can always update from Terminal too: `./install.sh --update`.

The installer builds the app on your Mac (about 30 seconds), signs it with a certificate it makes just for your Mac (so macOS remembers its permissions between updates), and puts it in `~/Applications`.

## Your stuff

- Boards are plain files in `~/Library/Application Support/Mochiboard`. No account, no cloud.
- Mochi only thinks when you ask her something. Then the board and your question go to Claude Code on your Mac, the same as asking Claude yourself.
- Switch Mochi's thinking off in Settings and the whole canvas still works, with no AI and no internet.
- Chats are kept the way you choose: on each board, until you quit, or not at all.

## Shortcuts

| | |
|---|---|
| **⌘K** | Quick capture into Unsorted |
| **double-click** | New note |
| **N · C · T · D · G** | Note, checklist, title, doc, collection |
| **L · I · A** | Link, image, voice memo |
| **S · E · P** | Shapes, stamps, draw |
| **R · X** | Wireframe box, wireframe text |
| **M** | Ask Mochi |
| **F** | Focus on the selection |
| **0** | Fit the whole board |
| **⌘Z / ⇧⌘Z** | Undo / redo |
| **⌘G / ⇧⌘G** | Group / ungroup, so things move together |
| **⌘C / ⌘X / ⌘V** | Copy, cut and paste cards, even onto another board |
| **space + drag** | Pan |

## How it's built

A small Swift app (`Sources/Mochiboard.swift`) wraps the canvas (`web/`, plain HTML, CSS and JavaScript, no build step). Swift saves boards, fetches link previews, transcribes voice memos on your Mac, exports images and PDFs, and runs `claude -p` so Mochi can think. To work on the canvas in a browser, run `python3 -m http.server` inside `web/` (Mochi is pretend there).

Icons are [Material Icons](https://fonts.google.com/icons) (Apache 2.0). Fonts are DM Sans and Caveat (OFL).

---

<p align="center">Made with 🫧 by <a href="https://jessa.art">Jessa Wolfe</a>.<br>The code is open source (<a href="LICENSE">MIT</a>). The name, Mochi, the art and the music are <a href="TRADEMARKS.md">all rights reserved</a>.</p>
