# Comments in the History

**Status**: Draft

## Description

The viewer's history ([058](./058-issue-history.md)) says who moved an issue and when,
but not what anyone *said* about it. "Repro'd only on staging", "blocked on the BFF
release", "fixed in #412": the discussion that explains the changes still meant
opening Jira. 058 parked this as a P3 ("comments in the same timeline"), and this spec
picks it up.

Comments join the history as entries of their own, interleaved with the field changes
in one newest-first timeline. A comment row is one line. `↵` opens the full comment in
place of the description, the same way a text edit opens as a diff. The comments come
with the single-issue fetch the viewer already makes, so they cost no request.

Read-only: lane shows the thread and does not write to it.

## Capabilities

### P1 — Must Have

- **Comments are history entries**, interleaved with the changelog by timestamp,
  newest first: `5 Sep 09:03  SL  💬 Fixed in #412, needs QA on…`. Same date column and
  initials chip as a change row ([058](./058-issue-history.md)). After the marker comes
  the comment's first line of text, flattened and elided to the row's width.
- **`↵` on a comment row opens the whole comment**, rendered as Markdown in place of
  the description. Its title gives the author's name and the date. The keys are the
  diff page's: `⌫`/`esc`/`q` return, `j`/`k` and `^D`/`^U` scroll.
- **The folded heading counts comments separately**: `▸ history 14 · 3 comments`. History
  starts folded on every issue, and the heading must still show that there is a
  discussion to open.
- **Comments are cursor stops like change rows.** Field actions on a comment row target
  the issue, because a comment has no key of its own (058's rule).
- **Mentions read as names.** Comments lean on `@mentions`, so `adfToMarkdown` renders
  an ADF `mention` node as `@Display Name` instead of dropping it.
- **The cap is 058's, not a new one.** The timeline still draws the newest 10 entries
  and ends in `… N more`, now counting comments and changes together. Comments get no
  limit of their own: everything is one `… N more` away.

### P2 — Should Have

- **Edited comments say so** — `(edited)` after the author when `updated` differs from
  `created`. The entry keeps its `created` position: a comment fixed later still
  answers what came before it.
- **Restricted comments say so** — a comment with a `visibility` restriction (a role or
  a group) carries it in its row, so a reader knows not everyone sees it.

### P3 — Nice to Have

- **Fold to comments only**: a toggle that hides field changes, for issues whose
  changelog is mostly status churn.

## Out of Scope

- **Adding, editing or deleting comments.** Writing a comment means taking up the
  `$EDITOR` machinery ([049](./049-edit-in-editor.md)) and `addComment`. That is its
  own spec, which 049 and [053](./053-close-reason.md) already defer to.
- **Comments on cards or in the list view.** A count or a marker on the board is a
  separate decoration ([039](./039-card-decoration-visibility.md)), and the viewer is
  where the thread is read.
- **Reactions, attachments and inline images in comments.** Whatever `adfToMarkdown`
  cannot represent stays out, as it does for the description.

## Keyboard

| Key | Action |
|-----|--------|
| `z h` | fold / unfold the history, comments included (unchanged from 058) |
| `j` `k` `^N` `^P` | reach comment rows alongside change rows |
| `↵` | on a comment: open the full comment |
| `⌫` `esc` `q` | leave the comment (the viewer stays) |
| `j` `k` `^D` `^U` | scroll the comment |

## Technical Notes

- **No extra request.** Add `comment` to the `fields` of the single-issue GET in
  `loadIssue`, next to `expand=changelog`. Jira returns `fields.comment.comments[]`,
  each with an ADF `body`, `author.displayName`, `created`, `updated` and an optional
  `visibility`.
- **Shape.** `IssueDetail.history` widens from `ChangeEntry[]` to a union: a change
  entry as it is today, or a comment entry `{ kind: "comment", at, author, body,
  edited?, restricted? }` whose `body` is already Markdown. The provider merges and
  sorts both kinds, so `history.ts` receives one ordered list, as it does now.
- **Rows.** `history.ts` already turns a text edit into a row carrying a payload that
  `↵` opens. A comment row carries its Markdown the same way, and `IssueDetail.tsx`
  renders it with the description's `<markdown>` element instead of `<diff>`. The
  page state generalises from `diff` to a "page in place of the description" holding
  either kind.
- **Mentions and the edit guard.** Rendering `mention` as `@Name` must not let a
  description containing one pass the round-trip check of 049. Markdown cannot write
  the mention back, so `mention` stays in the description's `unsupported` list even
  though it now renders.
- **Mock.** Seed a few comments on the demo board, including one with a mention and an
  edited one, so `just mock` and the screenshots show the feature.

## Open Questions

- **The marker glyph.** `💬` is two cells wide in most terminals, and some fonts draw it
  at one, which shifts the row. Options in preference order: `💬` if it renders
  consistently in the terminals lane targets; else a one-cell glyph in the theme's
  comment colour (e.g. `›` or `"`). Resolve by trying both in the demo board.
- **How many comments the issue GET returns.** The `comment` field is paged
  (`maxResults`, `total`). If Jira truncates long threads there, either page through
  `/rest/api/3/issue/{key}/comment` for the remainder or show what came, the way 058
  does for changelogs over 100. Resolve against a real long thread before implementing.

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts` | comment entry in the history union |
| `src/providers/jira.ts` | `comment` in the issue GET fields; map comments into the history and merge by time |
| `src/providers/mock.ts` | seeded comments |
| `src/adf.ts` (+ test) | `mention` → `@Name`; still reported as unsupported for the edit guard |
| `src/history.ts` (+ test) | comment rows: marker, first line, payload; separate comment count for the heading |
| `src/App.tsx` | `↵` on a comment row opens the comment page |
| `src/components/IssueDetail.tsx` | comment row rendering; the heading's comment count; the comment page |
