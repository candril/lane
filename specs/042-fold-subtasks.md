# Fold Sub-Tasks Under a Card

**Status**: Implemented (P1)

## Description

Fold a card's **sub-tasks** away on the board: the parent card stays, its children are
hidden, and the card carries a `▸ N` marker so nothing looks lost. Driven by the existing
`z…` fold chord ([021](./021-fold-and-collapse-controls.md)) — `z a` toggles, `z o` opens,
`z c` closes the fold of the card under the cursor — plus `z ⇧M` / `z ⇧R` to fold or
unfold everything at once.

The motivating use: a board where every story has four or five sub-tasks scrolls forever.
Folding the stories you are not working on gives back the vertical space without filtering
anything out — the parents stay visible in their columns, with the child count on the card.

This is the *vertical, per-card* fold; [040](./040-collapse-columns.md) is the horizontal
per-column one, and the lane fold (also `z…`) is the per-swimlane one. They compose.

## Capabilities

### P1 — Must Have

- **Fold the card under the cursor**: `z a` toggles, `z o` unfolds, `z c` folds — the same
  letters the lane fold uses, resolved by where the cursor is (see *Which target*).
- **Fold marker**: a folded parent shows `▸ N subtasks` on the card, so the children read
  as hidden rather than absent. An unfolded parent shows nothing extra — its children are
  on screen.
- **Fold / unfold all**: `z ⇧M` folds every parent's sub-tasks (and every lane, as before);
  `z ⇧R` unfolds both. Vim semantics: those two keys act on *all* folds, at every level.
- **Cursor stays valid**: folding from a sub-task moves the cursor to its parent; a
  fold-all that hides the card under the cursor lands it on the nearest remaining card.
- **All flat layouts**: works for each `[display] subtasks` layout ([008](./008-sub-tasks.md))
  — `under-parent` and `checklist` hide the nested rows, `own-column` hides the sub-task
  cards wherever their own status put them.

### P2 — Should Have

- **Which target**: the fold acts on the focused card when it has sub-tasks, on its parent
  when the focused card *is* a sub-task (so `z c` closes the fold you are standing in), and
  falls back to the lane fold otherwise — including on a lane header, where it is unchanged.

### P3 — Nice to Have

- Persist folds in the session ([033](./033-cached-boot-and-refresh.md)); transient for now,
  like lane folds and column collapse.
- A `[display]` config default of "start folded", for people who live in a parent-only view.
- Fold in the list view — it already has its own `enter` / `h` / `l` disclosure, so the two
  would need reconciling first.

## Out of Scope

- Filtering sub-tasks out of the model — that is `-type:subtask` ([020](./020-filter-and-search.md))
  or the new scope toggle ([043](./043-subtask-filter-scope.md)). A fold keeps the sub-tasks
  in the board, the counts, and the filter results; it only hides the cards. Hiding them
  *by rule* rather than per card is [052](./052-child-visibility.md), which shares this
  spec's marker.
- Nesting deeper than one level: Jira sub-tasks are one deep, so a fold is one deep.
- Folding by epic — the epic link is a different hierarchy ([029](./029-epic-on-card.md)).

## Technical Notes

- **State**: `foldedSubtasks: Set<string>` (parent keys) in `App`, because it is an *input*
  to `buildLanes` (unlike the column collapse, which is render-only) and lane building runs
  before the cursor hook. The fold actions live in `useBoardCursor`, which owns the cursor
  fix-ups, and receive the setter.
- **Grouping**: `LaneOptions.foldedSubtasks` reaches `flatColumns`, which skips a folded
  parent's children in both layout branches. Every parent card carries `subtaskCount` (its
  children in this view) and, when it is not showing them, `hidden` ([052](./052-child-visibility.md)
  widened the old `folded` flag into a count + cause), so the renderer never has to
  re-derive the tree.
  The parent-grouped view is untouched: there the parent is the lane header, so its fold
  *is* the lane fold.
- **Cursor**: a parent always precedes its children within a cell, so folding does not
  shift the parent's own position — `locate` on the pre-fold lanes gives the cursor's
  landing spot. A clamp effect keeps `cursor.row` in range whenever the lanes shrink under
  it (fold-all, and any other narrowing).
- **Render**: `Card` gains `hidden` and draws the `▸ N` marker on its meta
  line. In the `checklist` layout a folded parent simply has no rows left, so `Column`
  renders it as a plain `Card` with the marker.

## File Structure

| File | Change |
|------|--------|
| `src/grouping.ts` | `LaneOptions.foldedSubtasks`; `BoardCard.subtaskCount` / `hidden`; `flatColumns` skips folded children |
| `src/useBoardCursor.ts` | `foldSubtasks` / `foldAllSubtasks`, target resolution, cursor clamp |
| `src/App.tsx` | `foldedSubtasks` state, thread into `laneOptions` + keymap |
| `src/useBoardKeymap.ts` | Route `z a/o/c` by cursor position; `z ⇧R`/`z ⇧M` fold both axes |
| `src/components/Card.tsx` | `▸ N subtasks` marker |
| `src/components/Column.tsx` | Pass the hidden-children marker through both the card and checklist paths |
| `src/components/ShortcutHelp.tsx` | Document the card fold |

## Open Questions

- Should a fold survive a refresh that renames or re-parents the issue? Today the set is
  keyed by issue key, so a re-parented child simply reappears — acceptable.
