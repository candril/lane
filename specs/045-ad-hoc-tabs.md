# Ad-Hoc Tabs

**Status**: In Progress — P1 built

## Description

Tabs today are exactly the boards in `config.toml` ([016](./016-multiple-boards.md)) — a fixed set,
editable only by editing the file. But the useful views are situational: *my* Checkout work, one
epic's issues, the BFF stream's backlog. Those are one filter away from a board that's already
loaded, and filtering is already a keystroke ([020](./020-filter-and-search.md)) — what's missing is
keeping the result around under a name.

So: **clone the current tab, give the clone a filter and a name, and keep it across restarts** —
presto's saved tabs. A clone shares its origin's *source* (provider, JQL, and the fetched snapshot),
so it costs no extra query and switching to it is instant; what it owns is its **projection**: the
filter query, the mode (board / list / backlog), and the grouping. Because mode is part of the
projection, cloning works the same for a board tab and a backlog tab ([044](./044-board-backlog.md)),
and a clone can flip between them: "my tasks, on the board" and "my tasks, in the backlog" are two
projections of one query.

Ad-hoc tabs are lane's own state, never written back to `config.toml` — the config may be read-only
(a Nix-managed symlink, as here) and is the user's hand-written record of *boards*, not of transient
views.

## Decisions (as built)

- **P1 is built** on [044](./044-board-backlog.md)'s source/projection split: `⇧T c` clone,
  `⇧T r` rename, `⇧T x` close, per-tab filter/mode/grouping, and persistence to
  `$XDG_STATE_HOME/lane/tabs.json`. P2/P3 are open.
- **A clone's id ends in its source id** (`adhoc:<n>:<board>`), so startup can warm the
  right board's cache from the restored active tab id alone — before the tab list exists.
- **Ad-hoc tabs are tinted, not badged.** The tab bar is one line; a per-tab glyph costs
  more than it tells. Long names elide at 20 chars for the same reason — losing a tab off
  the edge is worse than shortening its name.
- **The name prompt is `EditPrompt`**, generalised from the issue-rename line to a
  prefix + subject rather than an issue key.
- **Backlog mode is refused where there is no backlog**, rather than showing an empty tab
  with no explanation ([044](./044-board-backlog.md)).
- **This replaced [044](./044-board-backlog.md)'s derived backlog tab.** A saved clone in
  backlog mode is the same thing, named by you and closable — so the per-board tab lane
  invented was deleted rather than kept alongside.

## Capabilities

### P1 — Must Have

- **Clone the active tab** (`⇧T c`): creates a new tab from the same source, seeded with the current
  filter query, mode and grouping, placed immediately after its origin, and activated.
- **Name it**: a prompt on creation, defaulting to the filter query (`assignee:me`) so the common
  case is one `Enter`. Renameable later (`⇧T r`).
- **Own filter per tab**: editing the filter (`/`, quick filters [036](./036-quick-filters.md))
  changes only the active tab. An ad-hoc tab reopens with its filter applied — the filter *is* the
  tab. (This makes the filter query per-tab state generally; today it is global.)
- **Own mode**: switching view ([017](./017-view-modes.md) `v b` / `v l`, plus backlog from
  [044](./044-board-backlog.md)) applies to the active tab and is remembered with it.
- **Close** an ad-hoc tab (`⇧T x`). Config-defined tabs can't be closed — they're the file's.
- **Persisted across restarts**, in lane's own state file, not in config. Restored at the same
  position with name, source, filter, mode and grouping intact; a tab whose source board no longer
  exists in config is dropped (silently — a renamed board shouldn't error on boot).
- **Visually distinguishable** in the tab bar from config tabs (e.g. a marker), so it's clear which
  tabs are yours and closable.

### P2 — Should Have

- **Reorder** ad-hoc tabs (`⇧T h` / `⇧T l`), persisted.
- **Tab-bar overflow**: the bar is a single unscrolled line, so enough tabs (a board, its
  backlog, a few clones) push the last ones out of view. Eliding names buys room; a
  scrolling or grouped tab bar is the real fix.
- **Clone a clone** — the source chain flattens to the underlying board, so a second clone still adds
  no query.
- Number/`[`/`]` switching ([016](./016-multiple-boards.md)) and session restore of the active tab
  ([033](./033-cached-boot-and-refresh.md)) cover ad-hoc tabs with no special-casing.
- **Command palette** ([010](./010-command-palette.md)) entries for clone / rename / close.
- **Promote to config**: print the tab as a pasteable `[[boards]]` block (the
  [018](./018-import-jira-board-config.md) trick) when a saved view earns a permanent home.

### P3 — Nice to Have

- ~~Per-tab card-tag visibility~~ **built** ([039](./039-card-decoration-visibility.md)): `t e`
  / `t l` belong to the tab, since a backlog read down the epic column wants tags a board
  doesn't. Sub-task scope ([043](./043-subtask-filter-scope.md)) is still global.
- A **server-side** variant: a tab whose JQL narrows the origin's query, for issues the origin doesn't
  load at all (see Out of Scope) — specced as [047](./047-query-backed-tabs.md).
- Config-defined saved views (`[[boards.views]]`) so a team can ship a standard set.

## Out of Scope

- **New data sources.** A clone filters its origin's snapshot client-side; it cannot widen the issue
  set. Wanting issues the board's JQL excludes means a new `[[boards]]` entry, or the P3 JQL variant
  above — not a clone.
- **Editing `config.toml` from the app** — [016](./016-multiple-boards.md) Out of Scope, and the file
  may be read-only. Ad-hoc tabs live in lane's state file; P2 "promote to config" prints, never writes.
- **The backlog split itself** — [044](./044-board-backlog.md).
- **Filter syntax** — [020](./020-filter-and-search.md); this spec only decides *where a query lives*.

## Technical Notes

- **Builds directly on [044](./044-board-backlog.md)'s split**: a `BoardSource` (provider, cacheKey,
  columns, swimlanes) with the snapshot cache keyed by source, and a tab as `{ id, name, sourceId,
  projection }`. Config boards contribute one source and one tab each; a backlog tab and every clone
  are additional tabs on an existing source. Fetch, refresh and optimistic mutations all belong to the
  source, so every tab over it updates together ([033](./033-cached-boot-and-refresh.md)).
- **Per-tab projection state** is the real change in [App.tsx](../src/App.tsx): `query`, `view` and
  `grouping` move from single `useState`s to per-tab records, and the board-switch reset
  (`onBoardSwitched`) becomes "adopt the target tab's projection" instead of "reset to config
  defaults". The cursor still resets on switch (layouts differ).
- **State file**: ad-hoc tabs are user state, so `$XDG_STATE_HOME/lane/tabs.json` (fallback
  `~/.local/state`) — deliberately *not* `session.ts`'s file, which lives under `XDG_CACHE_HOME`
  ([session.ts](../src/session.ts)) and must stay disposable. Same best-effort, debounced write and
  validate-on-read discipline as the session.
- **Source identity across restarts** is the board's config `name` (already the cache key's basis) —
  a stable id that survives reordering the config, unlike an index.
- **`⇧T` as a chord prefix** (`c` clone, `r` rename, `x` close, `h`/`l` move) follows the existing
  `f`/`g`/`t`/`v`/`z` chord style and leaves the single-letter space alone (`t` is already the tag
  chord).

## Open Questions

- **Does a config tab remember its filter across restarts?** Per-tab filters make this natural, but a
  config board silently reopening filtered could be confusing. Proposed: yes, remember it (it's
  visible in the filter bar), since it matches today's behaviour of restoring the global filter
  ([033](./033-cached-boot-and-refresh.md)) — revisit if it surprises in use.
- **Should closing an ad-hoc tab confirm?** It's cheap to recreate; proposed no confirmation, and no
  undo.
- **Clone from a filter, or filter into a clone?** i.e. is `⇧T c` the only entry point, or does the
  filter bar offer "save as tab" once a query is typed? Proposed: `⇧T c` first (it seeds from the
  current query anyway); a filter-bar affordance is additive.

## Keyboard

| Key | Action |
|-----|--------|
| `⇧T c` | Clone the active tab (name prompt, seeded with the current filter) |
| `⇧T r` | Rename the active ad-hoc tab |
| `⇧T x` | Close the active ad-hoc tab |
| `⇧T h` / `⇧T l` | Move it left / right (P2) |
| `[` / `]`, `1`–`9` | Switch tabs, as today ([016](./016-multiple-boards.md)) |

## File Structure

| File | Change |
|------|--------|
| `src/tabs.ts` | New: ad-hoc tab model + load/save of `tabs.json` |
| `src/App.tsx` | `BoardSource` vs tab list; per-tab projection state; clone/rename/close |
| `src/useBoardData.ts` | Snapshot cache + refresh keyed by source, shared by its tabs |
| `src/useBoardKeymap.ts` | `⇧T` chord |
| `src/components/Header.tsx` | Mark ad-hoc tabs in the tab bar |
| `src/components/EditPrompt.tsx` | Reuse for the name prompt |
| `src/session.ts` | Active tab id (not index); projection state moves per-tab |
