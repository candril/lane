---
title: Configuration
description: Every key in ~/.config/lane/config.toml.
---

lane reads a single TOML file:

```
$XDG_CONFIG_HOME/lane/config.toml      # ~/.config/lane/config.toml
```

It is optional, and lane only ever reads it. If it exists but is malformed, lane names the
offending key and carries on rather than crashing or silently ignoring it:

```
config (boards[1].columns[0].statuses): expected an array of strings
```

Keys are `snake_case`. `[jira]` and at least one `[[boards]]` entry are required; everything
else has a default.

## A complete example

```toml
[jira]
project = "SHOP"
story_points_field = "customfield_10016"
sprint_field = "customfield_10020"
default_resolution = "Done"
backlog_statuses = ["To be discussed", "In refinement"]

  [jira.issue_types]
  subtask = "Technical task"

  [[jira.columns]]
  title = "To Do"
  statuses = ["Open", "Ready"]

  [[jira.columns]]
  title = "In Progress"
  statuses = ["In Progress"]

  [[jira.columns]]
  title = "In Review"
  statuses = ["In Review", "Ready to Deploy"]

  [[jira.columns]]
  title = "Done"
  statuses = ["Resolved", "Closed"]

[[boards]]
name = "Team Board"
jql = "project = SHOP AND cf[10001] = 1f0c4a2e ORDER BY Rank ASC"
grouping = "parent"
search_scope = "project = SHOP"

  [boards.create_defaults]
  components = ["Checkout Platform"]
  custom = { customfield_10001 = "1f0c4a2e-7b3d-4e8f-9a6c-2d5e8f1a3b7c" }

  [[boards.swimlanes]]
  name = "PO/UX stream"
  jql = "labels in (UX, PO)"

  [[boards.swimlanes]]
  name = "Everything else"
  jql = "labels not in (UX, PO) OR labels is EMPTY"

[[boards]]
name = "Epics"
jql = "project = SHOP AND (type = Epic OR parent in (SHOP-100, SHOP-200)) ORDER BY Rank ASC"
grouping = "parent"

[[boards]]
name = "Web & Apps"
jql = "project in (WEB, APP) AND (sprint in openSprints() OR sprint in futureSprints())"
grouping = "sprint"
sprint_board_id = 42

[display]
subtasks = "own-column"
children = "all"
epics = true
labels = true

[refresh]
interval = 60
on_focus = true

[filters]
b = "type:bug -is:done"
m = "@me"
```

## `[jira]`

Instance-wide provider settings, shared by every board.

| Key | Type | Description |
| --- | --- | --- |
| `project` | string, **required** | The project a created issue is filed into, and the one a bare issue number in `:` resolves against. |
| `columns` | array of tables, **required** | The fallback columns — see [Columns](#columns). At least one. |
| `story_points_field` | string | Custom field id carrying the estimate, e.g. `customfield_10016`. Shown as `5 pts`. |
| `sprint_field` | string | Custom field id carrying an issue's sprints, e.g. `customfield_10020`. Enables the `sprint` grouping and sprint-aware backlog. Unset on a kanban-only instance. |
| `default_resolution` | string | The resolution a close carries when none is picked — what a plain `⇧L` into Done sends. Defaults to `Done`. |
| `epic_link_field` | string | The field carrying an issue's epic link. Defaults to `parent` (Jira's unified hierarchy); set it to a custom field id on classic projects still using the old Epic Link. |
| `backlog_statuses` | array of strings | Statuses kept off every board — see [Backlog statuses](#backlog-statuses). |
| `issue_types` | table | Issue-type name overrides — see [Issue type names](#issue-type-names). |

:::note
Leaving `epic_link_field` unset on an instance that *doesn't* use `parent` means the epic link
is never read at all: no epic tags, no `epic:` filter, no epic grouping.
:::

### Columns

A column is a title and the Jira statuses that fold into it, in display order.

```toml
[[jira.columns]]
title = "In Review"
statuses = ["In Review", "Ready to Deploy"]
```

A status mapped to no column falls into the first one — unless it's listed in
`backlog_statuses`, which is exactly what that key is for.

### Backlog statuses

Statuses that belong to a board's backlog rather than to a column: Jira's Kanban backlog.
Issues in them are kept off the board and shown by the backlog view (`v k`) instead of landing
in the first column and pretending to be started.

```toml
backlog_statuses = ["To be discussed", "In refinement"]
```

Declaring them on a board also gives that board a backlog tab.

### Issue type names

Jira's type names vary by project and scheme — a sub-task is `Technical task` on one board and
`Subtask` on another — so the name lane sends when creating is configurable. Omitted kinds fall
back to the standard names.

```toml
[jira.issue_types]
story = "Story"
bug = "Bug"
task = "Task"
epic = "Epic"
subtask = "Technical task"
```

## `[[boards]]`

One entry per tab, in config order. At least one is required.

| Key | Type | Description |
| --- | --- | --- |
| `name` | string, **required** | The tab label. Elided past 20 characters. |
| `jql` | string, **required** | The JQL defining the board's issues. |
| `view` | `board` \| `list` \| `backlog` | The view this tab opens in. |
| `grouping` | `none` \| `parent` \| `type` \| `swimlanes` \| `sprint` | The grouping it opens in. |
| `sprint_board_id` | number | The Jira board whose sprints count, from the board's URL. Without it, sprints from every board an issue reports make a lane — and two boards routinely name theirs the same. |
| `default_resolution` | string | Overrides `jira.default_resolution` for this board. |
| `search_scope` | string | JQL a `:` search starts inside while this tab is active. `^A` drops it. |
| `project` | string | Overrides `jira.project` for this board. |
| `columns` | array of tables | Overrides `jira.columns` for this board. |
| `backlog_statuses` | array of strings | Overrides `jira.backlog_statuses` for this board. |
| `issue_types` | table | Merged over `jira.issue_types`. |
| `jira_config` | string | Path to a `jira` YAML this board authenticates against — see below. |
| `create_defaults` | table | Fields stamped onto issues created from this board. |
| `swimlanes` | array of tables | Query swimlanes — see below. |

`grouping` matters more than it looks: an epic board is read flat, with epics as cards and their
issues inside them, while a work board is usually read by parent. The default belongs to the
board, not to the app.

### Per-board columns and project

`columns` and `project` per board are what make mixed-project tabs work: each board renders
against its own workflow, and a created issue is filed into its own project.

### Per-board Jira instance

A board can authenticate against a different Jira:

```toml
[[boards]]
name = "Ops"
jql = "project = OPS ORDER BY Rank ASC"
jira_config = "~/.config/.jira/ops.yml"
```

The file is a `jira` CLI YAML; lane reads `server:` and `login:` from it. A leading `~/`
expands. The API token still comes from `JIRA_API_TOKEN` — it is never read from a file.

### Create defaults

Fields stamped onto every issue created from this board, which is what keeps `n` a
one-keystroke, headless create instead of a form:

```toml
[boards.create_defaults]
components = ["Checkout Platform"]
labels = ["team-checkout"]
priority = "Medium"
custom = { customfield_10001 = "1f0c4a2e-7b3d-4e8f-9a6c-2d5e8f1a3b7c" }
```

`custom` takes Jira field ids and sends the value verbatim — that's how you stamp the Team field
so a new card actually matches the board's own JQL and shows up on it.

### Swimlanes

```toml
[[boards.swimlanes]]
name = "PO/UX stream"
jql = "labels in (UX, PO)"
```

Matched locally against the loaded issues, in order. Give the last lane a catch-all `jql` (an
empty string is allowed) if you want everything to land somewhere. `lane import` cannot scaffold
these — Jira's public Agile API doesn't expose a board's swimlane definitions.

## `[display]`

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `subtasks` | `own-column` \| `under-parent` \| `checklist` \| `basket` | `own-column` | Where sub-tasks sit — see [Views & Tabs](/lane/reference/views/#sub-task-layouts). `v o/u/c/g` switches per tab. |
| `children` | `all` \| `hide-done` \| `none` | `all` | Which children a board draws. `v a/d/n` switches per tab. |
| `epics` | boolean | `true` | Show epic tags on cards. `t e` toggles live. |
| `labels` | boolean | `true` | Show label tags on cards. `t l` toggles live. |

## `[refresh]`

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `interval` | number | `60` | Seconds between background polls. `0` disables the poll. |
| `on_focus` | boolean | `true` | Refresh when the terminal regains focus. |

## `[filters]`

Quick filters: a single letter `a`–`z` mapped to a filter query, applied to the active board
with `f`+letter. Instance-wide — the same chord works on every board.

```toml
[filters]
b = "type:bug -is:done"
m = "@me"
u = "#UX -is:done"
```

The value uses the [filter grammar](/lane/reference/filtering/#the-grammar), not JQL.

## Environment

| Variable | Description |
| --- | --- |
| `JIRA_API_TOKEN` | **Required.** Your Atlassian API token. Never read from a file. |
| `JIRA_CONFIG_FILE` | Path to the `jira` YAML holding `server:` and `login:`. Defaults to `~/.config/.jira/.config.yml`. |
| `XDG_CONFIG_HOME` | Where `lane/config.toml` is looked for. Defaults to `~/.config`. |
| `XDG_CACHE_HOME` | Where the board cache and session state are written. Defaults to `~/.cache`. |
| `XDG_STATE_HOME` | Where your own tabs are saved. Defaults to `~/.local/state`. |
