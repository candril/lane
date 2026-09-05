# NFR: Reliability & Error Handling

**Status**: Draft

## Requirement

The app fails visibly and recoverably. Network and Jira API failures are surfaced clearly and
never leave the board in a silently wrong state or crash the process.

## Criteria

- A failed board load shows a clear, actionable error state (not a blank screen or a stack trace).
- A failed card-move transition reverts the optimistic change and tells the user why
  (see [../006-card-movement](../006-card-movement.md)).
- Unexpected provider errors are caught at the provider boundary and mapped to a UI error,
  not thrown into the render tree.
- Quit always works, even from an error state.

## Notes

- Mirrors monq's error-view + toast approach: a full-view error for fatal load failures, and
  transient toasts for recoverable action failures. A toast/notification component is not yet
  built here — add it when the first recoverable-failure feature (card movement) lands.
- Distinguish "no data" (empty board / empty column, a normal state) from "failed to load"
  (an error state).
