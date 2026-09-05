# NFR: Performance & Responsiveness

**Status**: Draft

## Requirement

The TUI must feel instant. Local interactions (cursor movement, moving a card, opening a
detail view) render on the next frame; network work never blocks input or rendering.

## Criteria

- Keyboard navigation produces a visible response within one render frame — no perceptible lag.
- No synchronous network or disk I/O on the keyboard-input path.
- All Jira calls are async; the UI stays interactive while they are in flight.
- Writes (card moves) are optimistic: the UI updates immediately and reconciles with the
  server result afterward (see [../006-card-movement](../006-card-movement.md)).
- Board state is derived with memoised grouping so re-renders stay cheap as issue count grows.

## Notes

- The one-source-of-truth grouping (`useMemo` over `board.tasks`) already established in
  [../002-board-view](../002-board-view.md) is the baseline; keep derivations pure and cheap.
- If large boards become slow, virtualise card rendering per column rather than adding caches.
