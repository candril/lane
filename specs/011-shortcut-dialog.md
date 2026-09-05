# Keyboard Shortcut Dialog

**Status**: Implemented — `?` opens a centered modal of bindings grouped by area
(Navigation / View / Issue / Boards / General); `esc` / `?` / `q` dismiss. No help
bar. (P2 context-awareness — reflecting only the currently-valid bindings — not yet.)

## Description

There is **no persistent helper status bar**. Keyboard shortcuts are instead discoverable
through a **dialog** — an overlay that lists the available bindings — opened on demand (e.g.
`?`). This replaces the always-visible `HelpBar` from the initial scaffold.

> This supersedes the help-bar decision in [002-board-view](./002-board-view.md) and the
> discoverability principle in [000-vision](./000-vision.md). `HelpBar.tsx` (built) is to be
> removed when this lands.

## Capabilities

### P1 — Must Have

- A key (e.g. `?`) opens a modal dialog listing keyboard shortcuts.
- The dialog is dismissible (`Esc` / `?` / `q`) and returns focus to the board unchanged.
- No shortcut hints occupy permanent screen space — the board uses the full height.

### P2 — Should Have

- Shortcuts grouped by area (Navigation, Issue, View).
- Context-aware: reflect the bindings valid in the current state.

## Out of Scope

- Rebindable keys / a config-driven keymap (monq has this; not yet scoped here).
- A cheatsheet for palette commands — those are discoverable in the palette itself
  ([010-command-palette](./010-command-palette.md)).

## Technical Notes

- Reuses the overlay/dialog pattern (absolute-positioned, themed modal), consistent with the
  command palette and other dialogs.
- Discoverability now comes from two places only: this dialog and the `Ctrl+P` palette.

## File Structure

| File | Change |
|------|--------|
| `src/components/ShortcutHelp.tsx` | New: shortcut dialog overlay |
| `src/components/HelpBar.tsx` | Remove |
| `src/App.tsx` | Dialog open state + `?`; drop `<HelpBar>` from layout |
