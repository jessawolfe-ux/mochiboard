# Audit · Saved text styles, Highlighter mode, Archive projects, Color your canvases

WebKit 26.4 (Playwright), web build at :4130, 1440×900 light and dark, plus 430×900 (phone layout). Real mouse and keyboard for every right-click, menu, style row, drag-to-highlight, ⌘Z/⇧⌘Z, Esc, typing and tile click. JS only to seed boards, projects and folders and to read state back. One diagnostic run served a copy of app.js through a Playwright route with a read-only undo-history probe, to explain B4. About 120 checks across 25 scripts. No page errors in any run. Screenshots are in `scratchpad/audit19/styles/`. Nothing in the repo was changed.

## 1 · BUGS

### B1 · should fix · The highlighter chip can't be read in dark mode
- Repro: dark mode, open a doc, Highlight → Highlighter mode.
- Happened: the chip "Highlighter on · drag over words / Put it down · Esc" is white text on a near-white pill (`rgb(236,232,240)` behind `#fff`), so it's basically invisible (`hl_02_dark_crop.png`). Light mode is fine (`hl_02_first.png`).
- Expected: a dark pill in both themes, like the light one.
- Where to look: `.hl-chip { background: var(--ink); color: #fff }`. `body.dark` sets `--ink: #ece8f0`. Give the chip a fixed dark background, or a `body.dark .hl-chip` rule.

### B2 · should fix · Folder colors disappear from Home tiles in dark mode
- Repro: color a folder (for example Ideas → pink). Open its project on Home. Switch to dark.
- Happened: in light mode the folder's back and tab turn pink (`co_02_project_page.png`). In dark mode they stay plain `--surface-2` gray (`co_02_project_page_dark.png`). The tree icon still shows the color, so the list and Home don't match.
- Expected: "Folders turn that color in the list and on Home" in both themes.
- Where to look: style.css ~692, `body.dark .tile.folder .tile-art .back, … .tab { background: var(--surface-2) !important; }` beats `.tile.folder[style*="--fcol"] .tile-art .back/.tab` (~2662). The `::after` curve at 693 has the same problem. Add a dark `[style*="--fcol"]` rule with `!important`, maybe with a slightly deeper tint.

### B3 · should fix · The highlighter cursor never shows with the default Mochiboard cursor
- Repro: leave Settings → Your cursor → Mochiboard cursor on (the default). Pick up the highlighter and hover over doc text.
- Happened: over paragraph text the computed cursor is `none`, and the app's own cursor is hidden (`mcur … hide`, body `cur-native`). So there's no pen and no cursor at all. With Mochiboard cursor off, the pen cursor does show (`cursor: url("data:image/svg+xml…`). Evidence is computed style, because screenshots don't capture the OS cursor (`hl_06_cursor_default.png`).
- Expected: the little highlighter pen while holding it, and an I-beam otherwise.
- Where to look: style.css 1180–1181. `body.fancy-cursor *` sets `cursor: none !important`. The `cur-native` exception covers `[contenteditable="true"]` itself but not its children (`p`, `li`, `h1`), and `hlPenOn` sets the pen on `#dvBody` without `!important`. Something like `body.fancy-cursor .docview.hl-pen .dv-prose, body.fancy-cursor .docview.hl-pen .dv-prose * { cursor: <pen> !important }` (pen as a CSS var), plus an I-beam for `.dv-prose *` under `cur-native`. This probably also means docs show no text cursor in general, not only with the pen.

### B4 · should fix · Undo can get stuck after a text style puts a web font on a title (intermittent)
- Repro A (2 of 2 runs): a board with a "Heading" style in DM Serif Display (saved from a title). Click a plain note → click the style. Click a plain title → click the style. Press ⌘Z four times.
- Happened: the first ⌘Z undoes the title. Every later ⌘Z does nothing: the note stays styled, and there's no "Nothing left to undo".
- Repro B (stuck in 2 of 5 runs): a board with a saved style in a font nothing on the board uses yet (Playfair Display, Space Grotesk). Drag a note, apply the style to a title, then ⌘Z ×4. The title reverts but the drag never does. Lobster didn't get stuck.
- Why (from the probe): after a restore, `renderAll` re-fits the title's width with the font now loaded (`t1.w: 387 → 399`). The restored state never matches the snapshot. So each ⌘Z first `remember()`s the re-fitted state, then pops it and restores the same snapshot again, which loops.
- Expected: each ⌘Z steps back one action, through to the start.
- Where to look: `travel()` (~line 485) and whatever re-fits title width inside `renderCard`. Either don't let render-time fitting write back into card data during `restoring`, or snapshot again after fonts load (`document.fonts.ready` / `load` on the stylesheet link that `useFont` adds). Text styles make this much easier to hit because they load fonts mid-session.

### B5 · should fix · Esc doesn't close the project/folder/board menu or the color pop
- Repro: right-click a project, folder or board in the tree or on Home (or click a folder icon or board dot for the color pop). Press Esc.
- Happened: on a board, the menu or pop stays open. On Home, Esc closes Home and leaves the menu floating over the board (`ar_09_esc_leaves_menu.png`). Neither one takes keyboard focus (`activeElement = BODY`).
- Expected: Esc closes the topmost menu first, like the card menu (`boardMenu`) already does.
- Where to look: `rowMenu()` and `colorPop()` (~lines 109, 223) only add an outside-`pointerdown` closer. Add a capture-phase keydown for Escape that removes `#rowMenu` and stops the event before Home's Esc handler.

### B6 · minor · A new note made from a style isn't ready to type, so letters fire shortcuts
- Repro: click empty board, then click a text style.
- Happened: a note (or title) appears with the style's name as its text, selected but not editing. Typing "xyz" switched on the wireframe Text tool (`ts_15_after_typing.png`). The note still says "Note text".
- Expected: like every other new note, it opens editing with the placeholder text selected, so typing replaces it.
- Where to look: `renderTextStyles` → `r.onclick`. `addAtCenter` starts editing, then `applyTextStyle` → `selectOnly` / `renderCard` ends it. Call `startEdit(c.id)` (and select the text) after `applyTextStyle`.

### B7 · minor · List sizes follow the list's heading, not its items
- Repro: save a style from a list at Small → the row says "List text · 18 px". Or apply a 21 px note style to a list.
- Happened: the 18 px is the list's heading size (`FS_BASE.todo = 22`). The items on that list are 11.2 px. Applying "21 px" gives a 21 px heading and 13.4 px items (`ts_04_multi.png`, "TODO TWO"). Sizes don't carry as the px people see on the list's lines.
- Expected: a list's size means its item text, or the style label says it's the heading.
- Where to look: `FS_BASE` (~5251) and `tsOf` / `applyTextStyle`. The size box in the selection bar uses the same base, so it also shows 22 for a list whose lines are 14 px (`ts_06_todo_size.png`).

### B8 · minor · Right-click menus and the color pop run off the right edge
- Repro: 430 px wide, Home → Archived, right-click near the right side of the archived tile.
- Happened: the menu spans x 399–585 in a 430 px window, so Duplicate, Restore, the color dots and Delete are cut off (`ph_13_tile_menu_edge.png`).
- Expected: kept inside the window, as `boardMenu` already does.
- Where to look: `rowMenu` clamps only the bottom. `colorPop` doesn't clamp at all. Copy the `rr.right > innerWidth - 10` line from `boardMenu`.

### B9 · minor · Esc with the Highlight popover open puts the pen down but leaves the popover open
- Repro: hold the highlighter, open the Highlight popover, press Esc.
- Happened: the chip goes away but the popover stays (`hl_07_esc_with_pop.png`). A second Esc closes it.
- Expected: the first Esc closes the popover (it's on top). The second puts the pen down.
- Where to look: the capture-phase keydown at ~4880 runs before the popover's handler and calls `stopImmediatePropagation`. Check `#dvPop` first.

### B10 · minor · The shortcut-hint strip shows through the left column where Text styles sit
- Repro: 1440×900 with a few saved styles, or just the default panels.
- Happened: "double-click new note · F focus · ⌘\ just the board" reads faintly through the Board colors / Text styles box (`ts_13_many.png` bottom left, `ar_01_archived_open.png` ~y 795–830).
- Expected: the hints sit below the column or hide when the column reaches them. Text styles make that column taller, so this gets more likely.

### Seen once, not reproduced
- 430 px: with a note selected, a tap on the selection bar's "···" left the board without that note (`ph_01c_more.png`). It may have landed on a neighbouring button while the bar re-laid out. This is outside the four features and wasn't retried.

## 2 · UX NOTES (priority order)
1. **Text styles are per board.** A new board starts empty (`ts14`), and Duplicate is the only way to carry them. People building a type system will expect their styles everywhere, or at least across a project. If per-board is intended, say so in the empty text the way Board colors does ("Each board keeps its own…").
2. **Fix B4, then B6.** Undo that sticks is the one thing here that can cost work. The style-made note that isn't ready to type is the first thing a new user will try.
3. **Clicking a style with only non-text selected makes a new note.** With a swatch selected, a click added a note at the center (`cards 12 → 13`). "Select some text first" (the chirp the right-click menu already uses) would be clearer.
4. **Text styles are hard to find.** They sit at the very bottom of the left column, under Layers and Board colors. At 900 px tall the list starts near the fold. A "Text style ▸" row in the selection bar's text controls would make them findable. At 430 px it would also be the only way to apply one from the dock: selecting a card swaps the dock for the selection bar, so + → Colors can only make new notes (`ph_03_tap_style.png`). Right-click → Text style ▸ does work there (`ph_04_textstyle_sub.png`).
5. **Removing a style can't be undone** and doesn't ask. Renaming to an existing name is allowed, so two "Poster" rows can exist. Renaming to empty correctly keeps the old name.
6. **Highlighter edge cases:** "Any color…" while holding opens the wheel for the selected text, not the pen's ink. "No highlight" while holding does nothing visible. Typing right after a highlighted word keeps highlighting ("MochiTYPED"). That's normal editor behavior, but a little surprising while "holding a pen".
7. **Archiving the project of the open board gives the board no cue.** The tree still says "In this project · Alpha" and the crumbs say "Alpha / Ideas" (`ar_01_archived_open.png`). A small "Archived" tag in the crumbs or tree header would say why it's missing from Everything. On phone that scoped tree also hides the Archived link.
8. **Home's Archived pill sits at the very end**, after loose folders and boards, not "under your projects". At 430 px it's at y = 1475. Putting it right after the project tiles would match the claim and the tree.
9. **Move to… inside an archived project** lists only active projects (`ar_07_move_from_archived.png`), so a folder can't be moved within its own archived project. Duplicate on an archived project makes an active copy while you stay on the Archived page. Nothing changes on screen except the chirp.
10. **Colors:** only folders have "No color". Boards and projects can't be cleared back (their default reads as pink). A board's color only shows as the tree dot: board tiles on Home ignore it, and project tiles use it only when empty. The folder tint on Home is the pale pastel on back and tab, quieter than the deep tree icon (`co_03_home_all.png`).
11. Also seen, probably older: Home's "Back to board" pill sits half under the Ideate panel at 1440 (`ar_03_archived_page.png`) and overlaps the subtitle at 430 (`ph_13`). The Boards sheet stays open over Home after tapping All projects on phone.

## 3 · WHAT WORKED
- Save text style from a note, title, list, shape label and table. Rows show font · px · CAPS and preview the font, weight, case, spacing and title color (`ts_02_five.png`). Saving starts an inline rename; Enter keeps the default name ("Note text", "Heading", "Label"…).
- Sizes carry as real px across types: 66 px heading → note 66 px (`fs 4.4`), 21 px note → title 21 px, shape 21 px, table 21 px. Title color and outline pass title → title only, never onto a note's fill.
- Multi-selection of 5 mixed cards styled in one click, and one ⌘Z reverts all five. Applying while typing in a note keeps the text. Right-click → Text style ▸ applies too.
- Style row right-click: Use on selected text / Rename / Update from selected text (only with text selected) / Remove. The card menu closes on Esc. 15 styles scroll fine inside the side column. Styles persist after reload. Dark mode rows and the rename field are readable (`ts_10_renaming_dark.png`, `ts_11_panel_dark.png`).
- Highlighter: drag across words, across paragraphs, across list items and over a heading. All 7 colors (`hl_04_colors.png`). Dragging again over the same color erases. Dragging inside a highlight erases just that part. A new color over an old one recolors. Swapping color from the popover keeps the pen. The bubble menu never shows while holding, and comes back after Esc. A single click adds nothing. Shift+arrow selection doesn't highlight. ⌘Z, toolbar Undo and ⇧⌘Z step one highlight at a time. Esc puts the pen down and keeps the doc open. Closing the doc drops the pen, and reopening starts without it. Highlights persist after reload. The Highlight button shows "on" while holding. At 430 px the chip fits (x 35–395) and dragging works (`ph_06_pen.png`).
- Archive from the tree, from a Home tile and on the last project. Projects leave the tree and Home, and "Archived · n" appears in the tree and as a pill on Home. Archived page title, subtitle, Restore pill, crumbs (All projects / Archived / Alpha / Ideas / Nested) and Back chain (Nested → Ideas → Alpha → Archived → Your projects) all work (`ar_03`, `ar_04`). Empty state after the last restore: "Nothing archived. Right-click a project → Archive…" (`ar_08_empty_archived.png`). Right-click shows "Restore from archive". A board can be moved out of an archived project, and crumbs follow. A new board made inside an archived folder opens there. Archived flags persist after reload.
- Colors from the board dot, folder icon, project dot, right-click in the tree and right-click on Home tiles, including archived tiles. Current color is ringed. Folder "No color" clears the field. The tree icon uses the deep color and the Home folder back/tab the pastel. Colors persist after reload. Dark-mode tree dots and icons read well (`co_05_tree_after_reload_dark.png`). The color pop at 430 px stays on screen (x 72–286).
