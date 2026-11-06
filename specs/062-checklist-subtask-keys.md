# Checklist Sub-task Keys

**Status**: Implemented

## Description

The `checklist` layout ([008](./008-sub-tasks.md)) leaves the issue key off its sub-task
rows, which is right while reading it as a to-do list and wrong when a sub-task has to be
referred to by its number: in a commit message, a branch name, a conversation. Until now
that meant opening the viewer or switching layout just to read a key.

`t k` joins the tag chord ([039](./039-card-decoration-visibility.md)) and shows the key
before each row's summary.

## Capabilities

### P1 — Must Have

- **`t k` toggles keys on checklist sub-task rows**, off by default so the layout stays
  as dense as it was. Per tab, like the tags, and restored with the session.
- A row shows `✓ SHOP-413 Summary`: the key muted so the summary still leads, brighter on
  the focused row, struck through with the summary on a done one. A sub-task still being
  created shows the same placeholder as a card ([059](./059-optimistic-create.md)).
- A narrowing jump ([037](./037-jump-to-item.md)) picks its match out of the key too.

### P2 — Should Have

- **`subtask_keys` under `[display]`** sets the starting state.
- The palette offers "Show / Hide sub-task keys" where checklist rows are actually drawn:
  a board in the checklist layout, not grouped by parent.

## Out of Scope

- **`t a`.** It stays "all tags". A key is an identifier rather than a tag, and sweeping
  it in would turn keys on for everyone stripping or restoring their tags.
- **Other layouts, parent grouping and the list view** always show the key, so there is
  nothing to toggle. `t k` still flips the tab's setting there, ready for a switch to the
  checklist.

## Technical Notes

- Rides the `TagVisibility` context beside `epics` and `labels`, with `subtaskKeys` on the
  tab's `Projection`, since [ChecklistCard](../src/components/ChecklistCard.tsx) already
  reads it. No provider or data-model change.
