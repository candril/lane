# Filter & Search

**Status**: Implemented (P1 + P2 tokens/aliases/priority/`assignee:me`)

## Decisions (as built)

- **Surface**: a bottom bar opened with `/`, live-filtering as you type, with a
  completion list stacked above it. `Esc`/`Enter` close the bar; the filter
  **persists** while closed (Header shows `⧉ <query>` + a `visible/total` count).
  A second `Esc` on the closed board **clears** it.
- **Free-text (no `field:`)**: fuzzy-matches across *every* searchable field of a
  card — key, summary, assignee, type, priority, status, labels, and the linked
  epic (its key and summary) — presto-style. Each whitespace word must land in at
  least one field (matched per-field, so a subsequence can't straddle a boundary).
- **Grammar**: `field:value` tokens + fuzzy free-text, OR-within / AND-across.
  Short aliases: `@name` (assignee), `#label`, `is:` (status), `t:`/`p:`/`a:`/`l:`;
  plus `assignee:me` and `assignee:none`. Quoted values hold spaces. A leading `-`
  (or `!`) **negates** a field token — `-type:bug`, `-#UX` — excluding matches.
- **Fields**: `type`, `assignee`, `status`, `priority`, `label`
  ([035](./035-labels-on-card-and-filter.md)), plus `epic`
  ([029](./029-epic-on-card.md)) once epics are modelled. Each is client-side over the
  loaded issues, with completion from their loaded values.
- **Fuzzy** free-text via the new shared `utils/fuzzy.ts` (the matcher specs/010
  will reuse). Case-insensitive subsequence with word-boundary/consecutive
  bonuses.
- **Suggestions**: field starters when no field is open, else that field's values
  (from `board.tasks`) with match counts and type/priority/avatar colours; `↑/↓`
  move, `Tab` accepts.
- **Keep-parents-of-visible**: a matching sub-task keeps its parent so it doesn't
  become an orphan lane. The reverse — a matching parent keeping all its sub-tasks — is
  the `⇧F` scope toggle ([043](./043-subtask-filter-scope.md)).
- **Not yet**: saved filters (P3), match highlighting (P3), author/component
  filters (P2), and resolving `assignee:me` against Jira's current user (mock
  only for now). (`label` filtering shipped — [035](./035-labels-on-card-and-filter.md).)

## Description

A filter/search bar — in the spirit of presto/monq's filter bar — to narrow the visible issues
by free-text keyword and by field predicates (type, assignee/author, status, priority).
Filtering is a **view concern**: it hides non-matching cards without mutating the board, and
works across all view modes ([017](./017-view-modes.md)) and groupings
([009](./009-swimlanes.md)).

## Capabilities

### P1 — Must Have

- A filter bar toggled by a binding (e.g. `/`) and from the command palette
  ([010](./010-command-palette.md)); typing filters the board live.
- **Free-text keyword** match over all card fields — key, summary, assignee, type,
  priority, status, labels, and linked epic (fuzzy, reusing
  [010](./010-command-palette.md)'s matcher).
- **Field filters**: by issue **type** (story / task / bug / …), by **assignee** (including
  unassigned), and by **status**.
- Filters **compose** (AND across fields, plus the free-text match). Clear with `Esc` or a clear
  action.
- Filtered-out cards are hidden; column/lane **count badges reflect the filtered set**; empty
  columns/lanes still render (`—` / see [009](./009-swimlanes.md)).
- The cursor stays on a visible card; if the focused card is filtered out, it moves to the nearest
  visible one.

### P2 — Should Have

- **Structured query tokens** in the bar (presto-style), e.g. `type:bug assignee:me is:done text`,
  parsed into predicates; the remainder is free text.
- Filter by **priority** and by **author/reporter**; by label/component if the provider supplies
  them.
- `assignee:me` / current-user shorthand.
- Keep the active filter across view-mode switches within a session.

### P3 — Nice to Have

- Saved/named filters in config ([015](./015-configuration.md)); note the relationship to
  [016](./016-multiple-boards.md)'s per-board JQL (board-defining vs. in-board narrowing).
- Highlight matched substrings in card summaries.

## Out of Scope

- **Server-side JQL** querying — filtering is client-side over the already-loaded `board.tasks`.
  The JQL that *defines* a board is [016](./016-multiple-boards.md) / [015](./015-configuration.md).
- Persisting filters across sessions beyond config-defined saved filters.
- Regex search.

## Technical Notes

- A `Filter` predicate derived from the bar state is applied **inside the same derived-view
  `useMemo`** that groups tasks ([002](./002-board-view.md) / [009](./009-swimlanes.md)) —
  filtering happens *before* grouping, so counts and lanes reflect matches. It is view state in
  `App`, not a data change (the show/hide pattern from [008](./008-sub-tasks.md)).
- Token parsing (P2) mirrors the presto/monq filter-bar parser: tokenise `field:value` pairs, the
  remainder is free text; unknown fields fall back to text. Fuzzy text via
  [010](./010-command-palette.md)'s `utils/fuzzy.ts`.
- Candidate values (types, assignees, statuses) for autocomplete come from the current
  `board.tasks`; no extra provider calls for P1.
- Colours/glyphs from `theme.ts` / `utils/glyphs.ts`.

## File Structure

| File | Change |
|------|--------|
| `src/components/FilterBar.tsx` | New: filter/search input + active-filter chips |
| `src/filter.ts` | New: `Filter` predicate + token parser + apply-to-tasks |
| `src/App.tsx` | Filter state; apply in the derived view; `/` binding; keep cursor on a visible card |
| `src/commands/builder.ts` | Palette entries to open / clear the filter |
