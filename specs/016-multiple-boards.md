# Multiple Boards & Board Tabs

**Status**: Draft — query swimlanes (P2) + board tabs/switching (P1) done

## Decisions (as built)

- **Query-based swimlanes** are implemented as a `swimlanes` grouping in the `g`
  cycle (shown only when the board defines `[[boards.swimlanes]]`). Evaluated
  **client-side, first-match**: each root falls into the first lane whose JQL it
  matches (empty JQL = catch-all), rendered flat by column like `type`. The
  matcher (`src/jql/match.ts`) covers the swimlane subset — `labels` / `priority`
  / `assignee` / `type` / `status` with `= != ~ IN "NOT IN" "IS [NOT] EMPTY"` and
  AND/OR/NOT; unsupported predicates no-match rather than throw. Chose client-side
  over per-lane queries to avoid N round-trips and the 100-cap per query.
- Multi-board **tabs** and switching (P1) are built: the header renders a tab per
  board (active highlighted); `1`–`9` jump directly and `[`/`]` cycle. Each board
  carries its own provider; a board loads lazily on first activation and caches its
  snapshot, so switching back is instant. The active board's view resets to its
  config default on switch, and the cursor resets (lane/column layout differs).
- **Jira is the default data source**; the mock is behind `--mock` (or the fallback
  when Jira is unreachable). Previously the mock was the default and `--jira` opted in.

## Description

Support several boards at once, shown as **tabs in the header**. Each board is a config entry
([015](./015-configuration.md)) with its own JQL query defining which issues it contains, and
optionally its own swimlane definition and default view.

## Capabilities

### P1 — Must Have

- Load all boards from config; render a **tab per board in the header**, active tab highlighted.
- Switch the active board (key bindings — e.g. `[`/`]` or `1`–`9` — and via the command palette
  [010](./010-command-palette.md)).
- Each board's issues come from its `jql`, fetched through the provider
  ([005](./005-jira-provider.md), `jira issue list -q "<jql>"`).
- Switching boards shows that board's issues, columns, and swimlanes. Columns are
  currently instance-wide (`[jira].columns`); making them per-board so mixed-project
  tabs render correctly is [030](./030-per-board-columns.md).

### P2 — Should Have

- **Per-board swimlanes by query**: a board may define named swimlanes each with a JQL
  predicate (Jira's "base swimlanes on queries"), instead of the default group-by-type
  ([009](./009-swimlanes.md)). An issue falls into the first swimlane whose predicate it matches.
- Per-board default view ([017](./017-view-modes.md)).
- Lazy load: fetch a board's issues on first activation; cache until refreshed.

### P3 — Nice to Have

- Reorder tabs; per-board refresh; a "board picker" for many boards.

## Out of Scope

- Creating/editing boards from inside the app (boards are config — edit the file, or import via
  [018](./018-import-jira-board-config.md)).
- Cross-board operations (moving an issue between boards).

## Technical Notes

- The header's single board name ([002](./002-board-view.md)) becomes a **tab bar**; reuse the
  tab pattern from monq/presto (`TabBar`).
- Board state grows from one `Board` to a set keyed by config board; the active board id is
  app state. Each board caches its last-fetched `Board` snapshot.
- Query-based swimlanes are evaluated **client-side by falling into the first matching
  predicate**, OR by running each swimlane's JQL as a separate query — decide during
  implementation (client-side avoids N queries but needs the fields the predicates reference).
- The `Board` domain type is unchanged; boards are a layer above it (a set of `Board`s + tabs).

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` | `BoardConfig` (name, jql, swimlanes?, view?) |
| `src/components/TabBar.tsx` | New: board tabs in the header |
| `src/App.tsx` | Active-board state, per-board cache, switch bindings |
| `src/providers/jira.ts` | Fetch a `Board` for a given board config (its JQL) |
