# Per-Board Columns

**Status**: Done

## Description

Columns — the status→column mapping that defines the board's lanes — should be defined
**per board**, not once instance-wide. Today `[jira].columns`
([015](./015-configuration.md)) is shared by every board, so two boards on different
projects or workflows can't both render correctly: a board whose statuses aren't in the
shared column set drops its cards. Surfaced while adding a playground board (a `SANDBOX`
project) whose workflow differs from the primary board's.

A board should carry its own columns; the instance-wide set becomes a **default/fallback**
so existing single-project configs keep working unchanged.

## Capabilities

### P1 — Must Have

- A `[[boards]]` entry may define its own ordered `columns` (`{ title, statuses }`), used
  when that board is active — the same shape as `[jira].columns`
  ([015](./015-configuration.md)).
- When a board omits `columns`, fall back to `[jira].columns` (backward compatible).
- The active board's columns drive the grid, the status→column fold, and the card-move
  targets ([006](./006-card-movement.md)) — nothing else in the UI changes (it already
  reads columns from the loaded `Board`).

### P2 — Should Have

- **Per-board project**: make the project key per board too (the instance `[jira].project`
  becomes the default), so created-issue key detection (`<PROJECT>-\d+`,
  [005](./005-jira-provider.md)) and creation work on a board from another project.
  `create_defaults` is already per board ([015](./015-configuration.md)), so this closes
  the matching gap for multi-project tabs ([016](./016-multiple-boards.md)).
- Import ([018](./018-import-jira-board-config.md)) scaffolds a board's `columns` from the
  real Jira board.

### P3 — Nice to Have

- A validation warning when a board's loaded statuses don't map into any of its columns
  (would-be-hidden cards), rather than silently dropping them.

## Out of Scope

- Live column discovery from Jira at runtime — the `jira` CLI can't read a board's config
  ([018](./018-import-jira-board-config.md)); columns stay hand-defined.
- Changes to the `Board` / `Column` domain types — the UI is already per-board-safe (it
  takes columns from the loaded `Board`); this is purely a **config → provider** change.

## Technical Notes

- `BoardConfig` gains optional `columns?: ColumnConfig[]` (and P2 `project?: string`);
  `JiraSettings.columns` / `.project` remain the fallback. Validate per-board columns by
  reusing `parseColumns`.
- `boardToJiraConfig(jira, board)` resolves `board.columns ?? jira.columns` (and
  `board.project ?? jira.project`); the created-key regex and provider `project` follow
  the active board.
- No UI work: `App` / `columnMeta` already derive from the loaded `Board.columns`, so once
  the provider builds the right columns the board renders correctly.

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` | `columns?` (+ P2 `project?`) on `BoardConfig` |
| `src/config/validate.ts` | Parse/validate per-board columns (+ project); reuse `parseColumns` |
| `src/providers/jira.ts` | `boardToJiraConfig` uses board columns/project with instance fallback |
| `config.example.toml` | Document per-board `[[boards.columns]]` |
