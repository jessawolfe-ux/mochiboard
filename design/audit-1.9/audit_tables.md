# Audit · Tables (1.9)

WebKit (Playwright), web build at :4130, real mouse and keyboard for placing, typing, Tab/Enter/Esc, the + buttons, right-click → Table, drags, resize, ⌘D/⌘C/⌘V/⌘Z/⇧⌘Z/Backspace. API only to set boards up, read state, and fake clipboard data for the paste cases. About 90 checks in 20 short runs, plus dark mode and 430 px. No page errors in any run. Screenshots in `scratchpad/audit19/tables/`. No source files were changed.

## 1 · BUGS

### B1 · should fix · On a 1- or 2-row table the add-column + sits under the right connect dot
- Repro: make a table with 1 or 2 rows (paste two rows, or delete rows down to one). Select it. Click the blue + at the top right.
- Happened: the right-edge connect dot (`.kport`) is drawn on top of the + (`elementFromPoint` at the + centre returns `kport`). The click adds nothing (still 2 columns). With 3 or more rows the + is clear and works (`13_1x1_selected.png`).
- Expected: the + always wins, or the two never overlap. The + is at `top: 10px` and the dot is at mid-height, so they meet whenever the card is under ~100 px tall.
- Where to look: `.card.table .tb-addc { right: -30px; top: 10px }` in style.css vs the port placement in `syncPorts`. Pin the column + to the top-right *corner* above the dot, or move the dots aside on tables the way they step aside while typing.

### B2 · should fix · Mochi can't see what's in a table
- Repro: paste a table (Name/Role, Ana/Designer). Ask Mochi anything (I stubbed `MB.ask` to catch what it is sent).
- Happened: the table goes to Mochi as `{"type":"table", "text":"", ...}`. No rows, no cells. Mochi sees an empty card.
- Expected: Mochi gets the cells, like it gets a checklist's `items`.
- Where to look: `snapshot()` → `brief` (app.js ~2343). Add something like `rows: c.rows?.slice(0, 40)` (or `cardWords(c)` for tables), with a cap so a 300-row paste doesn't fill the prompt.

### B3 · should fix · Two lines of ordinary text with commas turn into a table
- Repro: paste `123 Main St, Apt 4⏎Springfield, IL 62701`, or `Hi team, quick update.⏎We ship Friday, hopefully.`
- Happened: a 2×2 table (`[["Hi team","quick update."],["We ship Friday","hopefully."]]`) plus the "Made a table" chirp. An address, a two-line message or a short list of "Last, First" names all hit this.
- Expected: a note. One line of plain text correctly stays a note, so the gap is only the two-line case.
- Where to look: the CSV branch at the end of `tableFrom`. It only needs every line to have the same comma count. Ideas: require 3+ lines, or 2+ commas per line, or skip it when a line ends in `.` `!` `?`; and give the chirp an "Undo, keep it as a note" action.

### B4 · should fix · Making the card shorter lets the last rows spill out of it
- Repro: select a 3-row table. Drag the resize corner (`#rh`) up and left.
- Happened: the card shrinks to 65 tall, but the table needs ~118. The last row draws outside the card, below its background, and the add-row + lands on top of "Bo" (`17_resized_narrow.png`). It stays like that until the next edit.
- Expected: the card can't get shorter than its rows (a note fits its text again on release), or it fits on mouse-up.
- Where to look: `drag.mode === 'resize'` (app.js ~1567). Only notes and to-dos are handled there. Call `fitText(c)` for tables on release.

### B5 · should fix · A height you set by hand is lost on the next keystroke
- Repro: drag a table taller (I went 118 → 241). Double-click a cell and type one letter.
- Happened: the card snaps back to 118. Every Table menu action also resets it (`tableEdit` sets `c.userH = 40`).
- Expected: like notes, the card keeps the height you gave it as its minimum (`userH`).
- Where to look: the resize code sets `c.userH = c.h` for `note`/`todo` only (lines ~1564, ~1567, ~1649). Add `table`. Then drop the `userH = 40` reset in `tableEdit`, or keep it only for deletes.

### B6 · minor · Pasting into a cell brings in the other app's formatting
- Repro: copy some styled text or a table from a web page. Double-click a cell, ⌘V.
- Happened: the cell shows the pasted HTML: red 40 px bold text and a whole nested table (`22_paste_into_cell.png`, `23_paste_into_cell_after.png`). What gets saved is only the plain text (`"BIG x\ty"`, tab included), so after a reload the cell looks different from what you saw.
- Expected: paste as plain text. Tabs and newlines become spaces, or (nicer) several pasted rows/columns fill the cells to the right and below, like a spreadsheet.
- Where to look: `editCell`/`editField`. The board `paste` listener returns early for `[contenteditable]`. A `paste` handler on the cell that calls `document.execCommand('insertText', false, plain)` fixes it. Notes probably have the same issue, but tables are where people paste from spreadsheets.

### B7 · minor · Shift+Enter shows a line break that isn't saved
- Repro: in a cell, type `line one`, Shift+Enter, `line two`, Esc.
- Happened: it shows two lines while you edit. The data is `"line one line two"`, and after a reload it is one line (`04_shift_enter.png` vs `06_reload.png`).
- Expected: either keep the line break (cells already use `white-space: pre-wrap`), or block Shift+Enter so it never looks like it worked.
- Where to look: `editField`'s `oneLine` check (`!t.matches('.body > .text')`) is true for cells, so `\n` becomes a space.

### B8 · minor · The + buttons scale with zoom: 6 px at 25 %, 44 px at 200 %
- Happened: the connect dots stay 22 px on screen, but the + buttons are drawn inside the card and shrink and grow with it: 11 px at 50 % (`16_zoom_0.5.png`), 44 px at 200 % (`16_zoom_2.0.png`), and about 10 px on a phone. At 50 % they are smaller than the dots beside them and hard to hit.
- Expected: a fixed size on screen, like the dots and the resize corner (`#rh` uses `--iz`).
- Where to look: `.card.table .tb-add`. Scale it by `1/zoom` (or `var(--iz)`) the way `#rh` is.

### B9 · minor · The selection bar and export say "Card"
- Happened: a selected table's bar reads **Card** (every screenshot). Right-click → Export would name the file "Card" too, because `cardName` has no table case.
- Where to look: the label map in the selbar builder (app.js ~5365) has no `table: 'Table'`. Same for `cardName` (~2730). Something like `Table · Name, Role` would match Layers.

### B10 · minor · Large pastes are cut to 300 × 30 without saying so
- Repro: paste 400 rows × 40 columns.
- Happened: a 300 × 30 table and the chirp "Made a table: 300 rows, 30 columns ✦". 100 rows and 10 columns are silently gone. The 60 × 12 paste was fine (`20_huge.png`), apart from columns being 75 px wide.
- Expected: the chirp says what was left out ("…kept the first 300 rows").

### Seen with odd input, low priority
- CSV whose rows have different lengths becomes a **note**, but TSV with uneven rows becomes a padded **table**. CSV with a quoted line break (`"line1⏎line2"`) also falls back to a note.
- An HTML table with a table nested inside a cell repeats the inner rows (`querySelectorAll('tr')` picks up nested rows too). Rare.
- Export as image didn't start a download in the browser build, so I couldn't check export. Worth a quick look in the Mac app.

## 2 · UX NOTES (priority order)
1. **The + buttons look like the connect dots.** Same blue, same + glyph, both on the edges, about 20 px apart on the right (`03_typed.png`). Even when they don't overlap (B1), it's a guess which one adds a column and which one starts an arrow. Give the table + its own look: a pill with "+ row" / "+ column", or a soft tinted bar the full length of the edge (Notion/Figma style), and keep the dots off those two edges.
2. **Put Table first in the right-click menu.** It is third, after Create section and Mask (`09_ctx.png`). On a table, Table is what people came for. "Plain first row" also reads oddly. "Turn header row off" / "Turn header row on" matches the release note.
3. **Enter on an empty last row keeps adding rows.** Three Enters gave three more blank rows. Many editors leave the table on Enter in an empty last row (or Esc). At least, two Enters in a row on an empty row could stop.
4. **Deleting columns never shrinks the card.** Adding columns widens it (110 px each). Deleting leaves the width, so a 1-column table is 360 px of one cell. Shrink back toward `cols × 130`, but not below 260.
5. **Enter on a selected table does nothing.** You have to double-click. Enter → edit the first cell would match notes, and it's the keyboard way in.
6. **In dark mode the column lines almost disappear** (`27_dark.png`): `rgba(120,80,120,.09)` on a dark card. Rows still read. Raise the dark-mode border alpha a little.
7. **"Add row above" on the header** adds a new empty header and pushes the old header down into the body. That's correct, but surprising. Consider adding *below* the header when it's on.
8. **A pasted TSV in an open doc** comes in as lines with tabs, not a table (`37_doc_tsv_paste.png`). Real spreadsheet copies carry HTML and should be fine, but plain TSV/CSV could use the same `tableFrom` there.
9. **Phone (430 px):** Table is in the + sheet and works, but at the starting zoom a 360-wide table is ~160 px on screen with ~6 px text, and the + buttons are about 10 px (`33_phone_placed.png`). On phones, zoom to the new table, or place it the width of the screen.
10. The placing ghost (409 × 148) is a little bigger than the table that lands (432 × 142 at that zoom, but only 3 rows tall). It's small, but the ghost could match the real 3-row height.

## 3 · WHAT WORKED
- B key and the toolbar Table tool both show a "Table" ghost, place a 3 × 3 table (360 wide, fits to 118) where you click, and put you straight into the first header cell (`01_b_ghost.png`, `02_placed.png`).
- Tab / Shift+Tab move along and wrap rows. Shift+Tab on the first cell stays put. Tab on the last cell adds a row. Enter goes down, and Enter on the last row adds one. Esc leaves the cell and keeps the table selected.
- Fast typing (no delay) lands in the right cells. Long words hyphenate inside the cell. Emoji and CJK are fine (`05_long_emoji.png`). Typing `b n d t` in a cell types letters, not shortcuts. Arrow keys move the caret, not the card. Backspace in an empty cell doesn't delete the card. ⌘A selects only the cell's text. ⌘Z while typing undoes text inside the cell.
- Clicking another cell while editing moves the edit there.
- Every Table submenu item, on body and header cells: Add row above/below, Add column left/right, Delete row/column, Plain first row ↔ Make the first row a header (`10_sub_body.png`). Delete row/column disappear at 1 row / 1 column, so you can't delete down to nothing (`12_1x1_menu.png`). Each is one ⌘Z step, and ⇧⌘Z redoes.
- The + buttons (when not covered) add a row/column and start typing in the new cell. ⌘Z undoes each one.
- Move by dragging a cell, ⌘D (a real copy: editing the duplicate leaves the original alone), ⌘C/⌘V, Backspace delete, and ⌘Z/⇧⌘Z through all of them. Undo of a pasted table removes it.
- Paste: TSV, TSV with empty cells, HTML table (with `<b>` inside, colspan), CSV with quoted commas and `""` quotes, ragged TSV (padded), a single line (note), a single TSV line (note), a URL (link card), non-table HTML (note). 60 × 12 lands in under a second.
- Layers name: "Table · Name, Role, City". Save and reload keeps rows, emoji, header state and height.
- Docs: dragging a table onto a doc card or onto the open doc page drops in a real table, with `th` header cells, or all `td` when the header is off. The table card stays on the board, and there's an Undo chirp (`26_doc_open.png`, `36_page_after.png`).
- Dark mode: header tint, text and the editing cell (#2a2630) all read well (`27_dark.png`, `29_dark_plain.png`). Header-off looks clean.
- No page errors in any run.
