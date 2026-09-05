# Keyboard Navigation

**Status**: Done

## Description

Vim-style keyboard control of the board cursor, and moving the focused card between columns.
The cursor is a `{ column, task }` position held in `App` state.

## Capabilities

### P1 — Must Have (built)

- `h` / `l` (and `←` / `→`) move the cursor between columns.
- `j` / `k` (and `↓` / `↑`) move the cursor between cards within the active column.
- `^D` / `^U` move the cursor half a screen of stops down / up, as in nvim — rows in
  a row view, the column's stops on the board — clamped at the ends. Inside the viewer
  ([057](./057-detail-navigation.md)) the same keys page the description instead.
- `gg` jumps to the top of the current column, `⇧G` to the bottom (in list view, the
  first / last row) — vim-style. `g` leads a two-key chord: `g`+letter now selects a board
  grouping directly (`gn` none, `gp` parent, `gt` type, `gs` swimlanes), replacing the old
  bare-`g` cycle — the vim "go" idiom ([009](./009-swimlanes.md)).
- `H` / `L` move the **focused card** to the previous / next column, and the cursor follows it.
- `q` / `Ctrl+C` quit.
- Cursor is clamped: moving into a shorter column snaps the task index into range; empty
  columns hold the cursor at index 0.

## Out of Scope

- Reordering cards **within** a column (vertical move).
- Configurable keybindings (monq has this via config; not yet in scope here).
- The `?` shortcut **dialog** and `Ctrl+P` palette are their own specs
  ([011](./011-shortcut-dialog.md), [010](./010-command-palette.md)); there is no persistent
  help bar in the target design.

## Technical Notes

- Raw key events are normalised before dispatch: the name is lowercased and an
  "implicit shift" is derived, because some terminals send an uppercase name (e.g. `"H"`)
  with the shift flag unset instead of shift + `"h"`. This is the same quirk monq handles
  in `utils/keymap.ts`.
- Moving a card is currently a pure local state update (change the task's `columnId`). Once
  the Jira provider exists, `H`/`L` becomes "local update + async status transition" — see
  [006-card-movement](./006-card-movement.md). The keybinding and cursor behaviour stay the same.

## Key Files

| File | Role |
|------|------|
| `src/App.tsx` | `useKeyboard` handler, key normalisation, cursor state, `moveFocusedCard` |

## Keyboard

| Key | Action |
|-----|--------|
| `h` `l` / `←` `→` | Move cursor between columns |
| `j` `k` / `↑` `↓` | Move cursor between cards |
| `gg` / `⇧G` | Jump to top / bottom of the column (list: first / last row; viewer: first / last stop) |
| `^D` / `^U` | Half a screen of stops down / up (viewer: page the description) |
| `H` `L` | Move focused card to previous / next column |
| `q` / `Ctrl+C` | Quit |
