# Collapse Columns

**Status**: Implemented (P1)

## Description

On-demand **column collapse**: shrink a board column to a narrow vertical strip that
shows only its status name (stacked top-to-bottom) and card count, reclaiming the
horizontal space for the columns you're working in. Toggle it with `c` on the column
under the cursor; `⇧C` expands every column again.

The motivating use: boards with many statuses (or long ones like a done/archive column)
crowd the screen. Collapsing the ones you're not touching — often the edges — lets the
active columns breathe without filtering anything out. The cards are hidden, not gone:
the count stays visible and expanding restores them.

## Capabilities

### P1 — Must Have

- **Toggle current column**: `c` collapses/expands the column the cursor is in (board
  view only). Works from a cell or a lane header — it acts on `cursor.column`.
- **Expand all**: `⇧C` clears every collapse (escape hatch when several are folded).
- **Collapsed strip** (flat `none` grouping): a full-height narrow strip showing a `▸`
  chevron, the status title stacked one char per row, and the count. The cursor can
  rest on it (highlighted) and `c` expands it again.
- **Navigation**: `h`/`l` still step onto a collapsed column (so it's reachable to
  expand); a collapsed column is a single vertical stop per lane for `j`/`k`. No card is
  focused while the cursor is on a collapsed column, so issue actions are no-ops there.

### P2 — Should Have

- **Swimlane cells**: in grouped/swimlane views the per-lane cells are too short for a
  stacked title, so a collapsed cell shows the compact `▸` + count only. The strip is
  never the tallest cell, so it doesn't stretch the lane.

### P3 — Nice to Have

- Persist collapsed columns in the session ([033](./033-cached-boot-and-refresh.md)) so
  the layout survives a restart (today it resets on relaunch, like lane folds).
- A "collapse all but current" focus gesture.

## Out of Scope

- Filtering — collapse hides cards visually but keeps them in the model and the count;
  it is not a `/` query.
- Lane (swimlane) folding — that's the existing `z…` chord ([grouping]); this is the
  orthogonal horizontal axis.
- Reordering or hiding columns permanently — collapse is a transient view state.

## Technical Notes

- **State**: `collapsedColumns: Set<string>` (column ids) in `useBoardCursor`, mirroring
  the lane `collapsed` set. `focusedKey` is `null` when `cursor.column` is collapsed, and
  `columnPositions` yields one stop per lane for a collapsed column (cards hidden), so the
  existing vertical-nav / edge-detection walk handles it without special cases.
- **Trigger**: bare `c` (`collapseColumn`) and `⇧C` (`expandAllColumns`) in the keymap,
  gated to board view. `c` never clashes: the `z c` fold-close is resolved in the
  `zPending` block before bare keys run.
- **Render**: `Column` gains a `collapsed` prop. Collapsed columns switch from
  `flexGrow` to a fixed narrow `width`; `tall` (flat) columns draw the stacked-title
  strip, swimlane cells draw the compact chevron+count.

## File Structure

| File | Change |
|------|--------|
| `src/useBoardCursor.ts` | `collapsedColumns` state, `collapseColumn`/`expandAllColumns`, collapsed-aware `focusedKey`/`columnPositions`/`moveCursorColumn` |
| `src/useBoardKeymap.ts` | `c` / `⇧C` handlers + context fields |
| `src/App.tsx` | Thread state + actions; add to scroll-into-view deps |
| `src/components/Board.tsx` | Pass `collapsedColumns` through both grouping paths |
| `src/components/Swimlane.tsx` | Per-column `collapsed` prop |
| `src/components/Column.tsx` | `collapsed` prop + strip rendering |
| `src/components/ShortcutHelp.tsx` | List `c / ⇧C` |

## Open Questions

- Should collapse persist per board and across restarts? Left transient for now to match
  lane folds (P3).
