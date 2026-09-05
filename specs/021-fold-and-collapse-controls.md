# Fold & Collapse Controls

**Status**: Draft

## Description

Vim-fold-style keyboard controls for collapsing and expanding **swimlanes**
([009](./009-swimlanes.md)) and the **sub-task tree** in list view
([017](./017-view-modes.md)). 009 already defines a per-lane collapse chevron and a
collapse/expand-all (P3); this spec defines the *ergonomics* — the `z`-prefixed fold keys — and a
single, consistent collapse model shared by both disclosure surfaces.

## Capabilities

### P1 — Must Have

- `za` **toggles** the fold of the swimlane under the cursor (open ↔ closed). A collapsed lane
  shows only its header ([009](./009-swimlanes.md)).
- `zo` **open** / `zc` **close** the lane under the cursor explicitly.
- `zR` open **all** lanes / `zM` close **all** lanes — the [009](./009-swimlanes.md) P3
  collapse/expand-all, bound to the fold keys.
- Folds are view state in `App` (a set of collapsed lane keys), not a data change; cursor
  navigation skips a collapsed lane's columns, while its header stays selectable.

### P2 — Should Have

- The same fold keys drive the sub-task **tree** in list view ([017](./017-view-modes.md)):
  `za` / `zo` / `zc` on a parent row toggle its children (the disclosure `▸` / `▾`), and
  `zR` / `zM` expand / collapse all parents — unifying the two disclosure controls under one
  keymap.
- Preserve a lane's collapsed state across a grouping-key switch when the lane still exists.

### P3 — Nice to Have

- `zA` recursive toggle — a no-op equivalent to `za` today (folds are one level deep), reserved in
  case nested folds ever exist.
- Default-collapsed lanes from config ([015](./015-configuration.md)).

## Out of Scope

- Folding individual columns or cards — since shipped as their own specs:
  columns in [040](./040-collapse-columns.md), a card's sub-tasks in [042](./042-fold-subtasks.md),
  which is where the board-side `z a/o/c` behaviour is now specified.
- Fold persistence across sessions beyond config defaults.

## Technical Notes

- **One collapse model** shared by [009](./009-swimlanes.md) swimlanes and
  [017](./017-view-modes.md)'s list tree: a `Set<string>` of collapsed keys (lane parent key /
  list parent key) in `App` view state. The chevron (009) and the disclosure (017) reflect and
  toggle the same set. Rendered rows filter out the contents of collapsed keys; the cursor walks
  visible rows/columns only (017 tech notes).
- The `z` prefix is a **two-key chord**: hold a pending-prefix state after `z`, then dispatch on the
  next key (`a` / `o` / `c` / `R` / `M`). Normalise keys as `App` already does — some terminals
  send an uppercase name with the shift flag unset (see `CLAUDE.md` / `App.tsx` keymap note), which
  matters for `zR` vs `zr`.
- Purely presentational — no provider interaction.

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | `z`-prefix chord handling; collapsed-keys `Set`; toggle/open/close/all actions; cursor skip |
| `src/components/Swimlane.tsx` | Reflect collapsed state via the chevron (shares the set) |
| `src/components/ListView.tsx` | Reflect collapsed state via the disclosure (shares the set) |
| `src/commands/builder.ts` | Palette entries: collapse / expand all |
