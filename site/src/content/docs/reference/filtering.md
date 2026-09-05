---
title: Filtering & Search
description: "One grammar, two prompts — / narrows what is loaded, : finds what isn't."
---

There are two prompts and one language. `/` filters the board in front of you, locally and as
you type. `:` sends the same query to Jira. Learning the grammar once covers both.

```text
/ type:bug @me #UX -is:done
: type:bug @me #UX -is:done
```

## The grammar

A query is a sequence of `field:value` tokens plus leftover words.

- Repeating a field **ORs** within it: `type:bug type:task`.
- Different fields **AND** across: `type:bug @me`.
- A leading `-` (or `!`) **negates**: `-is:done`, `-#UX`, `-@ada`.
- Quotes hold spaces: `assignee:"Ada Lovelace"`, `epic:"Checkout 2.0"`.
- Whatever is left over is free text.

### Fields

| Field | Aliases | Matches |
| --- | --- | --- |
| `type:` | `t:` | issue type by prefix — `story`, `bug`, `task`, `epic`, `subtask` |
| `assignee:` | `a:`, `@value` | display name, substring. Also `me`, `none` / `unassigned` |
| `status:` | `is:` | the column title, substring |
| `priority:` | `p:`, `prio:` | `highest` `high` `medium` `low` `lowest`, by prefix |
| `label:` | `labels:`, `l:`, `#value` | one whole label, case-insensitive. Also `none` |
| `epic:` | `e:` | the linked epic's key or name, substring. Also `none` |

`@` and `#` are the shorthands you'll actually type: `@me #UX` is `assignee:me label:UX`.

### Free text

Words with no field are fuzzy (subsequence) matched against the issue key, summary, type,
priority, status, assignee, labels, and the linked epic's key and name.

Each word must land somewhere, but they may land in different places — `ada checkout` finds
Ada's checkout story. A word cannot straddle two fields, so `adacheckout` finds nothing.

## Filtering the board (`/`)

`/` opens the filter bar. The board narrows on every keystroke, and the header shows
`⧉ filtered` with the match count. `esc` clears it.

Filtering is view state — it never touches the board data, and lane counts columns and lanes
from the matches, so the numbers agree with what you see.

### Sub-tasks

A parent whose sub-task matches is kept even if the parent doesn't match, so the matching card
keeps its lane instead of becoming an orphan.

`⇧F` toggles the reverse direction:

- **strict** (default) — every issue matched on its own merits.
- **inherit** — a matching issue brings all of its sub-tasks along.

`@me` under **inherit** answers "what am I on?" with the whole work item rather than the two
rows with your name on them.

### Quick filters

Bind the queries you type daily to a letter and apply them with `f`+letter:

```toml
[filters]
b = "type:bug -is:done"
m = "@me"
u = "#UX -is:done"
```

`f b`, `f m`, `f u`. The letters are instance-wide — the same chord works on every board.

## Searching Jira (`:`)

`:` looks past the board. The same input is read three ways, because asking which you meant
would be a worse prompt:

| You type | Read as |
| --- | --- |
| `SHOP-412`, or `412` | an **issue key** — go straight there. A bare number resolves against the board's project |
| `project = SHOP AND labels = infra` | **JQL** — run verbatim |
| `@ada payment` | the **filter grammar** — translated to JQL |

JQL is detected by shape: a comparison operator (`=`, `!=`, `~`, `>`, …) or a joining keyword
(`AND`, `OR`, `NOT`, `ORDER BY`). Detection is deliberately conservative. For the rare search
whose prose looks like a query, prefix it with `?` to force the words reading:

```text
: ?status = broken
```

### What the translation does

Each field becomes the JQL clause you'd have written yourself:

| Typed | JQL |
| --- | --- |
| `type:bug` | `issuetype = "Bug"` |
| `type:subtask` | `issuetype in subTaskIssueTypes()` |
| `@me` | `assignee = currentUser()` |
| `@none` | `assignee is EMPTY` |
| `#UX` | `labels = "UX"` |
| `-#UX` | `NOT (labels = "UX")` |
| `epic:none` | `parent is EMPTY` |
| `payment` | `text ~ "payment*"` |

Results come back `ORDER BY updated DESC`.

Two values need the loaded board to resolve. **A named assignee** — Jira's JQL takes an account
id, never a display name, so lane looks it up among the people already on the board; one it
can't resolve is reported in the prompt rather than guessed at, since a wrong assignee silently
returns the wrong issues. **An epic by name** likewise resolves to its key.

`type:subtask` deliberately goes through `subTaskIssueTypes()`: the type's name is localised and
differs per instance ("Sub-task", "Subtask", …), the function doesn't.

### Scope

A board can declare the JQL a search starts inside, so your own work is found first:

```toml
[[boards]]
name = "Team Board"
jql = "..."
search_scope = "project = SHOP"
```

`^A` toggles between that scope and all of Jira — the point of a global search is that it can
leave. An issue key ignores the scope entirely: looking up a key from another team is exactly
when you know it.

### What you can do with a result

| Keys | Action |
| --- | --- |
| `↑` `↓` `^Y` `tab` | complete an open field (`epic:`, `#`, `@`) |
| `↵` | open the result — jumps to the card if this board already has it |
| `^T` | keep the whole result set as a tab |
| `^O` | open it in the browser |
| `^Y` / `^U` | copy its key / URL |

`^T` is the interesting one: the result set becomes a board. Columns are derived from the
statuses actually present (results can span projects, so the origin board's columns would map
nothing for the others), ordered to match the board you searched from where they overlap.

Everything that takes a key and a value — assign, rename, labels, epic — works on that tab
unchanged. Two things don't: moving a card transitions by status name rather than by column,
and creating an issue is refused, because a new issue would be filed into the origin board's
project and then vanish on the next refresh.

A query tab holds at most **200** issues. A board's JQL is written to bound itself; a text
search is not, and something has to stop `text ~ "a*"` from paging all day.
