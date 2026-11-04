# 1.9 audit · what got fixed (Nov 3 2026)

Checked again in WebKit after the fixes (verify scripts in the session scratchpad), plus the earlier feature tests (tables, styles, highlighter, archive, feedback): all pass, no page errors.

**Fixed**
- What's new 1.9: button says "Make a table" (picks the newest version's try button).
- Tables: + buttons moved to the corners (clear of the connect dots), same size on screen at any zoom; Mochi now sees table rows (first 40 × 12); comma text only becomes a table with 3+ lines or 3+ columns and no sentence endings; a hand-set height stays (resize sets userH, only deletes reset it); resizing never leaves rows outside the card; pasting into a cell is plain text, and tab-separated cells spread out from that cell; Shift+Enter does nothing in a cell; selection bar says "Table".
- Feedback sheet: owns the keyboard while open (Esc closes, ⌘Enter goes on, Tab cycles inside incl. buttons, nothing reaches the board); Review focuses Send; "thank me by name" with no name asks for one; review lists "Sent from" too.
- "tell Jessa's …" no longer opens the sheet; "Tell Jessa." asks what to say.
- Dark mode: highlighter chip readable; folder colors show on Home tiles.
- Cursor: native text cursor over doc text (children of contenteditable); highlighter pen cursor shows with the Mochiboard cursor on.
- Undo: a title re-measuring after an undo (web font loading) no longer becomes a new step.
- Esc closes every right-click menu and the color pop (board/folder/project, Mochi's menu); menus stay inside the window.
- Esc with the Highlight popover open closes it too.
- Text styles: a new note from a style starts in edit with its text selected; clicking a style with only non-text cards selected explains instead of adding a note; list sizes are measured from list items (14 px).
- Older: Mochi's chat sits above the right panels while open; Settings tabs scroll on phones (About + Ko-fi reachable).

**Not changed (design calls for Jessa)**: + button look vs connect dots, Table's place in the right-click menu, Support button style, Thank-you line style, What's new order for skipped versions, text styles per board + their place, Archived pill position, clearing color on boards/projects, BETA badge spacing on phones, hint strip behind the left column, 300×30 paste cap message, deleting columns doesn't shrink the card.
