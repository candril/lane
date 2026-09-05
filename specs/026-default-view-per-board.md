# Per-Board Views

**Status**: In Progress — default view + grouping built

## Description

Let each board declare, in config, both the view it **opens in** and which views are
**available** at all:

- **Default** — the board grid with a particular grouping, or the list/backlog view,
  instead of the hardcoded default (`parent` grouping, board view).
- **Available set** — restrict which views (board / list / backlog) and which grouping
  keys the runtime toggles offer, so a board only exposes the modes that make sense for
  it (e.g. a backlog-only board, or a board with no swimlanes hides the swimlane grouping).

The runtime toggles (`v` for board/list, `g` for grouping) still switch freely **within
the allowed set**; config seeds the initial state and bounds the choices when a board
becomes active.

This builds on [015](./015-configuration.md) (config), [016](./016-multiple-boards.md)
(a board becomes active on tab switch), [017](./017-view-modes.md) (the views), and
[024](./024-backlog-tab.md) (a backlog is the list view of a JQL tab).

> **Built**: a board's `view` (specs/017) and `grouping` (specs/009) defaults both come from
> config now. An epic board (specs/034) forced the grouping half: it is read flat — epics as
> cards with their issues inside them — while a work board is read by parent, and a tab that
> opens in the wrong one hides what it exists to show. The allowlist half is open.

## Capabilities

### P1 — Must Have

- `BoardConfig` gains a default view. The existing unused `view?: "board" | "list"`
  is honored, plus a default **grouping** for the board view:
  - `grouping = "flat" | "by-parent" | "by-type" | "swimlanes"` → the `Grouping`
    keys `none` / `parent` / `type` / `swimlanes`.
  - `view = "backlog"` (or `"list"`) opens the list view ([024](./024-backlog-tab.md)).
- `App` initializes its `view` + `grouping` state from the active board's config on
  load (and when switching boards, [016](./016-multiple-boards.md)).
- Still runtime-switchable: `v` / `g` override the config default without persisting.
- **Validation**: `grouping = "swimlanes"` requires the board to define swimlanes
  ([016](./016-multiple-boards.md)); if it doesn't, fall back to `by-parent` with a
  clear config error rather than an empty board.

### P2 — Should Have

- **Available views / groupings** (allowlist): a board may declare `views` (subset of
  `board` / `list` / `backlog`) and `groupings` (subset of the grouping keys) it offers.
  `v` / `g` then cycle only those; the palette hides the rest. The `default` (P1) must be
  within the allowed set (else a config error). Omitted → all applicable modes available
  (swimlanes still gated on the board actually defining swimlanes).
- On board-tab switch ([016](./016-multiple-boards.md)), each tab restores **its own**
  default view (not the previously active tab's).
- `"backlog"` reads as a friendly alias for the list view ([024](./024-backlog-tab.md)).

### P3 — Nice to Have

- Remember each board's **last-used** view across the session and prefer it over the
  config default once the user has changed it.

## Out of Scope

- Persisting view choices across app restarts — this is starting-state only (session
  memory is P3).
- Per-board **columns** — that already lives in `[jira].columns` / board config
  ([015](./015-configuration.md)).

## Technical Notes

- Extend `BoardConfig` (`config/types.ts`) with `view` (`board` | `list`/`backlog`)
  and `grouping`; validate in `config/validate.ts` with a small name map
  (`flat→none`, `by-parent→parent`, `by-type→type`, `swimlanes→swimlanes`).
- `index.tsx` reads the active board's defaults and passes them to `App`, which uses
  them as the initial `useState` for `view` and `grouping` (today those are hardcoded
  to `board` / `parent`).
- The allowlist filters `App`'s existing `groupings` cycle (which already gates
  query-swimlanes on config) and the `v` view toggle, so no new toggle machinery — just
  a narrower set. Both `v`/`g` and the palette read from the same allowed set.
- The swimlanes-without-config guard mirrors the existing `groupings` gating in `App`
  (query-swimlanes only offered when the board defines them).

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` | `view` + `grouping` on `BoardConfig` |
| `src/config/validate.ts` | Parse/validate the new fields; grouping name map |
| `src/index.tsx` | Pass the active board's default view/grouping to `App` |
| `src/App.tsx` | Seed initial `view` / `grouping` from props |
| `config.example.toml` | Document per-board `view` / `grouping` |
