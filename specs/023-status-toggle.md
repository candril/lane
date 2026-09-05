# Status Toggle (Cards & Swimlane Parents)

**Status**: Draft

## Description

Fast status changes without opening a picker: **cycle** the focused card's status forward/back
along the board's columns, and **toggle the swimlane parent's own status** from the lane header
([009](./009-swimlanes.md)). This complements the picker in
[013-quick-field-edit](./013-quick-field-edit.md) and the `H`/`L` move in
[006](./006-card-movement.md) / [003](./003-keyboard-navigation.md) — the *same* underlying Jira
transition, with faster ergonomics for the common "advance this / mark done" step.

## Capabilities

### P1 — Must Have

- **Toggle/advance a card's status**: a binding cycles the focused card to the next column-status,
  and a shifted binding to the previous, performing the Jira transition
  ([006](./006-card-movement.md)). This is `H`/`L`'s transition, reachable when you think in "next
  status" rather than "move right".
- **Toggle a swimlane parent's status** from the lane header ([009](./009-swimlanes.md)): with the
  lane header focused, the same binding transitions the **parent's own status** (the header badge),
  not a card position.
- Both are **optimistic with revert-on-failure** and respect **valid Jira transitions only**
  ([006](./006-card-movement.md) / [013](./013-quick-field-edit.md)).
- **Toggle done**: a binding that advances directly to the board's Done status (and back to the
  prior/first status), for the common complete/reopen action.

### P2 — Should Have

- Cycle **wraps or clamps** sensibly at the first/last status (decide at implementation); if the
  next transition is not legal, skip to the next legal one, or no-op with feedback.
- Reachable from the command palette ([010](./010-command-palette.md)) and shown in the shortcut
  dialog ([011](./011-shortcut-dialog.md)).
- A **pending/in-flight** visual state while the transition runs ([006](./006-card-movement.md) P2).

### P3 — Nice to Have

- A configurable "toggle" target status per board ([015](./015-configuration.md)) — e.g. a
  two-state toggle between an active and a done status.

## Out of Scope

- Choosing an **arbitrary** target status — that is the [013](./013-quick-field-edit.md) picker.
- **Bulk** status changes across cards, or across a whole lane's sub-tasks at once.
- Re-parenting or moving between lanes ([008](./008-sub-tasks.md) / [009](./009-swimlanes.md)).

## Technical Notes

- The card toggle reuses `moveFocusedCard` / the [006](./006-card-movement.md) transition, but
  computes the next/prev status from the board's **column order** instead of a left/right column
  move. The swimlane-parent toggle reuses the same provider transition against the **parent** issue
  (its status is the [009](./009-swimlanes.md) header badge, not a column). Both go through the
  `jira` CLI `issue move` ([005](./005-jira-provider.md)).
- **Toggle done** resolves the board's Done column (the last column, or a configured done status) as
  the target.
- Legal-transition handling matches [006](./006-card-movement.md) / [013](./013-quick-field-edit.md):
  the CLI rejects an illegal transition → treat as failure and revert; if the CLI can list an
  issue's transitions, use it to pick the next legal status.
- Against the mock provider, mutate in-memory status so the card / lane header updates immediately.

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | Status-cycle actions (card + lane-parent); next/prev/done resolution; wire to the transition |
| `src/providers/jira.ts` | (shared with [006](./006-card-movement.md)) transition via `jira issue move`; list transitions if available |
| `src/components/Swimlane.tsx` | Lane-header status-toggle target (the parent badge) |
| `src/commands/builder.ts` | Palette entries for advance / regress / toggle-done |
