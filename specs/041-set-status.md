# Set Status

**Status**: Implemented (P1)

## Description

Set a work item's status directly from a picker, rather than only stepping it one column
at a time with `⇧H`/`⇧L`. Press `⇧S` on the focused issue to open a pick-one list of the
board's statuses (columns); choosing one transitions the issue straight there. This
mirrors the other field pickers — assign (`a`), labels (`#`), epic (`⇧E`) — so status
becomes just another field you set by picking, not only by nudging across the board.

The motivating use: on a board with several columns, moving from the first to the last is
several `⇧L` presses; and in list/backlog views there's no left/right at all. A picker is
one gesture to any status.

## Capabilities

### P1 — Must Have

- **`⇧S` opens the status picker** for the issue under the cursor (a focused card, a
  focused parent-lane header, or the list row), in both board and list views. Bare `s`
  keeps its flash-jump ([037](./037-jump-to-item.md)) — the two split on shift.
- **Pick-one of the board columns**, each shown in its status colour, with the issue's
  current status marked `◉` and highlighted first, so the picker opens on where the issue
  stands. Fuzzy-narrow by typing, ↑/↓/Enter/Esc as every picker.
- **Optimistic transition**: apply the move locally, follow the card with the cursor
  (board view), persist via `provider.moveTask`, revert on failure — the exact path
  `⇧H`/`⇧L` already take (they now share one `moveTo` primitive).

### P2 — Should Have

- Show only *reachable* statuses per the Jira workflow (valid transitions from the
  current status), once the provider can report them — today every column is offered.

## Out of Scope

- Workflow transition side effects (resolution, required fields on a transition screen) —
  a plain status set only; screens are a later provider concern.
- Sub-task-in-checklist status is still toggled in place with `⇧H`/`⇧L` (specs/008); the
  picker targets the focused issue like the other field pickers.

## Technical Notes

- **State**: a `statusing: { key } | null` dialog handle in `useDialogs`, mirroring
  `epicing`. The keymap bows out while it's open (the `Picker` owns the keyboard).
- **Mutation**: `transition` is refactored to delegate to a new `moveTo(key, toColumnId,
  onApplied?)` in `useBoardMutations`; the picker's `submitStatus` calls `moveTo` with the
  chosen column id and the same locate-and-follow callback `moveFocusedCard` uses.
- **Candidates**: `board.columns` → `PickItem` (value = column id, colour =
  `columnColor(i)`). Reuses `Picker`, passing the issue's column id as `current` — the
  picker marks and pre-selects it, the same as the assignee and epic pickers.

## File Structure

| File | Change |
|------|--------|
| `src/useDialogs.ts` | `statusing` handle |
| `src/useBoardMutations.ts` | extract `moveTo`; `transition` delegates to it |
| `src/App.tsx` | `startStatus` / `submitStatus`, candidate list, render `Picker` |
| `src/useBoardKeymap.ts` | `⇧S` trigger, picker early-return, context fields |
| `src/components/ShortcutHelp.tsx` | list `⇧S` |

## Open Questions

- Restrict to workflow-valid transitions (P2) — needs the provider to expose the
  transition graph; deferred until the Jira provider lands.
