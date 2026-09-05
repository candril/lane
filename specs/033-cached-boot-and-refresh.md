# Cached Boot & Background Refresh

**Status**: Implemented — SWR boot from disk cache, session restore, interval +
focus + SIGCONT + manual (`r`) refresh with mutation-deferral, and the age indicator

## Decisions (confirmed)

- **Stale-while-revalidate, from disk.** On launch, hydrate the active board from a
  disk cache and render immediately (no blocking fetch), then revalidate in the
  background and swap in the fresh board. Same on board switch ([016](./016-multiple-boards.md)):
  a board's cached snapshot shows instantly, then revalidates. The in-memory switch
  cache seeds from and writes through to disk.
- **Cache location & shape.** `$XDG_CACHE_HOME/lane` (default `~/.cache/lane`).
  `cache.json` holds one entry per board — `{ board, fetchedAt }` — keyed by a hash of
  the board's identity (project + jql + columns), so a config change misses the stale
  entry ([030](./030-per-board-columns.md)). (presto lumps cache into its config dir;
  lane uses the XDG cache dir instead — same pattern, cleaner location.)
- **Restored session state** (`state.json`, debounced ~500 ms on change; validated with
  fallback on load): **active tab, view, filter query, grouping, and sub-tasks-hidden.**
  The **cursor is not restored — it starts at the top** (board contents shift between
  sessions).
- **All three refresh triggers**, funnelled through one re-entrancy-guarded refresh:
  - **manual** `r`;
  - **interval** poll, default **60 s**, configurable (`0` disables) — a self-rescheduling
    `setTimeout` (rescheduled after the await) so polls never overlap;
  - **on focus** (terminal focus-in), gated behind a ~30 s stale threshold so alt-tabbing
    doesn't storm; plus **SIGCONT** (resume from `Ctrl-Z`) for good measure.
- **Deferred during mutations.** A refresh is skipped while an optimistic move/assign/
  edit/create is in flight (an in-flight count) and re-runs once it settles — lane won't
  clobber an optimistic change (stronger than presto, which replaces wholesale).
- **Age indicator** in the header: `refreshing…` while fetching, else `updated Nm ago`,
  styled stale past ~2× the interval.

Focus reporting is proven in this stack (presto's `utils/focus-reporting.ts`): write
`\x1b[?1004h` to stdout, `renderer.prependInputHandler` matching `\x1b[I` / `\x1b[O`
(consume the sequence), `\x1b[?1004l` on teardown.

## Description

Boot **instantly** from a local cache of the last-loaded board, then keep it fresh in the
background — on an interval while running, and immediately when the terminal regains
focus. Today startup blocks on a full provider fetch (`index.tsx` awaits
`provider.loadBoard()`), which for the `jira` CLI is a multi-second shell-out
([005](./005-jira-provider.md)); and once loaded, the board never refreshes. Cached boot
serves [nfr/001-performance](./nfr/001-performance.md) ("instant local interaction").

## Capabilities

### P1 — Must Have

- **Persist** each successfully loaded board to a local cache — one entry per board, keyed
  by the board's provider identity (project / jql / columns), storing the `Board` plus a
  `fetchedAt` timestamp.
- **Boot from cache**: if a cache entry exists for the active board, render it immediately,
  then fetch fresh data in the background and swap it in, with a subtle *refreshing…* /
  age indicator in the header. No cache → today's behaviour (fetch, then render).
- **Manual refresh** binding (e.g. `r`) to force a re-fetch on demand.
- **Interval refresh** while running (interval configurable, sensible default).

### P2 — Should Have

- **Refresh on focus**: re-fetch when the terminal/app regains focus, via terminal focus
  reporting (CSI `I`/`O`); pause the interval while unfocused/backgrounded to avoid
  needless CLI calls. Feasibility caveat below.
- **Reconcile with optimistic mutations** ([006](./006-card-movement.md)): a background
  refresh must not clobber an in-flight move/edit/assign — defer refresh while a mutation
  is pending (and re-fetch once it settles), or re-apply pending changes over the result.
- **Cache invalidation** when the board config changes (columns / jql) — the cache key is
  a hash of the relevant config, so a changed board misses the stale cache.

### P3 — Nice to Have

- Show data **age** ("updated 2m ago") and a stale style past a threshold.
- **Offline tolerance**: on refresh failure, keep the cache visible with an error
  indicator and retry with backoff ([nfr/004](./nfr/004-reliability-and-errors.md)).

## Out of Scope

- A full sync engine / conflict resolution — Jira is the source of truth; refresh is a
  replace, guarded against clobbering optimistic in-flight mutations.
- Real-time push (webhooks / streaming) — this is cache + polling only.

## Resolved — focus events

**Confirmed feasible.** OpenTUI has no built-in focus events, but `CliRenderer`
exposes `prependInputHandler(fn)` / `removeInputHandler(fn)`, and enabling DEC mode
1004 (`\x1b[?1004h`) makes the terminal emit `\x1b[I` / `\x1b[O` on focus in/out, which
the handler sees and consumes. presto ships exactly this (`utils/focus-reporting.ts`),
working on tmux / iTerm2 / kitty. lane mirrors it, plus a `SIGCONT` handler for
resume-from-suspend.

## Technical Notes

- New `src/cache.ts`: read/write a board cache under `$XDG_CACHE_HOME/lane` (or
  `~/.cache/lane`), one JSON file per board (name = hash of provider identity), holding
  `{ board, fetchedAt }`. Reads are fast and synchronous enough for boot.
- `index.tsx`: read the cache for `initialBoard` and mount immediately; kick off
  `provider.loadBoard()` after mount; `App` swaps the board in on resolve and writes the
  fresh result back to cache.
- Refresh lives in `App` (or a small `useRefresh` hook): an interval timer plus the focus
  listener, both calling `provider.loadBoard()`; `setBoard(fresh)` unless a mutation is
  pending (track an in-flight count, [006](./006-card-movement.md)).
- The `BoardProvider` seam is unchanged — `loadBoard()` is already the fetch; caching wraps
  around it. Cache key derives from the active board's config (with per-board settings from
  [030](./030-per-board-columns.md) / [031](./031-per-board-jira-cli-config.md)).

## File Structure

| File | Change |
|------|--------|
| `src/cache.ts` | New: read/write the board cache keyed by provider identity |
| `src/index.tsx` | Boot from cache; run the initial fetch in the background |
| `src/App.tsx` | Interval + focus refresh; reconcile with optimistic mutations; `r` to refresh |
| `src/config/types.ts` | Refresh-interval setting (+ enable/disable) |
| `src/components/Header.tsx` | *refreshing…* / age indicator |
