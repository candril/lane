# One Filter Language

**Status**: In Progress — P1 built

## Description

lane has two prompts that both narrow a set of issues, and they speak different
languages. `/` ([020](./020-filter-and-search.md)) takes `type:bug @me is:review #UX
epic:SHOP-123` with live completions; `:` ([046](./046-global-search.md)) takes free text,
an issue key, or raw JQL. So the syntax you have in your fingers does the *wrong thing* in
the other prompt, silently:

```
epic:SHOP-1  typed into /  → filters by epic
epic:SHOP-1  typed into :  → text ~ "epic:SHOP-1*"  → 0 results
```

Nothing says the query was misread — "0 found" reads as "not in Jira" when it means
"wrong prompt". And it bites exactly where a query tab ([047](./047-query-backed-tabs.md))
needs it most: filtering by epic or team is what makes a kept search worth keeping, and
today that means writing raw JQL by hand.

So: **`:` parses the same grammar as `/` and completes the same way**, translating what it
parses into JQL instead of matching it locally. One language, two scopes — matched against
the loaded board when you type it into `/`, sent to Jira when you type it into `:`.

## Decisions (as built)

- **P1 is built.** `parseQuery` is reused untouched; the new code is a translator in
  [search.ts](../src/search.ts), and the prompt shows `/`'s completion list whenever a
  field token is open.
- **Bare-word starters stay out**, as specced — but the divergence turned out smaller than
  feared: with completions only on an open field, ↑/↓ belong to the result list for every
  plain text search, and to the completion list the moment you type `epic:`, `#` or `@`.
- **A dropped term reports rather than disappearing.** `@nobody` yields no clause, so the
  query would have been either empty or silently narrower; the prompt says
  `unknown: @nobody` and runs whatever else was typed.
- **`epic:` resolves like `/` does** — a full key, a partial key (`epic:60400`), or a word
  from the epic's name, all looked up against the loaded board before the clause is built,
  because JQL needs the whole key where `/` could substring-match.
- **The mock now carries `accountId`s**, derived from the display name. Without them `@name`
  was unresolvable offline and the feature could not be exercised without a network — the
  Jira provider has supplied them since [027](./027-assign-issue-to-user.md).
- **Sub-task negation reads well**: `-type:subtask` becomes
  `NOT (issuetype in subTaskIssueTypes())`, which is why the type term uses the function
  rather than a literal name.

## Capabilities

### P1 — Must Have

- **The same grammar**: `:` parses its input with [020](./020-filter-and-search.md)'s
  parser — every field, alias, `@`/`#` shorthand and `-` negation — rather than a second
  spelling of the same idea.
- **Translated to JQL, not matched locally**: `type:bug` → `issuetype = Bug`, `#UX` →
  `labels = UX`, `epic:SHOP-123` → the configured epic-link field, `is:review` → the board
  status that prefix matches, `p:high` → `priority = High`. Repeated fields `OR` within and
  `AND` across, exactly as `/` treats them, so the same query means the same thing in both
  prompts.
- **`@me` → `assignee = currentUser()`**, and a **named person resolved from the loaded
  board's `accountId`s** — Jira's JQL takes an account id, not a display name, and the
  board already carries them ([027](./027-assign-issue-to-user.md)). A name that resolves
  to nobody is reported in the prompt rather than silently dropped or silently wrong.
- **Free text still wins the leftovers**: anything that isn't a field token stays
  `text ~ "…*"` with [046](./046-global-search.md)'s prefix wildcard, `AND`-ed with the
  fields.
- **The same completions**: the field-value list `/` offers, in the prompt, ranked the same
  way, accepted with `Tab` / `^Y`. Candidates come from the *loaded board* even though the
  search isn't limited to it — the values you search for are overwhelmingly your team's,
  and the scope chip is what governs reach.
- **Raw JQL still passes through** unchanged, on `↵` ([046](./046-global-search.md)). The
  grammar only gets input the JQL detector didn't claim.
- **Field tokens run live**, like text: a complete `epic:SHOP-1` is valid JQL the moment it
  is typed, unlike half-written raw JQL.

### P2 — Should Have

- **A named person the board doesn't know**, resolved with a user lookup instead of only
  from loaded issues.
- **`team:`** as a first-class field, for the case that motivated this. Today the team is
  the board's `search_scope` chip ([046](./046-global-search.md)), which covers the common
  case; a field would let you cross into another team's work without dropping the scope
  entirely.
- **Field starters in the prompt** (`e` → `epic:`), which `/` offers and `:` deliberately
  does not — see Out of Scope.
- **`created:`/`updated:` date fields**, which have no meaning in a client-side filter over
  a loaded board but are natural in a server query.
- The translation reused by [025](./025-jql-search.md)'s autocomplete, so a JQL-mode query
  and a grammar query complete from one source of truth.

### P3 — Nice to Have

- Show the generated JQL in the prompt (a dim line under the input), so the grammar teaches
  the JQL rather than hiding it.
- `/` in a query tab suggesting values from the *query's* results rather than the board's.

## Out of Scope

- **Bare-word field starters in `:`.** `/` completes a bare word into a field name
  (`e` → `epic:`), because it has no competing list to display. `:` does: its result list
  and a completion list both want ↑/↓, and a plain text search — the most common thing
  typed there — must not have its results replaced the moment a letter happens to fuzzy
  match a field name. So `:` completes only once a field token is open (`epic:`, `@`, `#`).
  This is a forced divergence, not a preference; P2 revisits it if the prompt grows a way
  to show both lists.
- **Changing `/`.** The grammar, the parser and the completion ranking are
  [020](./020-filter-and-search.md)'s and stay exactly as they are; this spec consumes
  them.
- **A JQL builder UI** — [025](./025-jql-search.md).
- **Making the two prompts one.** They answer different questions: `/` narrows what is
  loaded, `:` finds what isn't. Shared grammar, separate prompts.

## Technical Notes

- **`parseQuery` is reused verbatim** ([filter.ts](../src/filter.ts)). The new code is a
  translator: `ParsedQuery` → JQL, living in [search.ts](../src/search.ts) beside the key
  and JQL readings it joins.
- **Value resolution needs the board**, so the translator takes it: statuses resolve
  through the board's columns the way `/` prefix-matches them, and people resolve through
  the `assigneeId` the tasks already carry.
- **The epic field is per-instance**: `parent` on the unified hierarchy, a custom field id
  on classic projects ([034](./034-epic-grouped-backlog.md)). The provider knows it; the
  source has to carry it (`BoardSource.epicField`) for the translator to emit the right
  clause.
- **Sub-task type translates to `issuetype in subTaskIssueTypes()`**, not a literal name —
  the name is localised and varies per instance, the function does not.
- **Negation is `NOT (…)`** around the positive clause, so `-#UX` can't be confused with
  "has a label that isn't UX" — `labels != UX` is false for an issue with two labels.
- **Suggestions are `suggestions(input, board, ctx)`** unchanged; what the prompt adds is
  deciding *when* to show them (a field is open) and giving them ↑/↓/Tab while they're up.
- The prompt's existing keys stay: the completion list only borrows ↑/↓ and `Tab`/`^Y`
  while it is showing, and `↵` accepts a completion rather than opening a result then.

## Open Questions

- **What should an unresolvable `@name` do?** Proposed: run the rest of the query and say
  `unknown person: ada` in the hint line — visible, non-fatal, and self-correcting once you
  use the completion list. The alternatives (drop it silently, or refuse the query) are
  wrong in opposite directions.
- **Does `is:` resolve against the board's columns or Jira's statuses?** Columns for P1,
  since that is what `/` does and what the completions offer. A search that leaves the
  project may then miss a status the board never had — acceptable while the scope chip
  keeps most searches inside the team.

## File Structure

| File | Change |
|------|--------|
| `src/search.ts` | `ParsedQuery` → JQL translation; grammar becomes the non-JQL reading |
| `src/tabs.ts` | `BoardSource.epicField`, so the translator can name the epic-link field |
| `src/index.tsx` | Fill it from the board's Jira config |
| `src/App.tsx` | Suggestions for the prompt; accept a completion; unresolvable-person hint |
| `src/useBoardKeymap.ts` | ↑/↓/Tab/`^Y` go to the completion list while it is showing |
| `src/components/SearchPrompt.tsx` | Render the completion list; grammar placeholder |
| `src/components/ShortcutHelp.tsx` | The completion keys in the Find group |
