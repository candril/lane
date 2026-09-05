# Backlog as a Configured Tab

**Status**: Draft

## Description

Show a **backlog** as just another **tab** ([016](./016-multiple-boards.md)) whose issue set is
defined by a **JQL query** ([015](./015-configuration.md)), rendered in the backlog/list view
([017](./017-view-modes.md)). There is no separate "backlog engine": a backlog is a board whose
query selects backlog issues (e.g. unresolved, un-sprinted) and whose default view is backlog/list.

This spec is the small connective tissue between three existing specs — it does not introduce a new
data path, only the recognition that "a backlog" falls out of *board = JQL + default view*.

> **Related**: this spec is a backlog defined by *its own JQL*. A Kanban board's own backlog —
> the statuses the board config keeps off the board — is [044](./044-board-backlog.md), which
> shares one query with its board tab. Both can coexist; 044 is the Checkout case.

## Capabilities

### P1 — Must Have

- A config-defined board ([016](./016-multiple-boards.md)) can set its **default view** to
  `backlog` (or `list`), so a tab opens straight into the backlog rendering
  ([017](./017-view-modes.md)).
- The board's issue set comes from its **JQL** ([015](./015-configuration.md) /
  [016](./016-multiple-boards.md)) — e.g. a backlog query — with no board-specific special-casing.
- The backlog tab sits alongside board tabs in the header and is reachable the same way
  ([016](./016-multiple-boards.md)).

### P2 — Should Have

- Per-board default **view mode** honoured from config across all tabs (generalises
  [017](./017-view-modes.md) P2), so one tab can default to `board` and another to `backlog`.
- Filter & search ([020](./020-filter-and-search.md)) narrows *within* a backlog tab, the same as
  any other tab.

### P3 — Nice to Have

- Grouping the backlog by sprint/epic when the provider exposes it
  ([017](./017-view-modes.md) P2).

## Out of Scope

- **Ranking writes** — reordering the backlog and persisting rank to Jira. Read-only order for now
  ([017](./017-view-modes.md) Out of Scope); a ranking-writes spec would be separate.
- A distinct backlog data model or provider path — a backlog is a board
  ([004](./004-data-model-and-provider.md) shape) selected by JQL.

## Technical Notes

- No new mechanism: this is `board.jql` ([016](./016-multiple-boards.md)) + `board.defaultView`
  ([017](./017-view-modes.md)), both from config ([015](./015-configuration.md)). The header tab
  bar and view router already exist in those specs; this spec just wires a backlog-shaped config
  through them.
- Whether the backlog's **order** can be trusted still depends on what the `jira` CLI exposes for
  rank — the same open question as [017](./017-view-modes.md) / [005](./005-jira-provider.md).

## File Structure

| File | Change |
|------|--------|
| `src/config.ts` | `defaultView` (`board` \| `list` \| `backlog`) on a board's config ([015](./015-configuration.md) / [016](./016-multiple-boards.md)) |
| `src/App.tsx` | Open a tab in its configured default view ([017](./017-view-modes.md) router) |
