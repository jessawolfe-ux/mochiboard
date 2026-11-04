# Audit · people features in 1.9 (Tell Jessa, Support Mochi, thank-yous, ™, What's new card)

WebKit (Playwright), browser build at :4130 (plain, `?web`, and AI switched off), real mouse and keyboard for every user action; JS only to set up localStorage and read state. Feedback posts were intercepted and faked (success, 500, network abort, offline, held response). External links were caught by stubbing `window.open`. ~140 checks over 12 runs, at 1440×900, 1280×800, 1728×1117 and 430×932, light and dark. Screenshots in `scratchpad/audit19/people/`. No source files were changed. No page errors in any run.

**Heads-up first:** in my first full sheet run, the Formspree intercept did not catch the post (the page's service worker was active, and in WebKit Playwright's route then misses it). The sheet showed "Sent ✦ Thank you!", so **one test note most likely reached the real inbox**: subject "Mochiboard feedback ✦", kind "Something's broken", note "Tables are great but I wish I could merge cells. Also: <b>bold</b> & "quotes" 💖", reply-to zen@example.com, thank-me-as "Zen Park, product designer". Please delete it. After that I blocked service workers and also rewrote formspree.io to an address that can't resolve, then checked that every later post was caught (`__fsReal` = 3 rewritten, 0 real).

## 1 · BUGS

### B1 · should fix · The What's new 1.9 card's button says "Pick your camera", not "Make a table"
- Repro: have last seen 1.8.0 (or 1.6.0 / 1.7.0) and open the app.
- Happened: the left button reads **Pick your camera** and opens Settings → General at Camera & microphone (`d_news_from18_light_1440.png`, `d_try_ghost.png`). No table is placed. Same in dark mode and at 430 px.
- Expected: **Make a table**, which starts placing a table.
- Where to look: `maybeNews`, `const tryK = Object.keys(NEWS_TRY).filter(k => !after(k, v)).pop()`. `NEWS_TRY` lists '1.9.0' *first*, so `.pop()` takes the last key, '1.5.0'. Pick the highest version instead (sort with `after`, or move '1.9.0' to the end of the object).

### B2 · should fix · Esc stops working on the feedback sheet after you click anything in it
- Repro: open the sheet, click a kind ("Something's broken"), the "thank me by name" switch, or **Review**. Press Esc.
- Happened: the sheet stays open (tested on the write step after a kind click, and twice on the review step). In WebKit a clicked button doesn't take focus, so focus drops to `BODY` and the sheet's own keydown listener never hears the key. Keys also leak to the board underneath: after clicking a kind, pressing **B** started placing a table behind the sheet (the ghost showed up), and the first Esc only put that table down.
- Expected: Esc closes the sheet at any step, and board shortcuts are off while it's open.
- Where to look: `$('fbSheet').addEventListener('keydown', …)` only catches keys when focus is inside. Add a document-level capture listener while `fbOn()` (the same way the Templates and Library windows do it), or move focus to the panel / the Send button when the step changes.

### B3 · should fix · Keyboard users can't send, and Tab walks out of the sheet into hidden Settings fields
- Repro: open the sheet, click in the note, press Tab again and again.
- Happened: the order is note → email → `setName` → `devCam` → `devMic` → BODY → `boardName` → `mcInput` → `linkInput` → … then back to the note. Tab never reaches the kinds, the credit switch, Review, Edit or Send (WebKit skips buttons and checkboxes by default, and the Mac app uses WebKit). Focus goes into fields of the *closed* Settings panel. Enter in the email field does nothing. There's no ⌘Enter either.
- Expected: focus stays inside the sheet. There's a keyboard way to Review and Send (⌘Enter, or Enter in a single-line field). The kinds and the switch can be reached.
- Where to look: the `#fbSheet` markup and handlers. Trap Tab inside `.fbs-panel`, add `tabindex="0"` to the kind buttons and Review/Send, and add ⌘Enter → `fbsNext.click()`. It's worth checking why the closed `#settings` panel's inputs can still take focus (a hidden panel should be `inert` or `visibility:hidden`).

### B4 · should fix · "If it ships, thank me by name" turned on with no name drops the credit without a word
- Repro: write a note, turn on the switch, leave **Your name** empty (or fill in only the role). Click Review.
- Happened: the review has no "Thank me as" or "Role" row, and nothing says why. The person asked to be thanked and will think they will be.
- Expected: same as the bad email: "Add your name so I can thank you ✦", with focus moved to the name field. Or turn the switch off by itself.
- Where to look: the `$('fbsNext').onclick` write-step checks, next to the email check.

### B5 · should fix · "tell Jessa's …" is read as a message to Jessa
- Repro: in Mochi's chat, type `tell Jessa's team the board is slow`, or `send jessa's board link to my team`.
- Happened: Mochi offers "Want me to send that to Jessa?" and the note is prefilled as **'s team the board is slow** (with the stray `'s`).
- Expected: no feedback offer; the message goes to Mochi as normal.
- Where to look: `TELL_JESSA`. After `jessa`, `\b` matches before the apostrophe. Use `jessa(?!['’]s)\b` or require whitespace/punctuation after the name.

### B6 · minor · "Tell Jessa." prefills the note with just "."
- Repro: type `Tell Jessa.` in the chat.
- Happened: Mochi says "Want me to send that to Jessa?" with **Review and send ♡**, and the note box holds ".".
- Expected: treat punctuation-only the same as an empty note: "What should I tell her?" plus **Write a note ♡**.
- Where to look: `ask()`. Strip `[\s.!?…]` before checking `note`.

### B7 · minor · Esc doesn't close Mochi's right-click menu
- Repro: right-click Mochi's pill, press Esc.
- Happened: the "Send feedback to Jessa ♡ / Open chat" menu stays. A click elsewhere does close it.
- Expected: Esc closes it, like the board and Layers menus (those have an `escP` listener).
- Where to look: `$('mPill').oncontextmenu`.

### B8 · should fix · At phone width, Settings → About (and the Ko-fi pill) can't be reached
- Repro: 430×932, Boards → gear. The tab row is General, Mochi, Helpers, Board, Toolbar, Widg…
- Happened: the tab row is 467 px wide inside a 390 px panel, with `overflow: visible`. **Widgets** is cut in half and **About** sits at x 449–510, off the screen. A horizontal scroll moves nothing (`scrollLeft` stays 0). So Support Mochi, Send feedback and the ™ line in About can't be reached on a phone (`e_phone_settings.png`). This is probably older than 1.9, but now it hides two of the new things.
- Expected: tabs scroll sideways or wrap at phone width.
- Where to look: `.set-tabs` in style.css, the phone media query.

### B9 · should fix · At 1280×800 and 1440×900 the right widget panel covers the chat's header buttons
- Repro: click Mochi to open the chat at 1440×900 (or 1280×800).
- Happened: `#sideR` is on top of the right end of the chat window. At 1440 the **×** is under the Pieces grid (`elementFromPoint` → `dzPieces`). At 1280, **New chat** and **×** are both hidden and only **Feedback ♡** shows (`g_chat_1280.png`). At 1728×1117 they don't overlap. Probably not new in 1.9, but the chat header is now one of the three ways into Tell Jessa.
- Expected: the chat sits above the side panels, or opens to the left of them.
- Where to look: z-index of `.mochi.chat` / `#mChat` vs `.side-r`.

### B10 · minor · At 430 px the BETA badge touches the All projects row
- Happened: in the phone Boards sheet the badge runs from y 747 to ~760 and All projects starts at 758.5 (`e_phone_boards.png`). On desktop there's a 17 px gap. The ™ itself sits fine.
- Where to look: the `#side .box[data-box="boards"] > header { padding-bottom: 14px }` rule doesn't reach the header once it's moved into the phone sheet.

## 2 · UX NOTES (priority order)
1. **Fix B1–B4 before 1.9 ships.** B1 is the card's headline button. B2–B4 are the moments when someone is trusting you with a note.
2. **"Exactly what goes out" isn't quite exact.** The post also carries `page: "Mochiboard app"` and `_subject: "Mochiboard feedback ✦"`, which the review list leaves out (FB_LABEL has no entry for them). Neither is personal, but the lead line makes a promise. Either show "Sent from: Mochiboard app", or say "This is what you're sending" instead.
3. **The newest things are at the bottom for anyone who skipped a version.** Coming from 1.6 the card lists 22 items oldest-first. Tables starts at item 17, and the Thank-you line is the 23rd row (`d_credits_dark_1440.png`). Coming from 1.0 it's 52 items. Newest version first (or a small heading per version) would put 1.9 on top.
4. **The thank-you line looks like another feature row.** Same card, same white icon tile; only the ♡ glyph is different, and then there's a second ♡ at the end of the sentence. A soft blush background, or the people's names in bold, would make it feel like a thank-you. Also the form promises "idea from Zen, product designer ♡" (lowercase role) but the card shows "Product Designer". Pick one.
5. **A typed "tell Jessa…" quietly replaces a draft.** If you'd started a note in the sheet, closed it, and then typed `tell Jessa the grid is lovely`, the old draft is gone. Rare, but easy to keep: append, or only prefill when the box is empty.
6. **The kind sticks after sending.** Send a "Love note" and the next note opens as a Love note too. Reset to Idea after a successful send, like the other fields.
7. **The fallback link drops the note.** After a failure, "use the feedback page" opens mochiboard.app/feedback.html, but the note isn't copied over. Copying it to the clipboard first ("Your note is copied ✦") would save retyping.
8. **"tell Jessa" only works at the very start.** These go to Claude instead: "Hey Mochi, tell Jessa I love it", "Mochi, tell Jessa thanks", "pls tell Jessa hi", "I want to tell Jessa something". Allowing a leading "hey mochi," / "mochi," and "pls" covers the natural ones. "let Jessa decide the colours" does match (a borderline false positive; the review step makes it harmless).
9. **The sheet changes height between steps.** It's centred, so the title jumps about 70 px up or down when you go Review ↔ Edit (`b1_sheet_credit.png` vs `b2_review.png`). Anchoring it to the top, or keeping a min-height, would stop the jump.
10. **Support Mochi reads as a second big call to action, not a "little pill".** It's a full lilac card with a dark hot button, the same weight as Send feedback right above it (`c_support_light_1440.png`). The button doesn't say Ko-fi and has no ↗, but jessa.art ↗ and GitHub ↗ below it do. Suggest "Buy me a coffee ↗" or "Ko-fi ↗" as a quieter outline button, or fold it into the maker row.
11. **On phones the 1.9 card says "Right-click Mochi"**, which a finger can't do. The chat's Feedback ♡ button works on the phone (`e_phone_chat.png`); mention that instead, or as well.
12. **The 4000-character limit cuts the note off silently.** A small counter near the limit would help. The review step itself handles a 4000-character note well: the list scrolls and the buttons stay on screen (`b7_huge_review.png`). A 300-character URL wraps cleanly too.
13. **Esc doesn't close the What's new card** (× / Love it / clicking outside all do). Not new, but it's the one dialog in this group that ignores Esc.

## 3 · WHAT WORKED
- Every entry point opens the sheet with the caret in the note: right-click Mochi → Send feedback to Jessa ♡; the chat's Feedback ♡; Settings → About → Send feedback ♡ (Settings closes behind it). The right-click menu's Open chat works, and a click elsewhere dismisses the menu.
- "tell Jessa…" in chat, 15 matching phrasings, identical with Claude, in `?web` and with AI off: "tell Jessa I love…", "Tell Jessa that…" (drops "that", capitalises), "TELL JESSA: …", "please / can you / could you …", "let Jessa know …", "send/message jessa - …", and a Shift+Enter second line. Bare "tell jessa" / "let Jessa know" get "What should I tell her?" + Write a note ♡. "tell me about Jessa", "who is Jessa?" and "tell jessica hi" correctly don't match. "Not now" just removes the buttons.
- Write step: an empty or spaces-only note → "Write a little note first ✦", focus back on the note. A bad email → "That email looks a little off.", focus on the email. The credit switch reveals name and role and moves focus to the name. Tab from name → role.
- The review list matched the intercepted body field for field (kind, message with newline/HTML/emoji shown as plain text, email, credit_name, credit_role, version 1.9.0, computer). Turning the switch off after typing a name keeps the name out. Edit goes back with every field kept.
- Send: "Sending…" with the button disabled. Three fast clicks while the response was held = **one** request. Success → "Sent ✦ Thank you!", closes after ~1.2 s, Mochi says "Sent to Jessa ✦ She reads every one.", fields and switch are cleared. 500 and network abort → "That didn't go through. Try again, or use the feedback page." with the button live again and the link opening mochiboard.app/feedback.html. Offline → "You're offline. Your note is still here…" and nothing is posted.
- × and clicking outside close the sheet; the draft is still there when you reopen it.
- Dark mode sheet, both steps: readable, kinds and fields switch to dark (`c_sheet_write_dark_1440.png`, `c_sheet_review_dark_1440.png`). At 430 px the sheet fits (20 px gutters), the kinds wrap to two rows, no sideways scroll (`c_sheet_write_dark_430.png`, `c_sheet_review_light_430.png`).
- Ko-fi: Settings → About, under Tell me what you think and above Made with love by. The button opens exactly `https://ko-fi.com/jessawolfe` through `MB.openURL` (`window.open` in the browser, `openURL` to Swift in the app). Dark mode reads well (`c_support_dark_1440.png`).
- ™: header "Mochiboard™" with a 7×11 px ™ snug to the d. The BETA / TESTING badge (`html.beta`) sits under the word, left-aligned, in both themes (`c_header_zoom.png`). About shows "Mochiboard™ BETA" and the line "Mochiboard™ and Mochi are trademarks of Jessa Wolfe."
- What's new: 1.8→1.9 shows the 6 new items, all readable, fitting in 832 of 900 px. 1.6→1.9 shows 22 items plus "Thank you · Calm modes: idea from Nikunj Tyagi, Product Designer ♡". 1.0→1.9 and no-key both show all 52 items plus the 1.6 widget steps (Skip / Next →). No credits line for 1.8→1.9, as designed. Dark mode and 430 px are fine, and the card scrolls inside itself (`d_credits_dark_430.png`). Love it and clicking outside close it.
