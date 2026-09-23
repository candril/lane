# Change Type

**Status**: Implemented

## Description

Type was the one field lane could set but never correct. `^T` picks it in the quick-add
prompt ([019](./019-quick-create.md)), and after that the issue is a bug forever — a story
filed as a task, a task that turns out to be a bug, and you are back in the browser.

This is the same field editor as every other: a picker over the types the issue could be,
optimistic, over a selection as well as one issue ([056](./056-bulk-edit.md)).

## Decisions (as built)

- **Only within the issue's own level.** Jira changes `issuetype` through a plain field
  write for types at the same level of the hierarchy — story, task and bug for each other.
  Turning an issue into a sub-task or an epic (or back) is Jira's *Move* wizard: a
  re-parenting with its own screens, not a field write, and not something the REST API
  offers. So a sub-task and an epic have nothing to offer and the command is not there.
- **No key binding.** Every other field editor earned a letter by being used daily; this
  one corrects a mistake made at create time. It lives in the command palette
  ([010](./010-command-palette.md)), where it is discoverable and cheap, and a binding can
  follow if it turns out to be reached for often.
- **Type is a display field here, not a workflow.** Jira may reject a change whose workflow
  or required fields disagree; that surfaces as the usual failed-write toast and the card
  snaps back.

## Capabilities

### P1 — Must Have

- **`Change type of SHOP-1…` in the palette**, descending into a picker over the types the
  issue may take: story, task and bug, minus the one it already is — which is
  pre-selected, as the other pickers pre-select the current value.
- **Over a selection** ([056](./056-bulk-edit.md)) the command reads `Change type of 3
  issues…` and writes each issue, per-issue revert, one toast. Sub-tasks and epics in the
  selection are skipped, and the toast says how many were left alone.
- **Offered only where it can act**: a source whose provider can't write the type, or an
  issue that is a sub-task or an epic, doesn't show the command.
- **Optimistic**: the card's glyph changes at once and reverts on failure
  ([nfr/004](./nfr/004-reliability-and-errors.md)). Under the `type` grouping
  ([009](./009-swimlanes.md)) the card moves to its new lane with it.

### P2 — Should Have

- A key binding, if the palette route proves too slow in practice.

## Out of Scope

- **Converting to or from a sub-task or an epic** — Jira's Move wizard; see Decisions.
- **Creating the type mapping**: which Jira type name each of lane's types means is board
  config already ([015](./015-configuration.md), `issueTypes`).

## Technical Notes

- `BoardProvider.setType(key, type)` is optional, like the other field writes. Jira writes
  `fields.issuetype.name`, through the same `PUT /rest/api/3/issue/{key}` as a rename, with
  the configured name for that type.
- The picker, the palette submenu and the write follow the status editor exactly
  ([041](./041-set-status.md)): `retyping` in `useDialogs`, a `type` submenu kind, and
  `submitType`/`bulkSetType` in `useBoardMutations`.

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts`, `jira.ts`, `mock.ts` | `setType` |
| `src/useBoardMutations.ts` | `submitType`, `bulkSetType` — optimistic, per-issue revert |
| `src/useDialogs.ts` | `retyping` handle |
| `src/App.tsx` | Type items, the picker, the palette submenu and the write |
| `src/commands/builder.ts`, `types.ts`, `run.ts` | The `Change type…` command and its submenu |
