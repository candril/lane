# Quick Create

**Status**: Implemented (P1 — contextual + typed create)

## Decisions (as built)

- `n` opens a bottom quick-add line (summary only), **in context** — the context
  determines the type:
  - focused **epic** → a **child issue** (story/task/bug, sticky) filed under the
    epic via Jira's `-P` (the epic link, *not* a sub-task — the card is top-level);
  - focused **story/task/bug** (or one of its sub-tasks) → a **sub-task** under it;
  - no context → the **sticky last-used** type.
  `N` (shift) forces a **top-level** issue of the sticky type, ignoring context.
  `Ctrl-T` cycles the type within the context's allowed set — `epic` is offered in
  the top-level set, so you can create an epic from the board or backlog too.
- **Epic children vs sub-tasks**: an epic's child carries `epicKey` (create-time
  epic link) and is *not* given `parentKey`, so it renders as a normal card, not a
  nested sub-task. A sub-task carries `parentKey` (the lane link). Both go through
  `-P` at the CLI ([012](./012-create-and-edit-items.md)).
- **Parent in context**: on the board, the focused card (or lane header); in the
  backlog list, the focused row's parent (a sub-task's own parent, or the root itself).
- New issues land in the **first column** (no create-then-move); optimistic was
  dropped for a simpler **pending insert** (card appears once the provider
  returns the real key). Defaults (team/component) come from board config.

## Description

Fast, keyboard-first ways to *start* a new issue, with two entry points:

1. **Contextual create from a cell** — create a sub-task under the focused lane's parent
   ([009](./009-swimlanes.md)), pre-set to the focused column's status; or, in the flat board,
   a top-level issue in the focused column's status.
2. **Typed shortcut** — create a new **Story**, **Task**, or **Bug** directly by type, from
   anywhere on the board.

This spec covers the *entry points and ergonomics*; the fuller create form and persistence
mechanics live in [012-create-and-edit-items](./012-create-and-edit-items.md). The relationship
mirrors how [013-quick-field-edit](./013-quick-field-edit.md) sits alongside 012: 019 is the fast
lane in, 012 is the machinery.

## Capabilities

### P1 — Must Have

- **Type-specific create shortcuts**: distinct bindings to start a new Story, a new Task, and a
  new Bug. Each prompts for a summary and lands the issue in a sensible default column, then hands
  off to the create path in [012](./012-create-and-edit-items.md).
- **Contextual create from the focused cell**: a binding that, in parent/swimlane mode
  ([009](./009-swimlanes.md)), creates a sub-task under the focused lane's parent pre-set to the
  focused column's status; in the flat board, creates a top-level issue in the focused column's
  status.
- Both entry points reuse [012](./012-create-and-edit-items.md)'s create action; optimistic insert
  with revert-on-failure ([nfr/004-reliability-and-errors](./nfr/004-reliability-and-errors.md)).
- Every entry point is reachable from the command palette
  ([010](./010-command-palette.md)), not only via direct bindings.

### P2 — Should Have

- **Inline `+ Create`** at the foot of a lane's column (the `+ Create` in the
  [009](./009-swimlanes.md) reference) triggers the same contextual create — this is the shared
  affordance called out in [009](./009-swimlanes.md) P2 and [012](./012-create-and-edit-items.md) P2.
- A **generic "new issue"** binding that first picks the type, for people who don't want a key per
  type; remembers the last-used type and column.

### P3 — Nice to Have

- Duplicate/"create like this" from the focused issue (copy type + parent, blank summary).

## Out of Scope

- The fuller create form — description, priority, assignee, validation — and the create/edit
  persistence details: all [012](./012-create-and-edit-items.md).
- Re-parenting or moving a created issue between lanes — [008](./008-sub-tasks.md) Out of Scope.
- Bulk create, templates, or importing issues.

## Technical Notes

- Two thin variants over [012](./012-create-and-edit-items.md)'s create action: a **type-shortcut**
  variant that pre-sets `type`, and a **contextual** variant that pre-sets `parentKey` +
  target status from the cursor. Both then run 012's path (CLI `jira issue create` with flags, or
  the interactive spawn — see 012's open question).
- The contextual variant reads the cursor position to derive its targets: in parent mode the
  focused lane's parent supplies `parentKey`, and the focused column supplies the initial status.
  Selecting an **empty cell** first is the natural "add here" gesture — see
  [022-grid-cursor-navigation](./022-grid-cursor-navigation.md).
- Defaults (column, type) when not derivable from context come from board config
  ([015](./015-configuration.md)).
- Against the mock provider, create mutates in-memory state so the new card appears immediately
  (offline dev), consistent with [012](./012-create-and-edit-items.md).

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | Create-shortcut bindings (story/task/bug) + contextual-create from the cursor; wire to the [012](./012-create-and-edit-items.md) action |
| `src/commands/builder.ts` | State-aware palette commands for each create entry point |
| `src/components/Column.tsx` | Inline `+ Create` foot affordance (shared with [009](./009-swimlanes.md)) |
| `src/providers/mock.ts` | Optimistic in-memory create for offline dev |
