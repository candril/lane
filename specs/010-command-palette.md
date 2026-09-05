# Command Palette

**Status**: Implemented (P1 + the P2 field submenus; grouped sections, state-aware list,
key hints. Pending: fuzzy-jump to an issue from the same prompt, command history.)

## Description

A `Ctrl+P` fuzzy command palette — the way to reach an action without knowing its key,
mirroring monq's. Every action that has a direct binding is reachable here, and the four
field editors (status, assignee, epic, labels) open as **submenus inside the palette**
rather than throwing you back to the board.

The palette does not replace the bottom-bar editors ([027](./027-assign-issue-to-user.md),
[028](./028-change-labels.md), [038](./038-change-epic.md), [041](./041-set-status.md)).
Two surfaces, deliberately: a direct key wants one row of chrome and no context switch,
while the palette wants room to list and explain. They share the list behaviour
(`usePickList`), the row builders (`labels.ts`, the candidate arrays App already builds)
and — the part that matters — the same write. Nothing is a second implementation.

## Capabilities

### P1 — Must Have

- **`Ctrl+P` opens** a centered overlay: a fuzzy-filtered command list over a query
  field. `↑/↓` (and `^p`/`^n`) move, `Enter` runs, `Esc` closes, `^P` closes again.
  `⇧P` opens it as well — the alias for the one place `^P` means something else, the
  viewer, where `^N`/`^P` walk its items ([057](./057-detail-navigation.md)).
- **State-aware**: a command that can't act right now is absent, so `Enter` never lands
  on a no-op — issue commands need a focused issue, "clear filter" needs a filter, an
  ad-hoc tab is the only kind that can be renamed or closed, the view you are in is not
  offered as a destination.
- Each command shows its **direct key** right-aligned, so the palette teaches the
  binding while you use it.
- **Grouped sections** — Issue, View, Board, Tabs, General — in a fixed order.

### P2 — Should Have

- **Submenus** for the field editors: choosing "Set status of SHOP-1…" replaces the row
  list with that field's candidates, the palette title becomes `status SHOP-1`, and `Esc`
  backs out one level instead of closing (riff's spec-042 model). The pick submenus mark
  the field's present value `◉` and open the highlight on it; the labels submenu is
  multi-select — `Space` toggles, `Enter` commits, and a typed label that matches nothing
  offers `＋ add "…"`, exactly as the bottom-bar editor does.
- A submenu discards its working set when you back out, so `Esc` is always safe.

### P3 — Nice to Have

- Fuzzy-jump to any loaded issue by key or summary from the same prompt (VS Code's
  primary use of `Ctrl+P`). Overlaps `s` ([037](./037-jump-to-item.md)) and `:`
  ([046](./046-global-search.md)), so it needs a story about which one wins.
- Command history / recents, and a `>`-style mode prefix if the prompt gains jump duty.
- Render the shortcut dialog ([011](./011-shortcut-dialog.md)) *from* the command
  registry, so the two lists cannot drift.

## Out of Scope

- User-defined or scripted commands.
- Commands that aren't reachable by a key — the palette is a second door, not a place
  for functionality to hide.

## Technical Notes

- `commands/types.ts` holds `Command` (`id`, `label`, `category`, `shortcut?`,
  `submenu?`) and `CommandContext` — **state only**, so `buildCommands(ctx)` in
  `commands/builder.ts` is pure and its visibility rules are asserted directly, without
  stubbing two dozen callbacks.
- Behaviour is keyed by id in `commands/run.ts`: `runCommand(id, actions)` where
  `CommandActions` is the App handlers the direct keys already call. presto puts
  `execute(ctx)` on the command itself and hosts every sub-dialog inside the palette
  component; that is how its `CommandPalette.tsx` reached 1800 lines, so the split stays.
- `usePickList` owns query + highlight for the palette, the picker and the label editor:
  the clamp against a list that shrinks as you type, the reset-to-top on each keystroke,
  and the `↑/↓`/`^p`/`^n` bindings. It takes the row count through `rows(count)` because
  the caller can only filter once it has the query.
- The palette is **remounted per mode** (`key={submenu?.kind ?? "commands"}`) so each
  descent starts with an empty query and its own initial highlight. Resetting the query
  in an effect instead does not work: the input echoes its old value back through
  `onInput` as the value changes, which drags the highlight off the current value.
- `useBoardMutations`' `submit*` take the issue key outright instead of reading a dialog
  handle, which is what lets one write serve both surfaces.

## File Structure

| File | Change |
|------|--------|
| `src/commands/types.ts` | New: `Command`, `CommandCategory`, `SubmenuKind`, `CommandContext` |
| `src/commands/builder.ts` | New: `buildCommands(ctx)` — the state-aware list |
| `src/commands/run.ts` | New: `runCommand(id, actions)` — id → App handler |
| `src/components/CommandPalette.tsx` | New: the overlay, command + submenu modes |
| `src/usePalette.ts` | New: open state, one level of descent, the labels working set |
| `src/usePickList.ts` | New: query + highlight shared by all three list overlays |
| `src/labels.ts` | New: label row building, shared by editor and submenu |
| `src/components/Picker.tsx` | Uses `usePickList` |
| `src/components/LabelEditor.tsx` | Uses `usePickList` + `labelRows` |
| `src/useBoardMutations.ts` | `submit*` take the key; no dialog handles |
| `src/useBoardKeymap.ts` | `^P` opens it; the palette owns the keyboard while open |
| `src/App.tsx` | Palette state, command context, submenu candidates, routing |
