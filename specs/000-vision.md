# Lane Vision

**Status**: Draft

## What is Lane?

Lane is a terminal-based Kanban board for Jira. It lets you **create, manage, and
visualise Jira tasks** from a keyboard-first TUI, without leaving the terminal — the same
stack and interaction philosophy as [`monq`](../../monq). The name is *swimlane*, distilled.

> This vision is deliberately narrow. The Jira integration works by shelling out to the
> `jira` CLI — the same way [presto](../../../presto) shells out to `gh` (see
> [005-jira-provider](./005-jira-provider.md)). Until that lands, the app runs against local
> mock data.

## Core Philosophy

1. **Keyboard-first** — everything reachable via vim-style keys (`h/j/k/l`), no mouse required.
2. **Board as the primary view** — issues live in columns (Jira statuses); you move between
   and across columns to navigate and to change status.
3. **Config-defined boards** — you keep several boards (each a JQL query) as header tabs and
   switch between them; boards live in a config file ([015](./015-configuration.md),
   [016](./016-multiple-boards.md)).
4. **Provider-agnostic UI** — the UI depends only on an abstract `Board` shape, never on Jira
   directly. Today a mock provider fills it; a Jira provider will fill the same shape later.
5. **Safe mutations** — anything that writes back to Jira (moving a card = a status transition)
   is explicit and, where destructive or surprising, confirmed.

## Design Principles

- **Fast feedback** — navigation and local state changes are instant; network work is async
  and never blocks the UI thread.
- **Discoverable, without chrome** — no persistent status bar. Discoverability comes from a
  `Ctrl+P` command palette ([010](./010-command-palette.md)) and an on-demand shortcut dialog
  ([011](./011-shortcut-dialog.md)); the board uses the full screen.
- **Read-first, write-deliberate** — visualising the board is the common case; writing to Jira
  is a deliberate action.

## Non-Goals (for now)

These are explicitly out of scope until we decide otherwise. Listing them here so we don't
drift into building them:

- Full Jira issue editing (rich descriptions, fields, attachments)
- Backlog / sprint **management** — planning and drag-to-rank persistence. A read-only
  backlog **view** is in scope ([017](./017-view-modes.md)); managing it is not.
- Editing Jira board configuration from here (we can *read* a board's config to scaffold ours —
  [018](./018-import-jira-board-config.md) — but not write it back)
- Comments threads, notifications, watchers
- Offline write queue / sync-on-reconnect

Multiple boards, board switching, and alternate views (list/backlog) were previously listed
here as non-goals; they are now in scope — see [016](./016-multiple-boards.md) and
[017](./017-view-modes.md).

## Target User

A developer who works Jira tickets daily, lives in the terminal, and wants to see and move
their tasks without opening the Jira web UI.
