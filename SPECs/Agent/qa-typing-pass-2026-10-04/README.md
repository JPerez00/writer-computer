# QA: typing a long note by hand, 2026-10-04

A person-like pass over the editor: a ~210-line note covering frontmatter, headings, lists, tasks, quotes, code, tables, math, Mermaid, HTML, links, images, wiki links, rules and unicode was typed **one key press at a time**, then revised with the keyboard and mouse. Every divergence between what was meant and what ended up in the document was logged, and each problem has its own recording.

- `intended-note.md`: the note the "writer" meant to produce.
- `typed-note-result.md`: what the document held at the end, including the harness's own line corrections (see Method).
- `videos/` (not committed — 25 MB of recordings kept out of git history; they live in the author's worktree and can be shared on request): the full 4-minute typing session, the editing pass, one captioned repro per finding, and `videos/after/` with a replay of every fix.
- `screenshots/`: section screenshots from the typing run.

## Status after the fix pass

Everything below was fixed the same day, except the feature gaps listed under "Not fixed". The fixes were then verified three ways:

- **Unit tests:** new or updated tests for every fix (`editor-formatting`, `heading-decorations`, `mermaid`, `list-extension`, `blockquote-enter`, `image-fold`). The full suite passes (`vp test`: 52 files, 736 tests).
- **The same typing run, repeated** (`videos/after/00-full-typing-session.mp4`). The typed note is now **identical to the intended note** (`typed-note-result-after-fixes.md`), and the caret never left the window. The harness still stepped in 8 times, all for designed behavior rather than bugs:
  - backspacing an auto-inserted `- [ ] ` to write `- [x]` leaves the list;
  - an empty nested item steps out one level at a time;
  - `{` auto-pairs to `{}` in code;
  - a list continuation paragraph or indented code block takes a third Enter to leave (Enter, Enter starts another paragraph inside it).
- **One after clip per finding** (`videos/after/NN-*.mp4`). Each replays the original repro, asserts the fixed result and captions it. All 15 checks pass. The editing pass (`videos/after/00-editing-pass.mp4`) found no off-screen caret while holding ↓/↑ through the whole note; before, there were 13 off-screen samples.

| #   | Fix                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `lineCommand` applies a minimal per-line edit and maps the selection through it, instead of selecting the rewritten lines. It also scrolls the caret into view (fixes 15). Cmd+Shift+8 on a task now makes a plain bullet.                                                         |
| 2   | `headingSelectionGuard` returns its clamped selection with `sequential: true`.                                                                                                                                                                                                     |
| 3   | A Mermaid fence without its closing ` ``` ` is not rendered.                                                                                                                                                                                                                       |
| 4   | A selection endpoint at a heading's line start is kept when the selection extends past that line (zones carry `lineTo`).                                                                                                                                                           |
| 5   | `prosemark-core/lineBoundary.ts`: Home/End/Cmd-←/→ use CodeMirror's boundary move but fall back to the document line's boundary when it would go the wrong way.                                                                                                                    |
| 6   | Block reveal on ↑/↓ dispatches with `scrollIntoView`. List Enter/Backspace/Tab do too.                                                                                                                                                                                             |
| 7   | Empty ordered items exit like bullets (`emptyOrderedItemAt`, shared `exitEmptyItem`).                                                                                                                                                                                              |
| 8   | `markdown({ htmlTagLanguage: html({ autoCloseTags: false }) })`.                                                                                                                                                                                                                   |
| 9   | Block reveal keeps the caret's column on the block's first or last line. It falls back to the boundary for widgets that stay folded (Mermaid), so typing never lands in hidden source.                                                                                             |
| 10  | No image preview while the selection touches the URL.                                                                                                                                                                                                                              |
| 11  | `blockQuoteEnter`: Enter on an empty `> ` steps out one level, keeping a separator.                                                                                                                                                                                                |
| 12  | Tab/Shift-Tab renumber an ordered item for the list it joins.                                                                                                                                                                                                                      |
| 13  | `leaveIndentedBlank`: Enter on an indentation-only line after a blank line clears it.                                                                                                                                                                                              |
| 14  | Quote bars are built in `update`, not in a measure write; this was a new finding, since they lagged one update behind. List padding adds `--cm-quote-indent`. Indented code shares `isCodeBlockNode`. Escapes are unstyled. Autolink brackets are hidden. H4–H6 step down in size. |
| 16  | The wrong "Insert line above" row was removed from `docs/keyboard-shortcuts.md`.                                                                                                                                                                                                   |

**Not fixed:**

- Feature gaps: Obsidian `[!note]` callouts, rendering inline `<kbd>`/`<mark>`, footnotes, `#tag` styling.
- HTML block bodies are still auto-indented by two spaces (lang-html's indent service).
- When a closed Mermaid block is the last thing in the note, the caret after it is drawn as a tall bar beside the widget.

## Method

- **Where:** `apps/playground/?full`, a new playground mode that mounts the desktop app's complete `createEditorExtensions` (tables, math, Mermaid, HTML blocks, wiki links, search, clipboard). Before this, the playground only mounted the core subset. It ran in headless Chromium through Playwright, so it was **not WKWebView**. Tauri-backed features were not exercised: local image files, the native clipboard menu, opening links, the frontmatter panel and the search overlay UI.
- **How keys were sent:** Playwright `keyboard.type` / `keyboard.press`, which are real CDP key events going through CodeMirror's input handling, at 12–70 ms per key with pauses to "notice" typos.
- **Human model:** after each Enter, the typist reads what the editor auto-inserted (`- `, `2. `, `> `, indentation). It keeps the prefix if it matches what it meant to write, uses Tab / Shift-Tab to fix indentation, and otherwise backspaces the auto-insert away. To leave a list it presses Enter on the empty item. When a line still came out wrong, the mismatch was logged and the harness rewrote that line so later sections typed on clean ground.
- The harness and repro scripts are not in the repo. They lived in the session scratchpad and can be recreated on request.

## Findings

Severity: **High** means data loss, a broken feature or a crash. **Medium** means writers will hit it in normal use. **Low** means polish.

| #   | Severity | Finding                                                                                                                                                        | Video                                           |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | High     | List/quote/task shortcuts leave the whole line selected, so the next Enter or keystroke **deletes the line**                                                   | `08-list-shortcut-then-enter-deletes-line.mp4`  |
| 2   | High     | Heading shortcuts Cmd+Alt+1…6 do nothing and throw `RangeError`                                                                                                | `03-heading-shortcuts-do-nothing.mp4`           |
| 3   | High     | Typing a Mermaid block by hand: after the first letter, the text lands outside (above) the block                                                               | `06-mermaid-typing-kicks-caret-out.mp4`         |
| 4   | High     | Cmd+A → Backspace on a note starting with a heading leaves `# ` behind                                                                                         | `01-select-all-delete-leaves-hash.mp4`          |
| 5   | Medium   | End key jumps the caret _backwards_ in a wrapped paragraph with an escape and a link; End+Enter splits the paragraph                                           | `02-end-key-jumps-backwards.mp4`                |
| 6   | Medium   | Arrow ↑ into a Mermaid/`<details>`/display-math block leaves the caret off-screen (up to ~500 px); ↓ into a table/math/Mermaid leaves it below the bottom edge | `11-arrow-up-into-block-widget-loses-caret.mp4` |
| 7   | Medium   | Ordered lists exit badly: 1 item → Enter makes the list loose; 2+ items → no blank line, next paragraph glued to the last item                                 | `04a-…`, `04b-…`                                |
| 8   | Medium   | HTML tags auto-close in prose; typing the closing tag yourself duplicates it, and content gets auto-indented                                                   | `07-html-tag-autoclose-duplicates.mp4`          |
| 9   | Medium   | Arrowing into a table or display math puts the caret at column 0 (before `\|`); typing corrupts the row                                                        | `10-arrow-into-table-caret-column-0.mp4`        |
| 10  | Medium   | An image URL is fetched on every keystroke while typed (30 requests for one URL, including DNS for `https://p/`, `https://pl/`, …)                             | `12-image-url-fetched-every-keystroke.mp4`      |
| 11  | Low      | Leaving a blockquote takes two Enters on an empty `> ` (lists take one)                                                                                        | `05-blockquote-needs-two-enters-to-exit.mp4`    |
| 12  | Low      | Tab / Shift-Tab in an ordered list don't renumber (`3.` sub-item, outer list resumes at `4.`)                                                                  | `13-ordered-list-tab-keeps-number.mp4`          |
| 13  | Low      | Enter on an indented blank line keeps the indent, leaving whitespace-only lines                                                                                | `14-enter-leaves-whitespace-only-lines.mp4`     |
| 14  | Low      | Rendering gaps: lists in quotes, callouts, indented code, inline HTML, escapes, H4–H6, autolinks, footnotes, tags                                              | `15-rendering-gaps.mp4`                         |
| 15  | Low      | Formatting commands don't scroll the caret into view                                                                                                           | (typing session, 1:23–1:27)                     |
| 16  | Low      | `docs/keyboard-shortcuts.md` lists Cmd+Shift+Enter twice (Task list and "Insert line above")                                                                   | n/a                                             |

### 1. List/quote/task shortcuts select the whole line, and the next key deletes it (High)

**Repro:** type `Buy oat milk`, press Cmd+Shift+Enter (task), then press Enter. The line, task text included, is replaced by a blank line. The same happens with Cmd+Shift+8 (bullet), Cmd+Shift+7 (numbered) and Cmd+Shift+. (quote), and with any key typed next. The pass reproduced it in every context tried (only line, after a heading, after a paragraph) and at every delay (100 ms and 2 s). It also happened unnoticed in the long run: both shortcut-made lines silently vanished from the note (`screenshots/06-task-lists.png`, empty gap under the tasks).

**Cause:** `lineCommand` in `apps/desktop/src/components/editor-area/markdown-formatting.ts:173` returns `EditorSelection.range(newFrom, newTo)`, which selects the whole transformed line. The highlight is visible, but "make it a task, then Enter for the next task" is the natural flow, and it destroys the text. Cmd+Z restores it.

**Suggested fix:** keep a collapsed caret collapsed, shifted by the prefix delta (or map the old range through the change). Keep a range only when the user had one.

### 2. Heading shortcuts throw and do nothing (High)

**Repro:** type a paragraph and press Cmd+Alt+3 (or 1/2/4/5/6). Nothing changes, and the console shows `RangeError: Position 45 is out of range for changeset of length 41`. Cmd+Alt+0 (paragraph) works. It fails at the end of the line, mid-line, and in a one-line doc.

**Cause:** two bugs interact.

1. `lineCommand` selects the whole line (finding 1), so the new anchor sits at the line start, inside the new heading's hash "no-go zone".
2. `headingSelectionGuard` (`heading-decorations.ts:300`) clamps it and returns `[tr, { selection }]` without `sequential: true`. CodeMirror then reads that selection in _start_-document coordinates and maps it through the changes again, which overflows the old document length. The whole transaction is dropped.

**Suggested fix:** add `sequential: true` to the override spec. The guard is meant to catch every doc-changing transaction that lands in a zone (undo, paste, commands), so this latent crash isn't limited to heading shortcuts. Fixing finding 1 also removes this trigger.

### 3. A Mermaid block can't be typed by hand (High)

**Repro:** at the end of a note, type ` ```mermaid `, press Enter, then type `graph TD`. After the `g`, the still-unclosed block renders as a diagram widget (`Diagram error: Invalid mermaid header: "g"`). The caret jumps above the block, so `raph TD` and every following line land in the paragraph above. In the long run the whole diagram ended up as one garbled line before the fence (`typed-note-result.md`, line 158).

**Likely cause:** `mermaid-decorations.ts` folds a fence whose closing ` ``` ` hasn't been typed yet (the block runs to the end of the document), and the fold moves the selection out of the replaced range.

**Suggested fix:** don't fold an unclosed fence, or keep the block unfolded while the selection is inside or adjacent to it, the way math and tables unfold.

### 4. Select All + Delete can't clear a note that starts with a heading (High)

**Repro:** open a note whose first line is `# Title`, press Cmd+A, then Backspace. The result is `# `, not an empty note. Cmd+A selects from offset **2**: the heading guard clamps the select-all anchor out of the hash zone. Anything typed next becomes an H1.

**Suggested fix:** don't clamp an endpoint when the range covers the whole zone, so only carets and endpoints that would land _inside_ the hashes get clamped.

### 5. End jumps backwards in a wrapped paragraph (Medium)

**Repro:** put the caret at the very end of `…an escaped \*asterisk\*, and a [link to the CommonMark spec](https://…).` (wrapped over 2–3 visual lines) and press End. The caret moves back to just before the second `\*`. End + Enter then splits the paragraph mid-sentence (video). Bisecting showed it needs **both** a hidden escape and a folded link on the wrapped tail; either one alone is fine. It is probably CodeMirror's `moveToLineBoundary` measuring coordinates across the replace decorations.

### 6. Arrow keys into block widgets lose the caret (Medium, verify in WKWebView)

**Repro (↑):** with the caret on `## Raw HTML` near the top of the window, press ↑. The caret moves onto the Mermaid block's closing fence, the block unfolds to source, and the caret ends up **469–524 px above the window**. It stays there; the view never follows. Display math showed −53 to −199 px and `</details>` −40 to −69 px. In one case ↑ even scrolled the page _down_ by 96 px.

**Repro (↓):** entering a table, display math, Mermaid or `<details>` from above leaves the caret 20–40 px below the bottom edge.

Every run was deterministic. Unfolding changes the block's height after the scroll target was computed. This was measured with the window as the scroller (playground), so confirm it in the app's `EditorScrollContainer`.

### 7. Ordered lists don't exit like bullet lists (Medium)

- **One item:** after `1. Only step`, Enter gives `2. `. A second Enter **inserts a blank line and keeps `2. `**, which makes the list loose. A third Enter finally exits (`04a`).
- **Two or more items:** Enter on the empty `3. ` exits, but without the blank-line separator that bullets get (`listExitSeparator`). The next paragraph is then a lazy continuation of item 2 and renders indented inside it (`04b`). This is the bug already fixed for bullets.

### 8. HTML tag auto-close fights hand-typed HTML (Medium)

Typing `<details>` auto-inserts `</details>` after the caret. Enter then indents the body by two spaces. A writer who types their own `</details>` at the end gets a duplicate (`  </details>\n</details>`). In the long run `<summary>…</summary>` also came out as `…</summary></summary>`, and `</details>` came out as `</details>details>`. For a markdown editor, consider turning off tag auto-close (and auto-indent) in HTML blocks, or skip-over-typing of an existing closing tag.

### 9. Arrowing into a table lands at column 0 (Medium)

From mid-paragraph above a table, ↓ ↓ ↓ ↓ walks the rows at **column 0**, before the leading `|`, no matter where the caret started. Typing there produces `Lists | wip |` _outside_ the row syntax (video). Display math behaves the same (`$$` at column 0). Preserving the goal column, or landing inside the first cell, would make keyboard editing of tables safe.

### 10. Image URLs are fetched on every keystroke (Medium)

Typing `![A placeholder](https://placehold.co/600x200/png)` triggered **30** image loads. Seven were local lookups for the partial relative paths `h`, `ht`, … `https:/` (`asset://…/h`). Twenty-three were remote, for `https://p/`, `https://pl/`, … The remote ones mean DNS lookups for made-up hosts, which reach the network while the writer is still typing. A broken-image preview flickers as each request fails. Suggested fix: resolve the image only once the closing `)` exists and the caret has left the node, or debounce.

### 11–16. Lower-severity notes

- **11, blockquote exit:** Enter on an empty `> ` turns it into a `>` spacer line plus a new `> `. Only a second empty Enter leaves the quote, removing the spacer. Lists exit on the first one. This is CodeMirror's default `insertNewlineContinueMarkup` behaviour, but it is inconsistent with Writer's list handling.
- **12, ordered list renumbering:** Tab on `3. ` gives `  3.` (a sub-list starting at 3; it should be `1.`). Shift-Tab from the sub-list gives `4. ` instead of `3. `.
- **13, whitespace-only lines:** in a loose list item's second paragraph, and in an indented code block, Enter keeps the indent and Enter again keeps it again. Blank lines end up as `  ` / `    ` in the file, and Enter alone can't leave the item.
- **14, rendering gaps** (`15-rendering-gaps.mp4`, `screenshots/08-blockquotes.png`, `13-html.png`, `15-rules-and-misc.png`):
  - A list inside a quote renders its bullets left of the quote bar. In the long note the bar disappears for those lines altogether.
  - `> [!note]` callouts render `!note` as an orange link.
  - Indented (4-space) code blocks render as normal prose.
  - Inline `<kbd>` / `<mark>` show as raw, coloured tags, while block `<details>` renders as a widget.
  - An escaped `\*` renders as an accent-coloured `*`, so it looks like a styled marker rather than plain text.
  - H4, H5 and H6 are identical in size and close to body size.
  - Autolink angle brackets `<https://…>` stay visible.
  - Footnotes render as `^1` links.
  - `#tag` in body text is unstyled.
- **15, no scroll after formatting commands:** `lineCommand` dispatches without `scrollIntoView`. Near the bottom of the window, after Cmd+Shift+Enter / Cmd+Shift+8, the caret sat partly or fully below the viewport until the next keystroke.
- **16, docs:** `docs/keyboard-shortcuts.md` lists Cmd+Shift+Enter as "Task list" _and_, under the CodeMirror section, as "Insert line above". CodeMirror's default keymap has no such binding, and the key does make a task, so the second row should go.

## What worked well

- **Typing basics:** typing paragraphs, and fixing typos with Backspace mid-word.
- **Inline shortcuts:** Cmd+B / Cmd+I / Cmd+E / Cmd+K on a word selected with Alt+Shift+←.
- **Bullet lists:** auto-continue, Tab / Shift-Tab nesting three levels deep, and exiting with a blank line.
- **Task lists:** auto-continue, clicking a checkbox toggles `[ ]` ↔ `[x]` including nested (the caret jumps to that line's marker), and Alt+↑/↓ moves a line.
- **Code fences:** auto-indent and syntax highlighting (js / python / bash), and horizontal scrolling for long lines.
- **Tables:** typed row by row, they render with alignment, inline code, bold and links in cells.
- **Math:** inline and display KaTeX render, and `$5` / `$10` stay prose.
- **Blocks and links:** `<details>` widget, remote image, wiki links, three kinds of horizontal rule, unicode and emoji, long URL wrapping.
- **Undo / redo:** both behave word-wise as expected.
