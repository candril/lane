# Open an Issue from the Command Line

**Status**: Implemented

## Description

Other tools name an issue and want to hand it over: a terminal popup showing a ticket, a
script, a notification. `lane view` ([007](./007-card-detail-view.md)) prints the issue but
leaves nothing to act on, and plain `lane` lands on the board with the search still to do.
`lane open <issue-key>` starts the TUI with that issue's detail view already up.

## Capabilities

### P1 — Must Have

- **`lane open <issue-key>` starts on the detail view** of that issue, over the board the
  session would have restored anyway.
- **`q` quits lane from that view**, drilled into a link or not. A diff page still takes `q`
  for itself first, as it does everywhere.
- **`⌫` is the only key that closes it for the board.** It walks back up any links followed,
  and from the root lands on the first tab in its default view, dropping any filter, mode or
  grouping that tab had; that reset is saved like any other change to a tab. From there lane
  runs normally. `esc` still clears a visual range or filter but doesn't leave, and `↵`
  on the issue itself does nothing.
- **Asking for another tab or view still leaves the viewer**, as in [057](./057-detail-navigation.md):
  it is an explicit request for that place, and lands there rather than on the first tab.
- **An issue the board doesn't hold opens too**, through the same fetch the viewer's links
  use ([057](./057-detail-navigation.md)) — the caller has no idea which board holds what.
- **A malformed or missing key is a usage error**, reported on the normal screen with a
  non-zero exit, before any Jira call or TUI.
- **An issue that can't be fetched leaves you on the board with a toast**, the way any other
  failed open does, rather than ending the program.

## Out of Scope

- Printing an issue: `lane view`.
- Reusing a lane that is already running. Each call is its own process; finding and driving
  another instance is the caller's concern, and nothing has needed it.
- Switching to a tab that holds the issue. The viewer works over any tab, so the restored one
  stays until `⌫` leaves it.

## Technical Notes

- `parseOpenArgs` is pure and lives in `src/cli.ts`, so the rule is testable without a
  terminal. The key shape is what Jira allows for a project key plus a number.
- `App` takes the key as `initialIssue` and opens it once on mount through `whenLoaded`,
  which is what fetches an off-board issue and reports a failed one. `startedOnIssue` is set
  only once the issue is up and clears when the viewer closes, so a failed open is an ordinary
  board and later viewers behave normally.

## File Structure

| File | Change |
|------|--------|
| `src/cli.ts` | `parseOpenArgs` |
| `src/index.tsx` | The `open` subcommand |
| `src/App.tsx` | `initialIssue` prop, opened on mount; `startedOnIssue`, `returnToFirstTab` |
| `src/useBoardKeymap.ts` | `q` and `esc` in that mode |
| `src/useIssueDetail.ts` | `back` reports whether it left the viewer |
