# View Modes: Board / List / Backlog

**Status**: Draft

## Description

The same issue set can be viewed in more than one way. Beyond the Kanban **board**
([002](./002-board-view.md)), offer a **list** view and a Jira-style **backlog** view. The view
is per-board (default from config [015](./015-configuration.md)) and switchable at runtime.

> **Superseded in part**: the backlog view lands as its own *tab* rather than a `v k` mode —
> see [044](./044-board-backlog.md). The mode a tab renders in, and its filter, become per-tab
> state with [045](./045-ad-hoc-tabs.md).

## Capabilities

### P1 — Must Have

- **Board view** — the existing Kanban columns (default).
- **List view** — a sortable table of the board's issues (key, summary, type, status,
  priority, assignee, points). Keyboard navigable.
- **Expandable sub-task tree** — a parent renders as one row with a disclosure control
  (`▸` collapsed / `▾` expanded) and its sub-tasks nest as indented child rows directly beneath
  it, tree-style. Toggle a row open/closed (e.g. `Enter` / `→`·`←` on the parent); collapsed
  parents hide their children and the cursor skips them ([008](./008-sub-tasks.md)). Parent order
  is stable regardless of children.
- Switch view at runtime via the **`v` view chord** (`v b` board, `v l` list; extensible
  to `v k` backlog) + command palette [010](./010-command-palette.md); the active board
  and cursor context are preserved where sensible. (Bare `v` used to toggle board↔list; a
  chord keeps each view addressable as more than two land.)

### P2 — Should Have

- **Backlog view** — a Jira-like backlog: an ordered list of issues (optionally grouped by
  sprint/epic if available), read-only ordering for now.
- Per-board default view honoured from config.

### P3 — Nice to Have

- Sorting/grouping controls in list view.
- Reordering (ranking) in backlog view — likely its own spec if we pursue writes.

## Out of Scope

- Backlog **management** (sprint planning, drag-to-rank persistence) — visualisation first;
  ranking writes are a separate future decision.
- View-specific column configuration.

Sub-task tree in list view:

```
▾ ◆ SHOP-60411  Cancel an order        In Progress  = SL
    ▪ SHOP-60413  Update Requirement  In Progress  = SL
    ▪ SHOP-60415  Frontend            In Progress  = SL
    ▪ SHOP-60414  Backend             Done         = ·
▸ ◆ SHOP-60412  Past Packages      In Progress  = SL   (3 subtasks, collapsed)
  ● SHOP-60420  Fix resize crash   To Do        = SL   (no subtasks — no disclosure)
```

## Technical Notes

- All views render from the same `Board` snapshot; a view is a presentation choice, not a
  different data path.
- Expand/collapse is per-parent view state in `App` (a set of expanded keys), not a data change
  — collapsed children are filtered out of the rendered rows, and cursor navigation walks the
  visible rows only. A parent with no sub-tasks shows no disclosure control. Actions (quick edit [013](./013-quick-field-edit.md), issue actions
  [014](./014-issue-actions.md)) work regardless of view.
- Whether the backlog's order can be trusted depends on what the `jira` CLI exposes for rank —
  confirm during implementation ([005](./005-jira-provider.md)).

## File Structure

| File | Change |
|------|--------|
| `src/components/ListView.tsx` | New: flat table view |
| `src/components/BacklogView.tsx` | New: backlog view (P2) |
| `src/App.tsx` | Active-view state + switch bindings; route render by view |
