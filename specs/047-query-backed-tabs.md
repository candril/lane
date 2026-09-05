# Query-Backed Tabs

**Status**: In Progress — P1 built

## Description

A tab's data comes from a `BoardSource`, and every source is a board out of
`config.toml` ([016](./016-multiple-boards.md), [044](./044-board-backlog.md)). That one
assumption is what limits the two features either side of it:

- **Search finds issues it cannot act on.** [046](./046-global-search.md)'s prompt reaches
  the whole instance, but only `^O` / `^Y` / `^U` work on a result, because those need
  nothing but a key. `⇧S`, `a`, `e`, `⇧E` all act through `board.tasks`, and a result is on
  no board. Wiring each of them into the prompt would be the mutation layer written twice.
- **A clone can only narrow.** [045](./045-ad-hoc-tabs.md) filters its origin's snapshot
  client-side, so a view of issues the origin's JQL never fetched is impossible.

Both want the same thing: **a source that is a query rather than a config board**. Build
one and a result set *is* a board — views ([017](./017-view-modes.md)), filters
([020](./020-filter-and-search.md)), grouping ([026](./026-default-view-per-board.md)),
refresh ([033](./033-cached-boot-and-refresh.md)) and every mutation already work on it,
because all of them are keyed by source and none of them knows where a source came from.
This is the seam [046](./046-global-search.md) deferred its remaining actions to, and it
closes that spec's P2 and [045](./045-ad-hoc-tabs.md)'s P3 with one change.

## Decisions (as built)

- **P1 is built**: `^T` in the search prompt keeps the running search as a tab, and the
  result set is a board every existing action works on.
- **The transition was the only mutation that needed new code.** `assignTask`,
  `editSummary`, `setLabels`, `setEpic`, and the per-issue reads and writes the viewer
  needs — `loadIssue`, `loadChildren`, `editDescription`, the resolution calls
  ([053](./053-close-reason.md)) —
  delegate untouched; `moveTask` goes through an
  extracted `transitionTo(key, status)` because the derived columns exist in no board
  config. That split is the whole reason this was one change rather than five.
- **A query source is identified by its query, hashed** (`query:<hash>`), so keeping the
  same search twice adds a tab rather than a second fetch, and an edited query misses the
  old snapshot instead of showing it.
- **Searching from a query tab still roots the new source in a config board** — that is the
  id a restart can resolve, and the credentials underneath.
- **`useBoardData` owns the source list**, not `App`. It started as `App` state, which was
  wrong in a way that only showed up at runtime: keeping a search added the source with
  `setSources` and switched to it in the same tick, but the switch resolves ids through a
  ref that React had not committed yet — so it found nothing, returned early, and left the
  *origin board's* issues under the new tab. Filtering that tab with `/ epic:…` then
  "worked", which made it look like the query was fine. The list lives with the code that
  resolves it, and `addSource` updates the ref synchronously before the state.
- **Startup can't resolve a restored query tab** (`index.tsx` only knows the config
  boards), so `App` adopts the active tab's source once on mount rather than teaching
  startup about a file it doesn't read.
- **A query tab fetches the sub-tasks of what it matched**, as a second query — the same
  two-step a board load does ([005](./005-jira-provider.md)), and for the same reason: a
  sub-task's parent is its story, so a query for an epic's issues returns the stories and
  none of their sub-tasks. Without it a query tab has no tree to fold, filter or nest
  ([008](./008-sub-tasks.md), [042](./042-fold-subtasks.md),
  [043](./043-subtask-filter-scope.md)) — half a board. A query that already returned
  sub-tasks doesn't get them twice.
- **Backlog statuses appear as ordinary columns** in a query tab, appended after the
  origin's board columns — measured against the mock: a search across the Checkout board
  derives `To Do | In Progress | In Review | Done | In refinement | To be discussed`. A
  query has no board/backlog split to respect ([044](./044-board-backlog.md)).

## Capabilities

### P1 — Must Have

- **Keep a search as a tab** (`^T` in the search prompt): the query you just ran becomes a
  source, with a tab over it, activated. The query stored is the *effective* JQL
  [046](./046-global-search.md) built — scope included — so the tab holds exactly the
  results you were looking at, not a re-interpretation of the input.
- **Named like any ad-hoc tab**: prompted on creation, defaulting to the typed input rather
  than the generated JQL (`parcel rollback`, not `(team = …) AND (text ~ "parcel*")`),
  renameable with `⇧T r` ([045](./045-ad-hoc-tabs.md)).
- **A query source is an ordinary source**: manual `r`, the interval and focus refreshes,
  the snapshot cache, per-tab projection, and the key-and-value mutations (`a`, `e`, `#`,
  `⇧E`) work with no per-feature plumbing — optimistic and reverting on failure exactly as
  on a board.
- **Moving a card works in a query tab** (`H`/`L`, `⇧S`). This one cannot delegate: a
  column is a board concept, so the query provider maps its derived columns itself — see
  Technical Notes.
- **Sub-tasks of the matched issues are loaded too**, so the tree views work; see
  Decisions.
- **Columns derived from the statuses present**, since a query's issues can come from any
  project and the origin board's columns may map nothing. Ordered by the origin's column
  order where they overlap, appended otherwise.
- **Sources exist at runtime**, not only at startup: `sources` moves from a fixed prop into
  state, so one can be added (and dropped) while the app runs.
- **Persisted across restarts**, with the query, beside the ad-hoc tabs. Restoring rebuilds
  the source from the stored JQL; a tab whose source can't be rebuilt is dropped silently,
  as [045](./045-ad-hoc-tabs.md) already drops tabs whose config board vanished.
- **Closable** (`⇧T x`) like any ad-hoc tab. Config tabs stay unclosable.
- **Creation is refused** in a query tab, with a toast saying why: an issue created here
  would land in the origin board's project and vanish on the next refresh
  ([019](./019-quick-create.md)).
- **A bad query fails at creation**, in the prompt with the input intact, rather than
  becoming a tab that is permanently empty ([nfr/004](./nfr/004-reliability-and-errors.md)).

### P2 — Should Have

- **A query tab from scratch** (`⇧T q`): a JQL line, without going through a search first —
  the "I know the query I want" path, with [025](./025-jql-search.md)'s autocomplete once
  that lands.
- **Narrowing clone** ([045](./045-ad-hoc-tabs.md) P3): clone a config tab into a query
  source whose JQL is `(origin) AND (extra)`, for issues the origin deliberately excludes.
  Server-side where a clone's filter is client-side.
- **Promote to config**: print the tab as a pasteable `[[boards]]` block, the
  [018](./018-import-jira-board-config.md) trick, for when a kept query earns a permanent
  home. Shared with [045](./045-ad-hoc-tabs.md) P2.
- **Command palette** ([010](./010-command-palette.md)) entries for keep-as-tab and new-query-tab.
- **Recent searches** ([046](./046-global-search.md) P2) list the queries already kept as
  tabs first — a query you saved is the one you come back to.

### P3 — Nice to Have

- **Re-run with an edited query** (`⇧T e`): change a kept tab's JQL in place instead of
  closing it and searching again.
- **Preview before keeping**: the result count and column spread shown in the prompt, so
  `^T` on a 900-issue query is a choice rather than a surprise.
- A query tab against the **mock** provider, so the flow is exercisable offline.

## Out of Scope

- **The search prompt itself** — [046](./046-global-search.md). This spec consumes the
  query that prompt produces; it does not change how input is read.
- **Filter syntax** — [020](./020-filter-and-search.md). A query tab's `/` filter is the
  same client-side filter as everywhere else; only the *source* is server-side.
- **Making config boards query-backed.** A config board carries columns, a backlog split
  ([044](./044-board-backlog.md)), swimlanes and view defaults that a bare JQL has no way
  to supply. The two source kinds stay distinct; this adds one, it does not unify them.
- **Editing `config.toml` from the app** — [016](./016-multiple-boards.md); P2's promote
  prints, never writes.
- **Ranking inside a query tab.** `rankTask` re-ranks against a board's global order
  ([044](./044-board-backlog.md)); a result set has no order of its own to persist, so the
  reorder gesture is hidden rather than given a meaning it doesn't have.

## Technical Notes

- **The source shape barely changes.** `BoardSource` ([tabs.ts](../src/tabs.ts)) gains an
  optional `query` (the JQL) marking it query-backed; everything else — `id`, `name`,
  `provider`, `cacheKey`, `defaultMode` — is filled the same way. Nothing downstream
  branches on it except the column derivation and the hidden reorder.
- **The provider is a wrapper, not a new implementation.** `createQueryProvider(base, jql)`
  delegates the key-and-value mutations to the Jira provider the query was run through, and
  overrides `loadBoard()`: run `searchIssues(jql, …)`
  ([provider.ts](../src/providers/provider.ts), already added for
  [046](./046-global-search.md)) and shape the `Task[]` into a `Board`. `assignTask`,
  `editSummary`, `setLabels` and `setEpic` take a key and a value, so they work for free —
  it is literally the same provider underneath.
- **`moveTask` is the exception, and must be overridden.** The Jira provider resolves a
  `columnId` against *the board config's* columns
  ([jira.ts](../src/providers/jira.ts)) and throws `No Jira status mapped` for anything
  else — so a derived column would fail every move. It is a small override rather than a
  problem: a derived column *is* a status, which is exactly the shape the backlog columns
  already have ([044](./044-board-backlog.md)), so the query provider transitions to the
  status its column names. That wants the transition lookup inside `moveTask` extracted as
  a `transitionTo(key, statusName)` the two callers share, rather than duplicated.
- **`searchIssues` needs paging.** It is capped for a prompt list today; a board wants the
  whole result set (bounded), so this reuses the provider's existing paging rather than the
  prompt's cap ([005](./005-jira-provider.md)).
- **`sources` becomes state.** Today [index.tsx](../src/index.tsx) builds the array at
  startup and passes it to `App` as a prop; `useBoardData` closes over it. It moves into
  `App` state seeded from the prop, with the hook taking the current array — its
  per-source snapshot map is keyed by id already, so a source appearing mid-session needs
  no other change.
- **`cacheKey` is `boardKeyFor({ jql })`**, so two tabs kept on the same query share one
  snapshot and one refresh, and a changed query misses the stale entry — the same identity
  rule config boards use ([cache.ts](../src/cache.ts)).
- **Persistence rides on `tabs.json`.** A `Tab` gains an optional inline source descriptor
  (`{ kind: "query", jql, name }`); boot rebuilds those sources before reconciling tabs, so
  a restored query tab resolves its `sourceId` like any other. One file, one write path, and
  045's validate-on-read discipline unchanged.
- **A move can still legitimately fail here.** The derived column names a status some
  *other* project's workflow may not have. Don't pre-validate — let the transition fail and
  revert with a toast, which is what the optimistic path already does
  ([nfr/004](./nfr/004-reliability-and-errors.md)).
- **`^T` is free in the search prompt** ([useBoardKeymap.ts](../src/useBoardKeymap.ts));
  `^A`, `^O`, `^Y`, `^U`, `^P`/`^N` are taken. It also echoes `⇧T`, the tab chord
  ([045](./045-ad-hoc-tabs.md)).

## Open Questions

- ~~**Which columns does a query tab get?**~~ **Resolved:** derive them (option 1). A query
  is by definition not a project's board, so borrowing a board's columns would misreport
  every result that came from elsewhere. The candidates weighed:
  1. **Derive from the statuses present**, ordered by the origin board's column order where
     they overlap and appended otherwise. Always correct for a cross-project set, but the
     board's shape shifts as results change.
  2. **Inherit the origin board's columns**, with unmapped issues collected in a trailing
     "Other" column. Stable and familiar, wrong-looking when the query left the project.
  3. **A fixed To Do / In Progress / Done** mapped from Jira's status categories. Stable and
     project-independent, but throws away the workflow detail the board exists to show.

  The cost of (1) is a board whose shape shifts as results change — accepted: a result set
  that no longer contains a status has no column worth keeping.
- **Does a query tab join the background refresh?** Open. A broad `text ~` re-run every 60s
  is a cost a config board's JQL doesn't have. Build it refreshing like any other source
  ([033](./033-cached-boot-and-refresh.md)) and decide from what it actually costs — a
  separate, longer interval for query sources is the fallback if it bites.
- ~~**Does closing the tab drop the source?**~~ **Resolved:** yes. A query source exists
  only for its tabs, unlike a config board which exists because the file says so. Where two
  tabs project one query the source lives until the last of them closes, so the rule is
  refcount-by-tab, not drop-on-close.
- ~~**What does creating an issue in a query tab mean?**~~ **Resolved:** it doesn't, so it is
  refused. `createIssue` delegates, so `n` ([019](./019-quick-create.md)) would file into the
  *origin board's* project and land in the first derived column — then vanish on the next
  refresh, because a new issue rarely matches the query that made the tab. A card that
  disappears is worse than a key that says no. The alternatives (accept the vanishing card,
  or pin it until the tab closes) both need state a query source doesn't have.
- **Does a kept search stay scoped?** The stored JQL includes the scope
  ([046](./046-global-search.md)), so the tab is fixed at whatever the chip said when you
  pressed `^T`. Whether the tab should show that scope in its header, or let you widen it
  later, waits for P3's editable query.

## File Structure

| File | Change |
|------|--------|
| `src/providers/query.ts` | New: `createQueryProvider(base, jql)` — `loadBoard()` via `searchIssues`, everything else delegated |
| `src/providers/provider.ts` | `searchIssues` paging/limit for a board-sized result set |
| `src/providers/jira.ts` | Extract `transitionTo(key, statusName)` out of `moveTask` so the query provider can reuse it |
| `src/tabs.ts` | `BoardSource.query`; build/persist a query source; inline source descriptor in `tabs.json` |
| `src/grouping.ts` | Columns derived from the statuses in a result set |
| `src/App.tsx` | `sources` as state; add/drop a source; keep-as-tab from the prompt |
| `src/index.tsx` | Startup sources become the initial value, not the whole truth |
| `src/useBoardData.ts` | Tolerate a source appearing/disappearing mid-session |
| `src/components/SearchPrompt.tsx` | `^T` hint |
| `src/useBoardKeymap.ts` | `^T` in the prompt; `⇧T q` (P2) |
| `src/components/ShortcutHelp.tsx` | The new keys in the Find / Tabs groups |
