# Jump to Item (flash-style)

**Status**: Implemented (P1)

## Description

A [flash.nvim](https://github.com/folke/flash.nvim)-style jump: press `s`, and every
visible target — cards (and sub-tasks) and lane headers — gets a short label overlaid
on it. Type the label and the cursor lands there. It turns "scroll/arrow to that card"
into two or three keystrokes, which matters on a dense board.

No search/filter step is required (unlike flash's default): labels appear on
everything visible at once, and typing selects.

## Capabilities

### P1 — Must Have

- **`s` starts a jump.** Every visible target gets a label from an easy-to-type key
  sequence (home-row first). The label overlays the target's fixed-width glyph slot
  (the type/status glyph, or a lane header's chevron) as a bright inverse badge — so
  it never shifts the layout — and the rest of the text dims to a backdrop. Single-char
  labels while they fit, otherwise uniform two-char labels so none is a prefix of another.
- **Type to select.** Typing the label moves the cursor to that target and exits jump
  mode; a wrong key (no label matches the prefix) or `Esc` cancels.
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

- Fuzzy text search to narrow targets before labelling (flash's search mode) — this is
  label-everything-at-once; text search is the filter bar's job
  ([020](./020-filter-and-search.md)).
- Cross-board jump — labels only the active board's visible targets.

## Technical Notes

- **Labels** (`utils/jump.ts`): `jumpLabels(count)` returns uniform-length, distinct,
  prefix-free codes from a home-row-first alphabet (excluding `s`, the trigger).
- **State** in `App`: `{ input, labels: Map<key,label>, laneKeys: Set<key> }`. Targets
  are gathered from the rendered `lanes` (headers + every card cell) or list `rows`,
  in reading order, so a card key and a lane key never collide (a parent-lane header
  isn't also a cell). Keystrokes narrow by prefix; an exact match runs `executeJump`,
  which uses `locate()` (board) or the row index (list) to move the cursor.
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
