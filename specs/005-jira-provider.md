# Jira Provider

**Status**: Draft

## Description

A provider that populates the same `Board` shape (see
[004-data-model-and-provider](./004-data-model-and-provider.md)) from real Jira data:
columns from issue statuses, cards from issues. This is the feature that turns the app from a
mock viewer into an actual Jira board.

## Decision — talk to Jira via the `jira` CLI

**Resolved:** the provider shells out to the [`jira` CLI](https://github.com/ankitpokhrel/jira-cli),
exactly the way [presto](../../../presto) shells out to `gh`. We do **not** call the Jira REST
API directly and we do **not** handle credentials ourselves — the CLI owns auth, the server
URL, and the transport.

Why this fits:

- **No auth code.** `jira init` configures server + login + API token once; the app just runs
  the CLI. Credentials never touch our process (see
  [nfr/003-security-and-credentials](./nfr/003-security-and-credentials.md)).
- **Matches the reference app.** presto's `providers/github.ts` is the template: run the CLI,
  parse its output, transform to domain types, log each call.
- **Less surface.** No HTTP client, paging, or token refresh to maintain.

Cost: depends on an external binary being installed and authenticated, and on the CLI's output
format. Both are handled below.

## Capabilities

### P1 — Must Have

- **Preflight**: on startup, verify the `jira` CLI is installed and authenticated; if not, show
  a clear error explaining how to install / run `jira init` (analogous to presto requiring
  `gh auth`). Fall back to the mock board only when explicitly requested.
- Fetch issues (JQL-filterable) and map each to a `Task`: key, summary, type, priority,
  assignee, story points, and status → `columnId`.
- Derive the board's `columns` from the set of issue statuses (ordered — see notes).
- Map the result into `Board` and hand it to the UI unchanged.
- Surface CLI failures to the UI as a clear error state
  ([nfr/004-reliability-and-errors](./nfr/004-reliability-and-errors.md)).

### P2 — Should Have

- Load issues for a given board's JQL (boards are config entries —
  [015](./015-configuration.md) / [016](./016-multiple-boards.md)).
- Manual refresh (re-run the list command).

### P3 — Nice to Have

- Common filters (e.g. "assigned to me") as JQL presets.
- Background auto-refresh.

## Out of Scope

- Writing status changes back to Jira — [006-card-movement](./006-card-movement.md).
- Create/edit — [012-create-and-edit-items](./012-create-and-edit-items.md).
- Direct REST API access / our own auth.

## Technical Notes

### Architecture (mirrors presto's `providers/github.ts`)

- Transport is Bun's shell helper: `import { $ } from "bun"`, then
  `await $`jira ${args}`.text()` / `.json()`. `.quiet()` for fire-and-forget commands.
- `src/providers/jira.ts` exposes async functions (e.g. `loadJiraBoard(...)`) returning `Board`,
  dropping into the existing `index.tsx` provider seam beside `loadMockBoard()`.
- A raw type per CLI shape + a `transform*` function to the domain type, as presto does.
- Wrap each invocation in a small request logger (presto's `logRequest`: log start, finish with
  duration, fail with message) so calls are visible in the OpenTUI console pane.

### Commands

Subcommands of `ankitpokhrel/jira-cli`. The list command is **confirmed** against jira-cli
1.7.0 / project SHOP (see the spike section below); the rest are indicative.

| Need | Command |
|------|---------|
| Preflight / current user | `jira me` |
| List issues (backlog order) | `jira issue list -q "<JQL>" --order-by rank --raw --paginate <from>:100` |
| Transition status | `jira issue move <KEY> "<status>"` — see [006](./006-card-movement.md) |
| Assign | `jira issue assign <KEY> <user>` — see [013](./013-quick-field-edit.md) |
| Create | `jira issue create ...` — see [012](./012-create-and-edit-items.md) |
| Edit | `jira issue edit <KEY> ...` — see [012](./012-create-and-edit-items.md) |
| Open in browser | `jira open <KEY>` — see [014](./014-issue-actions.md) |

### Confirmed via CLI spike (jira-cli 1.7.0, project SHOP, `scripts/jira-spike.sh`)

- **Output shape.** `issue list --raw` returns a JSON **array of `{ key, fields }`** with a
  curated, camelCased field set — *not* raw Jira REST. Map:

  | `Task` | JSON path |
  |--------|-----------|
  | `key` | `key` |
  | `summary` | `fields.summary` |
  | `type` | `fields.issueType.name` (Story / Task / Bug / **Technical task**) |
  | *is sub-task* | `fields.issueType.subtask` (bool) — the reliable discriminator |
  | `columnId` (status) | `fields.status.name` |
  | `priority` | `fields.priority.name` |
  | `assignee` | `fields.assignee.displayName` (`""`/null ⇒ unassigned) |
  | `parentKey` | `fields.parent.key` (sub-tasks only) |

  A parent also carries its children inline at `fields.Subtasks[]`, each with its own status.
- **Backlog rank order works** via the `--order-by rank` *flag*. Do **not** embed `ORDER BY Rank`
  in the JQL — jira-cli appends its own `ORDER BY`, producing a double clause that 400s. The rank
  value is not returned, so ordering is server-side only (no client-side re-sort possible).
- **Pagination is mandatory.** `--paginate` caps at 100 rows; a full sprint exceeds that. Loop
  `<from>` in steps of 100 until a page returns < 100.
- **`sprint list --current` ignores `--raw`** (emits plain TSV). Use the Search API path above,
  scoped with `sprint in openSprints()`.
- **Statuses ≠ columns.** SHOP exposes 7 workflow statuses (Open, Ready, In Progress, In Review,
  Ready to Deploy, Resolved, Closed) but the board shows ~4 columns. The CLI gives statuses, not
  board columns, so the **status→column mapping must come from config** ([015](./015-configuration.md)).

### Field mapping caveats

- **Columns** map from statuses via config. The CLI exposes issue *statuses*, not board
  *columns*, and there are more statuses than columns (7 vs ~4 in SHOP). A status→column map in
  `[jira].columns` ([015](./015-configuration.md)) groups them; unmapped statuses fall back to a
  first-seen column.
- **Story points are not in `issue list --raw`.** The curated raw field set carries no custom
  fields. To get points, fetch them explicitly — e.g. `--plain --columns key,"story point
  estimate"` (SHOP: `customfield_10016`), or a per-issue lookup. Confirm at implementation time.
- **Sub-tasks** ([008](./008-sub-tasks.md)) — parent link **confirmed** at `fields.parent.key`;
  detect a sub-task by `fields.issueType.subtask === true` (SHOP's sub-task type is
  "Technical task", so don't match on type name).

## File Structure

| File | Change |
|------|--------|
| `src/providers/jira.ts` | New: CLI shell-out, raw→`Board` transform, logging |
| `src/utils/logger.ts` | New: `logRequest` helper (port from presto) |
| `src/index.tsx` | Preflight + choose provider at the existing seam |
| `src/types.ts` | Extend only if a required field is missing |
