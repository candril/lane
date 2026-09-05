# Grid Cursor Navigation (Empty Cells)

**Status**: Draft

## Description

Today the cursor is a `{ column, task }` position and can only land on cards, so moving `h/j/k/l`
across a sparse board takes detours around empty columns and cells. This feature makes the cursor a
true **grid position**: every cell — including empty ones — is selectable, so a keypress always
moves exactly one step in the pressed direction. Refines
[003-keyboard-navigation](./003-keyboard-navigation.md).

## Capabilities

### P1 — Must Have

- The cursor is a **grid position** (column, and row/lane), independent of whether a card occupies
  it. `h` / `l` always move one column; `j` / `k` always move one row within the column (or across
  lanes, [009](./009-swimlanes.md)) — no skipping to the next non-empty cell.
- A selected **empty cell** shows the focus treatment (the `—` placeholder is highlighted), so the
  position is always visible.
- Card-specific actions — move ([006](./006-card-movement.md)), quick edit
  ([013](./013-quick-field-edit.md)), issue actions ([014](./014-issue-actions.md)), status toggle
  ([023](./023-status-toggle.md)) — are enabled only when the selected cell holds a card; on an
  empty cell they are no-ops and hidden from the palette (state-aware,
  [010](./010-command-palette.md)).
- `H` / `L` still move the focused card; on an empty cell there is nothing to move.

### P2 — Should Have

- **Create on an empty cell**: the contextual create ([019](./019-quick-create.md)) uses the empty
  cell's column (and lane parent in [009](./009-swimlanes.md)) as the target status/parent —
  select an empty cell, then create, as the natural "add here" gesture.
- Sensible clamping at board edges and where a column/lane has fewer rows; remember the column when
  moving vertically past a short column (generalising [003](./003-keyboard-navigation.md)'s clamp
  rule to the grid).

### P3 — Nice to Have

- An optional **compact** navigation mode that skips empties, for anyone who preferred the old
  behaviour (toggle / config [015](./015-configuration.md)).

## Out of Scope

- 2-D free movement that ignores column structure — movement stays column/row aligned.
- Selecting column headers or lane headers *as grid cells* (a lane header is its own selectable
  thing in [009](./009-swimlanes.md)).

## Technical Notes

- Change the cursor model from `{ column, taskIndex }` to a **grid coordinate** —
  `{ columnId, row }` (plus lane in [009](./009-swimlanes.md)) — where a cell resolves to a card or
  empty. Navigation math operates on the column/lane **geometry**, not on the task list, so empties
  are first-class. This generalises [003](./003-keyboard-navigation.md)'s clamp ("empty columns hold
  the cursor at index 0") to "every cell is a valid position".
- The focused-card lookup becomes "card at cursor cell, or none"; downstream actions guard on
  presence.
- In swimlane mode the grid is **per lane**; `j` / `k` cross lane boundaries coherently — 009 P1
  already asks for j/k behaviour at lane edges to be defined, and this spec supplies the
  empty-cell-aware rule.
- Purely local view state; no provider impact
  ([nfr/001-performance](./nfr/001-performance.md)).

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | Grid cursor model (`columnId`, `row`, lane); nav math over geometry; guard card actions on empty |
| `src/components/Column.tsx` | Focus treatment on an empty selected cell (`—` placeholder) |
| `src/components/Swimlane.tsx` | Per-lane grid coordinates; `j` / `k` across lane edges |
