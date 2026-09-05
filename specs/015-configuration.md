# Configuration

**Status**: Implemented (P1)

## Decisions (as built)

- TOML at `~/.config/lane/config.toml` (`$XDG_CONFIG_HOME/lane/`), parsed with
  `Bun.TOML`. Loaded once at startup; missing → mock board; invalid → a clear
  `config (key): …` error, then mock.
- `[jira]` holds instance settings (`project`, `story_points_field`,
  `team_field`, ordered `[[jira.columns]]`); each `[[boards]]` has `name`, `jql`,
  optional `view` and `[boards.create_defaults]`. See `config.example.toml`.
- **Columns are array-of-tables** (`[[jira.columns]]`), not a `[jira.columns]`
  map — TOML tables don't guarantee key order, and column order is meaningful.
  These are **instance-wide today**; a per-board `[[boards.columns]]` override (with the
  instance set as fallback) is [030](./030-per-board-columns.md).
- Every board lives in config; without a file (or with no `[[boards]]`) lane says so
  and opens the offline demo board. Board tabs for multiple boards are [016](./016-multiple-boards.md).
- Query-based swimlanes (`[[boards.swimlanes]]`) are evaluated client-side via a
  small JQL-subset matcher (`src/jql/match.ts`) and surface as a `swimlanes`
  grouping in the `g` cycle ([016](./016-multiple-boards.md)).

## Description

A user config file that defines the app's boards and the instance-specific settings the Jira
provider needs. This is the foundation for multiple boards ([016](./016-multiple-boards.md)):
each board is a config entry.

## Capabilities

### P1 — Must Have

- Read a TOML config from `$XDG_CONFIG_HOME/board/config.toml`
  (default `~/.config/board/config.toml`), mirroring monq's convention.
- Define one or more **boards**, each with at least a `name` and a `jql` query
  ([016](./016-multiple-boards.md)).
- Define provider settings that are per-instance: the **story-points custom field** id/name and
  the **column/status order** (the open items from [005](./005-jira-provider.md)).
- Validate the config on load; on error, show a clear message naming the problem (don't crash,
  don't silently ignore).
- Run with **no config**: fall back to the mock board (offline/demo).

### P2 — Should Have

- Per-board overrides: default view ([017](./017-view-modes.md)), swimlane definition
  ([009](./009-swimlanes.md) / [016](./016-multiple-boards.md)).
- Generate/scaffold a starter config (e.g. `lane --init`), optionally from a real Jira board
  ([018](./018-import-jira-board-config.md)).

## Out of Scope

- Theme / keymap config (monq has these; not yet scoped here — can be added later the same way).
- Secrets in config — auth lives in the `jira` CLI, never here
  ([nfr/003-security-and-credentials](./nfr/003-security-and-credentials.md)).

## Technical Notes

Illustrative shape (subject to refinement):

Real ids below are from the SHOP instance (confirmed via `scripts/jira-spike.sh`); treat them as
per-instance and keep them in config, never hardcoded.

> **Team scoping matters.** Project SHOP (id 10200) is shared by ~20 teams — `sprint in
> openSprints() AND project = SHOP` returns *every* team's sprint (100+ issues, past the CLI's
> un-pageable 100 cap). A board query must filter by team via the native Team field
> `cf[10001]`, e.g. the Checkout board:
> `project = SHOP AND cf[10001] in (<team-uuid>) AND sprint in openSprints()`. Confirmed in
> `src/providers/jira.ts` (`OSA_CONFIG`).

```toml
# Instance-wide provider settings
[jira]
project            = "SHOP"
story_points_field = "customfield_10016"   # "Story point estimate" (SHOP)
team_field         = "customfield_10001"   # native Team field, for per-board team filters

# Statuses → columns. The CLI reports statuses (SHOP has 7); the board shows fewer
# columns, so several statuses fold into one column, left-to-right. Unlisted
# statuses fall back to a first-seen column. (See 005 "statuses ≠ columns".)
[jira.columns]
"To Do"       = ["Open", "Ready"]
"In Progress" = ["In Progress"]
"In Review"   = ["In Review", "Ready to Deploy"]
"Done"        = ["Resolved", "Closed"]

[[boards]]
name = "Checkout Sprint"
# Team-scoped current sprint (see note above); rank order is applied by the provider.
jql  = "project = SHOP AND cf[10001] in (1f0c4a2e-...) AND sprint in openSprints()"
view = "board"            # board | list | backlog  (see 017)

[[boards]]
name = "Bugs"
jql  = "type = Bug AND statusCategory != Done"

  # Optional: query-based swimlanes for this board (see 009 / 016)
  [[boards.swimlanes]]
  name = "Critical"
  jql  = "priority = Highest"
  [[boards.swimlanes]]
  name = "Everything else"
  jql  = ""               # catch-all
```

- Follows monq's loader pattern: `configPath()` → parse → validate → typed config object,
  resolved once at startup before the renderer mounts.
- Board `jql` is passed straight to `jira issue list -q "<jql>"`
  ([005](./005-jira-provider.md)).

## File Structure

| File | Change |
|------|--------|
| `src/config/loader.ts` | New: locate + read + parse `config.toml` |
| `src/config/types.ts` | New: config schema types (`Config`, `BoardConfig`, …) |
| `src/config/validate.ts` | New: validation with clear error messages |
| `src/index.tsx` | Load config at startup; choose boards vs mock |
