# Quick Filters

**Status**: Implemented (P1)

## Description

Config-defined **quick filters**: name a filter query in `config.toml` under a
single letter, then apply it instantly with an `f`+letter chord — no typing in the
filter bar. E.g. `f` then `b` applies `type:bug`, `f` then `m` applies
`assignee:me -is:done`. The filter is a normal [020](./020-filter-and-search.md)
query string, so it composes every field/negation the bar supports.

The motivating use: a handful of filters you reach for constantly (my in-flight
work, bugs, a label stream) deserve a keystroke, not re-typing.

## Capabilities

### P1 — Must Have

- **Config**: a `[filters]` table mapping a single letter (`a`–`z`) to a filter
  query string ([015](./015-configuration.md)). Instance-wide, shared by every board.
- **`f`+letter chord**: press `f`, then the letter, to set the active board's filter
  to that query — reusing the existing filter apply/persist path
  ([020](./020-filter-and-search.md); the Header shows `⧉ <query>`).
- **Toggle**: pressing the same quick filter again (its query already active) clears
  the filter, so one chord flips it on and off.
- Works in board and list views; unknown letters are a no-op. The chord only arms
  when at least one filter is configured, so `f` is free otherwise.

### P2 — Should Have

- Show the configured chords somewhere discoverable — the shortcut dialog lists the
  `f a-z` chord ([011](./011-shortcut-dialog.md)); a per-filter legend could list the
  actual bindings and their queries.
- Per-board quick filters overriding/extending the instance-wide set
  ([016](./016-multiple-boards.md)).

### P3 — Nice to Have

- Save the current bar query into a quick-filter slot from the UI (write-back to
  config), the inverse of applying one.
- A picker of all quick filters (fuzzy over name/query) for when you forget the letter.

## Out of Scope

- The filter grammar itself — owned by [020](./020-filter-and-search.md); a quick
  filter is just a stored query string.
- Saved *views* (grouping + sort + filter together) — a quick filter only sets the
  filter query, not grouping or view mode.

## Technical Notes

- **Config**: `Config.filters?: Record<string, string>`; `validate.ts` checks each
  key is a single `a`–`z` letter and the value a non-empty string.
- **Chord**: an `fPendingRef` in `App`, mirroring the `z…` fold chord — `f` arms it,
  the next key resolves against `filters` before other handlers consume it. Applying
  reuses `setQuery`; toggle compares the current query to the mapped one.
- No new render surface beyond the shortcut-dialog line; the filter bar and Header
  already render an active query.

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` / `validate.ts` | `[filters]` schema + validation |
| `src/index.tsx` | Thread `filters` from config into `App` |
| `src/App.tsx` | `f…` chord: arm on `f`, resolve to a `setQuery`, toggle on repeat |
| `src/components/ShortcutHelp.tsx` | List the `f a-z` chord |

## Open Questions

- **Chord discoverability**: the letters live in config; beyond the shortcut-dialog
  line, is a legend of the actual bindings worth the space? (P2.)
