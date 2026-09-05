# Edit Summary & Description in `$EDITOR`

**Status**: Implemented (P1 + P2)

## Description

Press `i` on an issue to open its summary and description in `$EDITOR`, in one
git-commit-shaped buffer. Save and quit to write both back to Jira; leave it empty to
cancel.

Lane can already rename an issue ([012](./012-create-and-edit-items.md)), but a rename
is a one-line input — fine for a title, useless for a description. A description is
prose: multiple paragraphs, lists, code blocks. Editing that in a TUI field would mean
building a text editor, and the user already has one they know. So lane suspends the
renderer, hands the text to `$EDITOR`, and takes it back. This is exactly how `../riff`
edits a PR's title and body, down to the scissors line.

Summary and description share one buffer because they are one thought — you rarely
reword the title without touching the body. Only the fields that actually changed are
written back.

Depends on [007](./007-card-detail-view.md) for the viewer and the ADF → Markdown read
path; this spec adds the write direction.

## Capabilities

### P1 — Must Have

- **`i` opens `$EDITOR`** on the focused issue — from the detail view
  ([007](./007-card-detail-view.md)) *and* straight from a board card or list row, since
  the hand-off is useful without opening the viewer first.
- **One buffer, git-commit shaped**: first line is the summary, blank line, then the
  description as Markdown, then a scissors line (`# ------------------------ >8 ------`)
  below which issue context is shown and everything is ignored on read-back.
- **`$EDITOR` → `$VISUAL` → `vi`** resolution, spawned with the terminal inherited and
  the renderer suspended for the duration; always resumed, including on the error path.
- **Markdown → ADF on write**, so what was typed is what Jira stores.
- **Only what changed is written.** Summary and description are separate Jira calls;
  an untouched field is not sent. Nothing changed at all → a toast, no request.
- **Cancellation is safe**: a non-zero editor exit, an empty buffer, or an empty first
  line all mean "cancelled", and nothing is written.
- **Un-round-trippable descriptions are read-only.** If the ADF contains nodes the
  converter cannot reproduce (`panel`, `media`, `expand`, `extension`, …) — the set
  [007](./007-card-detail-view.md)'s `adfToMarkdown` already reports — `i` refuses the
  description and says why, rather than silently destroying content on save. The summary
  stays editable.

### P2 — Should Have

- **Issue context below the scissors**: key, type, status, assignee, labels, epic, and
  the parent or sub-task list — so the description can be written with the facts in
  view, the way riff puts the diff there.
- **Optimistic update**: the new summary lands on the card before the request resolves
  and reverts on failure, the path every other mutation already takes.
- **The temp file gets a `.md` extension** so the user's editor highlights it, and is
  removed on every exit path.

### P3 — Nice to Have

- `i` while creating an issue ([019](./019-quick-create.md)) — draft the description
  before the issue exists, and send it with the create call. Not built.
- A configurable editor command in [`config`](./015-configuration.md), overriding
  `$EDITOR` for lane specifically. Not built.

## Out of Scope

- **In-app text editing** (a Textarea-based description editor). `$EDITOR` is the
  deliberate choice — it keeps lane out of the text-editing business.
- **Editing anything but summary and description.** The other fields have pickers; a
  free-text buffer is the wrong shape for a status.
- **Comments.** Adding a comment via `$EDITOR` is the obvious next use of this
  machinery, but it needs a comment thread to attach to first — its own spec, after
  [007](./007-card-detail-view.md).
- **Conflict detection.** If someone else edited the issue while the editor was open,
  the write wins. Detecting that needs a version token lane does not fetch today.

## Technical Notes

### The hand-off

The mechanism transplants from `../riff` (`src/utils/editor.ts`, `src/app.ts`):

```
renderer.suspend()
  → Bun.spawn([editor, tmpfile], { stdin: "inherit", stdout: "inherit", stderr: "inherit" })
  → await proc.exited
  → renderer.resume()
```

`useRenderer()` is already wired in [`App.tsx`](../src/App.tsx). The resume must be in a
`finally` — a crashed editor that leaves the renderer suspended leaves a dead terminal.

Building and parsing the buffer are pure functions, tested independently of the spawn:
build takes summary + description + context, parse cuts everything at or after the
scissors line and then splits first-line-vs-rest.

The scissors cut is the *only* thing that removes text. Nothing strips `# ` lines from
the editable part, because in Markdown that character starts a heading — the context
lines below the cut are commented for the reader's benefit, not for the parser's.

### Markdown → ADF

`markdownToAdf(text)` is built on `marked`'s token stream — the same parser
[007](./007-card-detail-view.md)'s renderer uses, so the preview and the payload agree
by construction. It arrived as a transitive dependency of `@opentui/core`; a direct
import deserves a direct dependency, so it is pinned in `package.json` at the version
OpenTUI already resolves. It is the inverse of `adfToMarkdown` over the node set that
spec lists, and lives in the same pure module.

The round-trip is the thing to test: `markdownToAdf(adfToMarkdown(doc))` over a corpus
of real descriptions should be structurally equal to `doc` for every supported node —
and where it is not, that node type belongs in the unsupported set that makes the
description read-only.

### Provider seam

- `editDescription?(key, markdown): Promise<void>` on `BoardProvider` — converts to ADF
  and `PUT`s `/rest/api/3/issue/{key}`, alongside the existing `editSummary`. Optional:
  absent → the description is read-only and `i` edits the summary alone.

## Keyboard

| Key | Action |
|-----|--------|
| `i` | edit summary + description in `$EDITOR` — from the viewer, a card, or a list row |

## File Structure

| File | Change |
|------|--------|
| `src/utils/editor.ts` | **new** — suspend/spawn/resume; buffer build + parse |
| `src/utils/editor.test.ts` | **new** — build/parse, scissors stripping, cancellation |
| `src/adf.ts` | add `markdownToAdf` (the module `007` creates) |
| `src/adf.test.ts` | round-trip corpus |
| `src/useBoardKeymap.ts` | `i` from the board, the list, and the viewer |
| `src/App.tsx` | `editInEditor` — fetch, hand off, write back, refresh the cache |
| `src/useIssueDetail.ts` | `load` (fetch without opening) and `patch` (record a write) |
| `package.json` | `marked` as a direct dependency |
| `src/useBoardMutations.ts` | `submitIssueEdit` — only the fields that changed |
| `src/providers/provider.ts` | `editDescription?` |
| `src/providers/jira.ts` | implement it |
| `src/providers/mock.ts` | implement it against the in-memory description |
| `src/components/ShortcutHelp.tsx` | `i` in the Issue group |

## Decisions (as built)

- **A read-only description is not in the editable buffer at all.** It sits below the
  scissors as context, above a line naming the nodes that blocked it, and whatever the
  editor returns for the body is discarded in favour of the original. Showing it but
  refusing to read it back is the only version where the user can see what they are not
  allowed to break.
- **An empty description is written as `null`, not an empty ADF document.** That is how
  Jira spells "no description"; an empty `doc` renders as a stray blank paragraph.
- **`submitIssueEdit` returns the description it stored** (or null), so the viewer's
  session cache can be updated without refetching — reopening after an edit shows what
  was just written.

## Open Questions

- **Should the key be `i`?** Free and mnemonic-ish for "insert", but `e` already means
  rename and the two are close in meaning — `e` for a one-line title, `i` for the whole
  thing, is a distinction that may not survive contact with muscle memory. Resolve once
  the gesture has been lived with.
- **How lossy is ADF → Markdown → ADF in practice?** The round-trip tests pass over the
  node set lane emits, but that is lane's own output, not a real board's. Decides whether
  the read-only guard is a rare edge case or a constant annoyance — and if it is the
  latter, whether the converter needs passthrough for opaque nodes (carry the original
  ADF for untouched blocks). Resolve by running the round trip over a real board.
- **Does suspend/resume survive a terminal resize while the editor is open?** riff does
  not handle it explicitly, and neither does this. Check before relying on it.
- **Should a discarded body be announced?** Editing a read-only description and typing a
  body anyway silently drops it — the buffer says why up front, but the user gets no
  toast. Resolve if it ever actually happens.
