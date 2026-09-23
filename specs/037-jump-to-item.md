# Jump to Item (flash-style)

**Status**: Implemented (P1)

## Description

A [flash.nvim](https://github.com/folke/flash.nvim)-style jump: press `s`, and a short
label appears over each target — cards (and sub-tasks) and lane headers. Type the label
and the cursor lands there. It turns "scroll/arrow to that card" into two or three
keystrokes, which matters on a dense board.

Two flavours of one mechanism, chosen by how much is on screen. Up to 25 targets — the
size of the label alphabet — every one is labelled at once and a single keystroke lands:
the cheapest thing that works. Past that the labels would all need two keys, and two keys
fill the whole glyph slot they sit in, so the badge runs into the issue key and a board
full of them reads as noise. There the jump narrows first: type what you are looking for,
matches keep their single-key labels, everything else fades.

## Capabilities

### P1 — Must Have

- **`s` starts a jump.** With **25 or fewer visible targets**, every one gets a label
  from an easy-to-type key sequence (home-row first) and the next keystroke lands. The
  label overlays the target's fixed-width glyph slot (the type/status glyph, or a lane
  header's chevron) as a bright inverse badge — so it never shifts the layout — and the
  rest of the text dims to a backdrop.
- **More targets than label keys → narrow first.** A `jump ▸` prompt takes the bottom
  line (the slot the other prompts use, so nothing moves), and what you type is matched
  against each target's key and summary — a lane header against its own text. Every match
  takes a single-key label; matches past the alphabet stay unlabelled rather than growing
  a second key, since one more typed character is easier to read than a two-key badge on
  everything.
- **The screen fades, the matches don't.** While narrowing, every color on the board is
  blended toward the background — cards, lane headers, tags, avatars, status badges — and
  each match steps back out of it at full strength, carrying its label. Blending rather
  than switching to one flat dim color keeps each color's identity, so the board still
  reads as itself behind the search. The fade rides a context, because the colors are
  chosen in the leaves (an avatar chip, a label tag) that know nothing about jumps.
- **The match is shown, not just implied**: the typed text is picked out inside the key
  or summary that matched it, the way flash highlights the match in the buffer. Without
  it a label is an assertion you have to take on trust.
- **A keystroke is never ambiguous.** A key that could *continue* what you typed — at any
  occurrence, in any match — is never handed out as a label. So every key either narrows
  or lands, and which one it does is decided before you press it. Backspace takes a
  character back and, on an empty query, leaves; `esc` and `↵` cancel.
- **Type to select.** Typing the label moves the cursor to that target and exits jump
  mode; while labelling everything, a wrong key (no label matches the prefix) or `Esc`
  cancels.
- **Targets**: board cards (including sub-tasks, in every layout), lane headers, and
  list-view rows. Landing on a lane header selects the header; on a card, the cell.
  While the viewer is up ([057](./057-detail-navigation.md)) the targets are its link
  rows instead — the board behind it is not what you can see — and a pick moves the
  viewer's own cursor.
- Works in board and list views; reuses the existing cursor so everything after the
  jump (move, rank, edit) behaves normally.

### P2 — Should Have

- ~~Dim the non-label text (flash "backdrop") so the labels pop.~~ **Done** — the label
  overlays the glyph slot (no layout shift) and surrounding text dims.
- Restrict the target set to the current column/lane on a modifier, for a tighter jump.
- Label ordering biased toward the viewport centre / cursor, so nearby jumps are the
  shortest labels.

### P3 — Nice to Have

- Jump-then-act: `s`+label followed by an action (open, assign) without a separate
  keystroke.
- Remembered last jump for a quick repeat.

## Out of Scope

- **Fuzzy** matching while narrowing: the search is a plain substring, like flash's, so
  what you type is what is on screen. Fuzzy ranking is the filter bar's job
  ([020](./020-filter-and-search.md)), which is a different question — it changes what the
  board shows, where this only moves the cursor.
- Cross-board jump — labels only the active board's visible targets.

## Technical Notes

- **Labels** (`utils/jump.ts`): `jumpLabels(count)` returns uniform-length, distinct,
  prefix-free codes from a home-row-first alphabet (excluding `s`, the trigger).
  `searchMatches`/`searchLabels` back the narrowing flavour: substring match over each
  target's text, then one label per match from the same alphabet minus every character
  that could continue the query.
- **Live state, not the render's** (`useJump.ts`): a typed word arrives as several key
  events inside one tick, so the handler reads the jump from a ref that every transition
  writes. Reading it from the render closure narrowed the *previous* query on every key
  after the first, and dropped the second key of a two-key label typed at speed.
- **State** in `App`: `{ input, labels: Map<key,label>, laneKeys: Set<key> }`. Targets
  are gathered from the rendered `lanes` (headers + every card cell) or list `rows`,
  in reading order, so a card key and a lane key never collide (a parent-lane header
  isn't also a cell). Keystrokes narrow by prefix; an exact match runs `executeJump`,
  which uses `locate()` (board) or the row index (list) to move the cursor.
- **The backdrop** (`components/Fade.tsx`): a context carrying "faded here", and a blend
  toward `theme.bg`. A matching row re-opens the scope around its own subtree. A row that
  does that must not read the hook for its *own* colors — the hook reads the scope the
  row sits in, not the one it opens around its children, which is the bug that made every
  match render faded the first time.
- **Rendering**: a shared `JumpGlyph` span, threaded as a `jumpLabels` map through
  `Board`/`Swimlane`/`Column` → `Card`/`ChecklistCard` and `ListView`; each looks up
  its own key. It occupies the same two cells as the glyph it replaces (a one-char
  label is padded), so the layout never shifts; the label is a bright inverse badge and
  the surrounding text dims while a jump is active.

## File Structure

| File | Change |
|------|--------|
| `src/utils/jump.ts` (+ test) | Label generation |
| `src/components/JumpTag.tsx` | The label badge span |
| `src/App.tsx` | Jump state, `s` trigger, key handling, `executeJump` |
| `src/components/Board.tsx` / `Column.tsx` / `Swimlane.tsx` | Thread `jumpLabels` |
| `src/components/Card.tsx` / `ChecklistCard.tsx` / `ListView.tsx` | Render the badge |
| `src/components/ShortcutHelp.tsx` | List the `s` jump |

## Open Questions

- **`s` vs JQL search** ([025](./025-jql-search.md), unbuilt) once claimed `s`. Jump
  took it; JQL search will need another key (e.g. `S`-prefixed or the palette) if built.
