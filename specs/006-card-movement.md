# Card Movement → Jira Status Transition

**Status**: Draft

## Description

Today `H`/`L` moves a card between columns as a **local** state change
([003-keyboard-navigation](./003-keyboard-navigation.md)). This feature makes that move
**persist to Jira** as a status transition, so moving a card on the board actually
transitions the issue.

## Capabilities

### P1 — Must Have

- On `H`/`L`, request the corresponding Jira status transition for the issue.
- Optimistic UI: move the card immediately, then reconcile with the result.
- On transition failure, revert the card to its previous column and show an error.
- Only offer moves that correspond to a valid Jira transition from the issue's current status.

### P2 — Should Have

- Confirmation for moves that are destructive or hard to undo (per the safe-mutations
  principle in [000-vision](./000-vision.md)).
- Visual "pending" state on a card while its transition is in flight.

## Out of Scope

- Reordering cards **within** a column (Jira rank) — not planned yet.
- Bulk moves.

## Technical Notes

- Depends on [005-jira-provider](./005-jira-provider.md): the transition runs through the
  `jira` CLI (`jira issue move <KEY> "<target status>"`), the same shell-out pattern as the
  rest of the provider.
- Not every status pair is reachable in Jira's workflow. The CLI rejects an invalid transition;
  treat that as a failure and revert. If the CLI can list valid transitions for an issue, use it
  to only offer legal moves; otherwise attempt-and-revert.
- Keep the optimistic-then-reconcile pattern so the board stays responsive
  ([nfr/001-performance](./nfr/001-performance.md)); the CLI call runs async and must never
  block input.

## File Structure

| File | Change |
|------|--------|
| `src/providers/jira.ts` | Add: perform transition (`jira issue move`); list transitions if available |
| `src/App.tsx` | `moveFocusedCard` triggers the async transition + revert-on-failure |
