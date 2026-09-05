---
title: CLI
description: lane's handful of commands and flags.
---

Most of lane is the TUI. The command line is deliberately thin.

## `lane`

Open the board. Tabs come from `[[boards]]` in your config; the active tab, its view, grouping
and filter are restored from the last session.

```sh
lane
```

If Jira can't be reached, or no board is configured, lane says so on the normal screen — before
the TUI takes over, so the diagnostic renders cleanly — and opens the demo board instead. It
always starts.

### `--mock`

Run against the built-in demo board: a fictional web shop's sprint with sub-tasks, epics,
sprints, a backlog, descriptions and history, as three tabs. No credentials, no network. Edits
work and are forgotten on exit.

```sh
lane --mock
```

Good for trying the keymap, for working on lane itself, and for the docs screenshots.

### `--version`, `-v`

```sh
lane --version
```

## `lane view <issue-key>`

Print one issue as plain text — summary, type, status, priority, assignee, labels, description:

```sh
lane view SHOP-412
```

```text
SHOP-412  Rework the checkout summary
Story · In Progress · High
Assignee: Ada Lovelace
Labels: UX, checkout

The summary panel currently recomputes …
```

This is what `⇧O` runs in its tmux window. It's kept off the TUI path so the output can be piped
through a pager:

```sh
lane view SHOP-412 | less
```

The description is converted from Atlassian Document Format to Markdown by the same code the
viewer uses, so the two agree on what an issue says.

## `lane import <board-id>`

Read a real Jira board's configuration and print a pasteable `[[boards]]` block: its name, its
filter JQL, and its columns with the status names that fold into each.

```sh
lane import 1234
```

```toml
[[boards]]
name = 'SHOP Team Board'
jql = 'project = SHOP AND type != Epic ORDER BY Rank ASC'

  [[boards.columns]]
  title = 'To Do'
  statuses = ['Open', 'Ready']
```

The board id is in the board's URL: `…/jira/software/projects/SHOP/boards/**1234**`.

Swimlanes are not importable — Jira's public Agile API doesn't expose a board's swimlane
definitions — so lane prints a note on stderr and you add `[[boards.swimlanes]]` by hand. Since
the note goes to stderr, this works:

```sh
lane import 1234 >> ~/.config/lane/config.toml
```

## Development

From a clone, with [just](https://github.com/casey/just):

| Recipe | What |
| --- | --- |
| `just run` | run once, against real Jira |
| `just dev` | run with hot reload |
| `just mock` | run with hot reload against the mock board |
| `just test` | `bun test` |
| `just check` | typecheck + lint + fmt-check |
| `just typecheck` / `just lint` / `just fmt` | individually |
| `just build` / `just build-all` | compile `dist/lane` for this machine / every platform |
| `just shots` | regenerate the docs screenshots from the demo board |
| `just audit-public` | grep the tree against a local denylist before publishing |
