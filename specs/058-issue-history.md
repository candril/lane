# Issue History

**Status**: Implemented

## Description

The viewer ([057](./057-detail-navigation.md)) shows what an issue *is*; reading what
*happened* to it — who moved it, when it was reassigned, what the description said
before someone rewrote it — still meant Jira's activity tab. The changelog is cheap to
have: it rides on the single-issue fetch the viewer already makes (`?expand=changelog`),
so a history section costs no request. And OpenTUI's `<diff>` element renders unified
diffs with tree-sitter highlighting, so a description edit can be *shown* — the change,
not two walls of text.

The section is a peek, not a feed: folded by default, one line per change, and a text
edit opens as a Markdown-highlighted diff in place of the description.

## Capabilities

### P1 — Must Have

- **A `history` section** below the children and above the description, **folded by
  default on every issue** — `▸ history 14`. `z h` unfolds it; folding resets when the
  viewer moves to another issue (see Decisions).
- **One row per changelog entry, newest first**: date and time (local), the author as
  the board's initials chip ([002](./002-board-view.md) — the same person reads the
  same everywhere, and a name column cost half the row), and each field with its new
  value — `4 Sep 14:12  KG  status → In Review · assignee → S. Lüthi`. Not a diff: no old values inline. A field cleared says
  `cleared`. The time is there because a day alone can't order two changes in one
  afternoon, which is exactly the "who moved it last" question.
- **Text edits say so** — `description edited`, `summary edited` — and **`↵` opens the
  edit as a diff**: unified, Markdown-highlighted, in place of the description, with
  the field, date and author as its title. `⌫`/`esc`/`q` return to the viewer; `j`/`k`
  and `^D`/`^U` scroll it.
- **Rows are cursor items** like the links: `j`/`k` reach them, they highlight when
  selected, and the field actions on a history row target the issue itself (a row has
  no key of its own).
- **Noise is dropped**: rank rewrites (one per reorder) and time-tracking entries would
  bury the changes a reader came for.
- **Capped, with the rest one stop away**: the unfolded section draws the newest 10
  and ends in `… 4 more` — a cursor stop; `↵` or `l` on it reveals everything, and
  the cursor lands on the first row it revealed. It sits above the scroll region, so
  a long changelog would otherwise push the description off the screen. There is no
  way back to the cap except the fold (`z h`, `h`), and the section starts capped on
  every issue.

### P2 — Should Have

- Nothing pending.

### P3 — Nice to Have

- **A split view** for wide terminals — the element supports it; unified suits the
  viewer's width today.
- **Comments** in the same timeline. A separate request and a different shape (prose,
  not field changes); its own spec when wanted.
- **Paging past 100** entries — Jira's expand returns the newest hundred; an issue
  older than that shows those.

## Out of Scope

- **Editing from the history** — no revert, no "restore this description". The diff is
  read-only; the editor ([049](./049-edit-in-editor.md)) is where changes are made.
- **Filtering the timeline** by field or author.

## Keyboard

| Key | Action |
|-----|--------|
| `z h` | fold / unfold the history section, from anywhere in the viewer |
| `j` onto `▸ history`, then `l` / `↵` / `z a` | reach the folded heading and open it — the heading is a cursor stop ([057](./057-detail-navigation.md)) |
| `j` `k` `^N` `^P` | reach the rows, as with the links; `h` on a row folds the section and lands on the heading |
| `↵` | on a text edit: open it as a diff |
| `↵` `l` | on `… N more`: reveal the rest |
| `⌫` `esc` `q` | leave the diff (the viewer stays) |
| `j` `k` `^D` `^U` | scroll the diff |

## Technical Notes

- `IssueDetail.history` (`ChangeEntry[]`, newest first) is filled by the Jira provider
  from `changelog.histories` on the single-issue GET, **sorted by timestamp** — the
  order `expand=changelog` returns turned out to differ from the changelog endpoint's,
  so the provider trusts neither — and the noise fields (`Rank`, `WorklogId`, the
  time-tracking trio, `RemoteIssueLink`) dropped. Field names are lower-cased so
  `status` reads as the viewer names it. The day is padded to two cells so the times
  stack in one column.
- `history.ts` turns entries into viewer rows: cursor indices continuing after the
  links, the `field → value` summary, and the first text edit as the row's diff.
- `utils/unifiedDiff.ts` is a small line-LCS unified-diff generator — nothing in the
  tree produced the format `<diff>` consumes. One hunk covering both texts whole:
  descriptions are short enough that trimming context would only cost the paragraphs
  around a change. Removals precede additions on ties, so a change reads "this became
  that".
- The diff renders inside the same scrollbox as the description, so the existing
  scroll keys drive it; while it is up the keymap swallows everything but leave and
  scroll, so the cursor beneath can't move unseen.

## Decisions (as built)

- **Folded per issue, not sticky.** The children fold ([057](./057-detail-navigation.md))
  is sticky because folding it is a layout preference. History is a *peek*: you open it
  on the issue you're curious about, and the next issue should start quiet — sticky
  would turn one look into a changelog on every issue after.
- **Values inline, diffs on demand.** `status → In Review` is what a reader wants at a
  glance; a description's old and new text is not, but a diff of it is exactly right —
  and it was the cheap part, given the element and the data already in hand.

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts` | `ChangeEntry` / `ChangeItem`; `IssueDetail.history` |
| `src/providers/jira.ts` | `expand=changelog` on the single-issue fetch; `toHistory` with the noise filter |
| `src/providers/mock.ts` | seeded changelogs, including a description and a summary edit |
| `src/useIssueDetail.ts` | `history` on `DetailState` |
| `src/history.ts` (+ test) | rows from entries: indices, summaries, the diff payload, the cap |
| `src/utils/unifiedDiff.ts` (+ test) | the unified-diff generator |
| `src/App.tsx` | history fold + diff state, rows in the cursor path, `↵` opening a diff |
| `src/useBoardKeymap.ts` | `z h`; the diff's leave and scroll keys |
| `src/components/IssueDetail.tsx` | the section and the `<diff>` page |
