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
  session would have restored anyway. Closing it leaves a normal running lane.
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
  stays.

## Technical Notes

- `parseOpenArgs` is pure and lives in `src/cli.ts`, so the rule is testable without a
  terminal. The key shape is what Jira allows for a project key plus a number.
- `App` takes the key as `initialIssue` and opens it once on mount through `whenLoaded`,
  which is what fetches an off-board issue and reports a failed one.

## File Structure

| File | Change |
|------|--------|
| `src/cli.ts` | `parseOpenArgs` |
| `src/index.tsx` | The `open` subcommand |
| `src/App.tsx` | `initialIssue` prop, opened on mount |
