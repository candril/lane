# Comments in the History

**Status**: In Progress — P1 built

## Description

The viewer's history ([058](./058-issue-history.md)) says who moved an issue and when,
but not what anyone *said* about it. "Repro'd only on staging", "blocked on the BFF
release", "fixed in #412": the discussion that explains the changes still meant
opening Jira. 058 parked this as a P3 ("comments in the same timeline"), and this spec
picks it up.

Comments join the history as entries of their own, interleaved with the field changes
in one newest-first timeline. A comment row is one line, and `↵` expands it in place to
the full comment. The comments come
with the single-issue fetch the viewer already makes, so they cost no request.

Read-only: lane shows the thread and does not write to it.

## Capabilities

### P1 — Must Have

- **Comments are history entries**, interleaved with the changelog by timestamp,
  newest first: `5 Sep 09:03  SL  " Fixed in #412, needs QA on…`. Same date column and
  initials chip as a change row ([058](./058-issue-history.md)). After a dim `"` comes
  the comment's first non-empty line, with a leading heading, list or quote marker
  stripped.
- **`↵` on a comment row expands it in place**: the one-line row becomes the whole
  comment, rendered as Markdown and wrapped in the row's text column, so the date and
  chip columns stay aligned. `↵` again collapses it. Several can be open at once; all
  close when the viewer moves to another issue, like the fold.
- **The heading counts comments separately**: `▸ history 14 · 3 comments` folded,
  `▾ history · 3 comments` open. History starts folded on every issue, and the heading
  must still show that there is a discussion to open.
- **Comments are cursor stops like change rows.** Field actions on a comment row target
  the issue, because a comment has no key of its own (058's rule).
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
| `↵` | on a comment: expand / collapse it in place |

## Technical Notes

- **No extra request.** Add `comment` to the `fields` of the single-issue GET in
  `loadIssue`, next to `expand=changelog`. Jira returns `fields.comment.comments[]`,
  each with an ADF `body`, `author.displayName`, `created`, `updated` and an optional
  `visibility`.
- **Shape.** `ChangeEntry` gains an optional `comment` (the body, already Markdown); a
  comment entry has no items. `toHistory` merges and sorts both kinds, so `history.ts`
  receives one ordered list, as it did before.
- **Rows.** A comment row carries its Markdown and its entry timestamp. App keeps the
  open comments as a set of timestamps rather than cursor indices, which shift when a
  section above folds. `IssueDetail.tsx` renders an open one with the description's
  `<markdown>` element inside the row's flex-bounded text column. A collapsed row
  doesn't wrap: it is clipped at the edge, because a wrapped row squeezes the date
  column.
- **Mentions** come through `adfToMarkdown` as `@Name`, which it already did for
  descriptions.
- **Mock.** Seed a few comments on the demo board, including one with a mention and an
  edited one, so `just mock` and the screenshots show the feature.

## Open Questions

- ~~**The marker glyph.**~~ **Resolved:** a dim `"`, one cell. Emoji are out: their width
  varies by terminal and font, and they look out of place in the TUI.
- ~~**How many comments the issue GET returns.**~~ **Resolved:** the whole thread — on a
  real 18-comment issue `maxResults` matched `total` and every comment came back, so no
  paging through `/comment`.

## Decisions (as built)

- **In place, not a page.** A page like 058's diff takes every key but leave and
  scroll; for a comment that reads as being stuck, with `q` the only way back. A diff
  needs the room, but a comment is a few lines that belong next to its neighbours, so
  it opens where it is and the cursor keeps moving.

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts` | comment entry in the history union |
| `src/providers/jira.ts` (+ test) | `comment` in the issue GET fields; map comments into the history and merge by time |
| `src/providers/demo.ts` | seeded comments on SHOP-412 |
| `src/history.ts` (+ test) | comment rows: marker, first line, payload; separate comment count for the heading |
| `src/App.tsx` | the open-comments set; `↵` on a comment row toggles it |
| `src/components/IssueDetail.tsx` | comment rows, clipped or expanded in place; the heading's comment count |
