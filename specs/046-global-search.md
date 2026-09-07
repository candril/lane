# Global Search

**Status**: In Progress — P1 built

## Description

Find **any** work item in Jira, not just the ones a board happens to have loaded.
Today's search is all local: `/` narrows the fetched issues
([020](./020-filter-and-search.md)) and `s` jumps to a visible one
([037](./037-jump-to-item.md)). Neither can answer "what was that ticket about the
parcel rollback?" or "open SHOP-12345" when it belongs to another team's board.

One prompt, one input: type text and it searches summaries, descriptions and keys
across the instance; type an issue key and it goes straight there; type something
that reads as JQL and it runs as JQL — which is where
[025](./025-jql-search.md)'s grammar-aware autocomplete lands, rather than as a
second, competing prompt.

## Decisions (as built)

- **A search starts inside a scope, and says so.** `search_scope` on a board is JQL the
  prompt begins inside — the team, for Checkout — shown as a `⟨Checkout⟩` chip and dropped
  with `^A` (`⟨all of Jira⟩`). Without the chip, "no results" reads as "not in Jira" when it
  means "not in your team".
- **A key ignores the scope.** Looking up `SHOP-61317` from another team is exactly when you
  know the key, so a key resolves unscoped.
- **`Task.status` carries the issue's own status.** `columnId` says where *this board* puts
  an issue, which is meaningless for a result from another project — it would have reported
  the fallback column. The search list shows the real status.
- **It is a command palette, not a tab.** A search result is a pointer you follow and
  dismiss, so it wants the shape every editor's `Ctrl-P` already taught: a centered dialog
  over whatever you were doing. A search *tab* was considered — it would make results a
  place you return to and act on in bulk — and is what P2's "keep the results as a tab"
  becomes, once a query-backed source exists; the palette is how you get there, not a rival.
- **Lean chrome**: background and padding, no borders, matching the rest of the app.
- **The word being typed is wildcarded** (`trav` → `trav*`). Measured on SHOP: `text ~ "trav"`
  finds nothing, `"trav*"` finds twelve — Jira matches whole words, so without it every
  keystroke reads "0 found" until a word happens to end.
- **JQL waits for `↵`**, since half-typed JQL is a syntax error and running it per keystroke
  shows nothing but complaints about the query you are still writing. Words and keys stay live.
- **Latest-wins, debounced.** A request counter drops a slow early answer that lands after a
  fast late one; keystrokes wait ~180 ms before becoming a query.
- **Enter opens the result in the viewer**, on this tab or not
  ([057](./057-detail-navigation.md) fetches what the board never loaded) — you searched for
  the issue to read it, and a key that answers with a moved cursor on some results and with
  the issue on others is a coin toss. The cursor still follows to the card where this tab has
  one, so closing the viewer lands on it. `^O` opens the browser either
  way, `^Y` copies its key and `^U` its URL. Ctrl-keyed because a plain letter would be
  typed into the query. The field edits (`⇧S`, `a`, `e`, `⇧E`, `#`) are reached through the
  viewer rather than the prompt, and work there on a result the board never loaded
  ([057](./057-detail-navigation.md)).
- **The rest of the actions wait for the result tab** (P2): once a search can back a source,
  its results *are* a board and every action works unchanged — no per-action plumbing in the
  palette, which would be the same code twice.

## Capabilities

### P1 — Must Have

- A **search prompt** (`:`) that runs against Jira and lists what it finds: key,
  summary, type, status, assignee, project. Esc closes it and leaves the board
  untouched.
- **Text search**: free text becomes `text ~ "…"`, ordered by relevance, capped and
  paged like any other query ([005](./005-jira-provider.md)).
- **Key shortcut**: an input that looks like an issue key (`SHOP-61317`, or `61317`
  against the active board's project) resolves that issue directly.
- **Search as you type**, debounced, with the in-flight query cancellable — a search
  must never block the keyboard ([nfr/001](./nfr/001-performance.md)).
- **Act on a result**: open in the browser (`o`), copy the key (`y`)
  ([014](./014-issue-actions.md)); if the issue is on a loaded tab, move the cursor to
  it instead of leaving the app ([037](./037-jump-to-item.md)).
- Errors (bad JQL, auth, rate limit) show in the prompt with the query intact, never
  as a crash ([nfr/004](./nfr/004-reliability-and-errors.md)).

### P2 — Should Have

- **Keep the results as a tab** ([047](./047-query-backed-tabs.md)): promote a search to an
  ad-hoc tab ([045](./045-ad-hoc-tabs.md)) backed by the query, so a search you keep returning to
  becomes a place. This makes a tab's source a *query* rather than only a config board.
- **JQL mode**: input recognised as JQL runs verbatim, with
  [025](./025-jql-search.md)'s field/operator/function autocomplete.
- **Recent searches**, recalled with ↑ — persisted next to the ad-hoc tabs
  ([045](./045-ad-hoc-tabs.md)), not in the disposable session cache.
- **Scope toggle**: whole instance ↔ the active board's project, since most searches
  are local to the team.

### P3 — Nice to Have

- Preview the highlighted result (description, sub-tasks) beside the list — the
  natural home for [007](./007-card-detail-view.md).
- Search other entities (boards, epics, people) from the same prompt.
- Rank recently-touched issues first.

## Out of Scope

- **Replacing `/` or `s`** — local filtering and local jumping stay exactly as they
  are; this is the "not loaded yet" case ([020](./020-filter-and-search.md),
  [037](./037-jump-to-item.md)).
- **Editing from the result list** beyond opening/copying; a result is a pointer.
  Actions belong to the issue once it is on a board (or to [007](./007-card-detail-view.md)).
- **Offline search** over the cache ([033](./033-cached-boot-and-refresh.md)) — this
  spec is a server query; a cache fallback would be a separate decision.

## Technical Notes

- **Provider surface**: `searchIssues(query: string, opts): Promise<Task[]>`, taking
  the already-built JQL. Building it (text → `text ~ "…"`, key → `key = …`) belongs in
  the search layer, not the provider, so the mock can answer from its seed.
- **Result shape is `Task`** ([004](./004-data-model-and-provider.md)) plus its project,
  so the list renders with the components the row views already use. An issue outside
  the board's columns has no `columnId` that maps — show its raw status, as backlog rows
  do ([044](./044-board-backlog.md)).
- **Cancellation**: keystroke N+1 must abandon N's response, or a slow early query
  overwrites a fast late one. An `AbortController` per query, latest-wins.
- **The prompt is a picker**, so it reuses `Picker`'s list/fuzzy/keyboard behaviour
  ([013](./013-quick-field-edit.md)) rather than a new overlay.
- **P2's "keep as tab"** needs a `BoardSource` built from a query rather than a config
  board — the seam [044](./044-board-backlog.md) introduced makes that a new source
  kind, not a new tab kind. Specced as [047](./047-query-backed-tabs.md).

## Open Questions

- ~~**One prompt or two?**~~ **Resolved:** one, on `:`. It takes words, an issue key, or
  JQL, and decides which it was given — two prompts for "find issues" is one too many.
  Input that reads as JQL (a field, an operator, `AND`/`OR`) runs verbatim; anything else
  is words. A leading `?` forces the words reading, for the rare search whose text looks
  like a query.
- **Does `text ~` cover enough?** Jira's `text` covers summary, description and
  comments, but not keys; the key shortcut handles that. Whether to also match
  `summary ~` explicitly for better ranking is worth measuring against the real
  instance before building.
- ~~**What happens on select when the issue is not loaded?** Options: open the browser,
  keep the results as a tab (P2), or fetch it into a scratch tab. Proposed: browser in
  P1, tab in P2 — the third invents a view we do not have yet.~~ **Resolved:** browser
  in P1 as proposed, tab in P2 ([047](./047-query-backed-tabs.md)); then the viewer
  ([057](./057-detail-navigation.md)) arrived and could fetch an unloaded issue, so `↵`
  now shows the result there — the "scratch view we do not have yet" — with the
  browser kept on `^O`.

## File Structure

| File | Change |
|------|--------|
| `src/search.ts` | New: input → JQL (text / key / raw), debounce, latest-wins |
| `src/providers/provider.ts` | `searchIssues(jql, opts)` |
| `src/providers/jira.ts` | The search call, paged and cancellable |
| `src/providers/mock.ts` | Answer from the seed so the prompt works offline |
| `src/components/SearchPrompt.tsx` | The prompt + result list (built on `Picker`) |
| `src/useBoardKeymap.ts` | `:` opens it; result actions |
| `src/components/ShortcutHelp.tsx` | A "Find" group: `:`, `^A`, `↵`, and `s` beside them |
| `src/App.tsx` | Own the prompt state; open the result in the viewer |
