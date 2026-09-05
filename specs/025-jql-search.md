# JQL Search with Autocomplete

**Status**: Draft

## Description

A **server-side** search: type a raw JQL query, run it through the provider
(`jira issue list -q "<jql>"`), and show the results as an ad-hoc board. This is
distinct from [020-filter-and-search](./020-filter-and-search.md), which narrows
the *already-loaded* issues client-side. Filtering answers "hide what's on this
board"; JQL search answers "go fetch a different set from Jira".

The bar offers **JQL-aware autocomplete** — fields, operators, keywords, and
functions — reusing the completion UX and fuzzy matcher built for
[020](./020-filter-and-search.md).

## Capabilities

### P1 — Must Have

- A search input (e.g. a binding distinct from `/`, say `:` or `s`) that takes a
  raw JQL string and runs it via the provider, replacing the visible issues with
  the results (an ad-hoc, unsaved board). `Esc` returns to the current board.
- **Static JQL autocomplete** — grammar-aware completions that need no network:
  - **Fields**: `project`, `status`, `assignee`, `type`, `priority`, `sprint`,
    `labels`, `created`, plus the config's custom fields ([015](./015-configuration.md)).
  - **Operators / keywords**: `=` `!=` `~` `>` `<` `IN` `NOT IN` `IS` `AND` `OR`
    `NOT` `ORDER BY` `ASC` `DESC`.
  - **Functions**: `openSprints()`, `currentUser()`, `startOfDay()`, `endOfWeek()`,
    `membersOf()`, `subTaskIssueTypes()`.
  - Context-aware: after a field → operators; after an operator → values/functions;
    at the start or after `AND`/`OR` → fields.
- Surface JQL errors from the CLI clearly (invalid query → message, keep the bar
  open with the query intact), never a crash.
- The 100-issue cap ([005](./005-jira-provider.md)) applies; warn on truncation.

### P2 — Should Have

- **Save a search as a board**: promote the current JQL to a `[[boards]]` entry
  in `config.toml` ([015](./015-configuration.md) / [016](./016-multiple-boards.md)).
- History of recent JQL queries (session, or persisted) with recall.
- Value completions for enumerable fields from the *loaded* issues (statuses,
  assignees, priorities) — the same source [020](./020-filter-and-search.md) uses.

### P3 — Nice to Have

- Live field/value autocomplete from Jira's JQL autocomplete endpoints
  (`/rest/api/2/jql/autocompletedata`, `.../suggestions`) — see the blocker below.
- Syntax highlighting of the JQL in the bar (fields / operators / strings).

## Out of Scope

- Replacing the config-defined boards — search is exploratory; persisting is P2.
- A JQL *validator/parser* beyond what's needed for context-aware completion; the
  authoritative validation is Jira's (via the CLI's error).

## Open Question — live autocomplete data

Jira exposes JQL autocomplete (fields + per-field value suggestions) at
`/rest/api/2/jql/autocompletedata`, but the `jira` CLI **does not surface it** (it
has no raw API passthrough — confirmed while scoping [018](./018-import-jira-board-config.md)).
So live, instance-accurate field/value completion is **blocked** unless the CLI
gains passthrough; adding a direct REST client is disallowed
([nfr/003-security-and-credentials](./nfr/003-security-and-credentials.md)). P1 is
therefore a **static** vocabulary (JQL grammar + config fields + loaded-issue
values), which covers the common cases without the network.

## Technical Notes

- Reuse [020](./020-filter-and-search.md)'s `FilterBar`/suggestion rendering and
  `utils/fuzzy.ts`; the completion *source* differs (JQL grammar vs. board field
  values), so factor a small `jql/complete.ts` that returns suggestions for a
  caret position given the partial query.
- A minimal tokenizer (field / operator / value / paren) is enough to know "what
  kind of token comes next" for context-aware completion — not a full JQL parser.
- Running the query is a provider concern: add `searchBoard(jql): Promise<Board>`
  (or generalise `loadBoard` to take a JQL), mapping results through the existing
  `toTask` path in [005](./005-jira-provider.md).
- Distinguish visually from the client filter: different prompt glyph and a
  "searching…" state while the CLI runs (server round-trip, unlike the instant
  client filter).

## File Structure

| File | Change |
|------|--------|
| `src/jql/complete.ts` | New: JQL tokenizer + context-aware completion vocabulary |
| `src/components/SearchBar.tsx` | New (or a mode on `FilterBar`): JQL input + suggestions |
| `src/providers/provider.ts` | `searchBoard(jql)` (server-side query) |
| `src/providers/jira.ts` | Run arbitrary JQL through `jira issue list -q` |
| `src/App.tsx` | Search binding; swap in results as an ad-hoc board; restore on Esc |
