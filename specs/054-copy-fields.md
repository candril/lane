# Copy Description & Title

**Status**: Implemented

## Description

`⇧D` copies the focused issue's description — as Markdown — and `⇧U` copies its title.
Getting issue content into another tool (a PR body, a commit message, a chat, a prompt)
previously meant opening the browser or `$EDITOR` just to select text lane already had:
the provider converts ADF to Markdown for the viewer ([007](./007-card-detail-view.md))
and the editor hand-off ([049](./049-edit-in-editor.md)), so the clean source text is
one clipboard write away.

Both keys act on `currentKey`, so they work from a board card, a list/backlog row, and
inside the open viewer, like the other issue actions ([014](./014-issue-actions.md)) —
whose Out of Scope originally excluded exactly this, and is superseded here.

## Capabilities

### P1 — Must Have

- **`⇧D` copies the description as Markdown.** From a card nothing has been fetched
  yet, so it goes through the same session-cached per-issue load as `i`
  ([049](./049-edit-in-editor.md)); from the open viewer it is a cache hit.
- **`⇧U` copies the title as `KEY summary`** — the key prefixed, so the paste works as
  a reference (a standup line, a PR body) without a second copy for the key alone,
  which `y` already covers.
- **Toast feedback**: `KEY description copied` / `KEY title copied`; an issue without a
  description says so instead of copying nothing.
- **Palette commands** `issue:copy-description` / `issue:copy-title`
  ([010](./010-command-palette.md)).

### P2 — Should Have

- **`⇧U` follows the multi-select** ([055](./055-multi-select-copy.md)): with issues
  selected it copies one title per line, like `y`/`⇧Y` do for keys/URLs.

### P3 — Nice to Have

- ~~A combined `KEY title` form, for pasting references that should read as both.~~
  **Resolved:** promoted to the P1 default — `⇧U` always prefixes the key; a bare
  summary copy earned no key of its own.

## Out of Scope

- **Multi-issue description copy** — concatenated bodies have no obvious framing
  (separators? headers?); copy the keys ([055](./055-multi-select-copy.md)) and fetch
  what you need instead.
- **Copying the raw ADF or rendered HTML** — Markdown is the interchange format
  everywhere in lane ([049](./049-edit-in-editor.md)).
- **Non-macOS clipboards / OSC 52** — [014](./014-issue-actions.md)'s note stands;
  `copyToClipboard` is the single seam to extend.

## Technical Notes

- `copyToClipboard` ([`src/actions.ts`](../src/actions.ts)) already takes any string;
  these are just new callers.
- The ADF→Markdown round trip is lossy when `unsupported` is non-empty
  ([049](./049-edit-in-editor.md)). Copying is read-only, so unlike the editor path —
  which goes read-only to protect the source — the copy simply carries what the
  conversion kept: a fidelity note, not a data-loss risk.
- Both keys sit in the keymap's global section beside `y`/`⇧Y`, above the
  detail-overlay swallow, which is what makes them work in the viewer for free.
- In the viewer `^D`/`^U` scroll ([007](./007-card-detail-view.md)); the copy keys are
  the shifted letters, which the ctrl checks never match.

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | `copyDescription()` (cached load → clipboard), `copyTitle()` |
| `src/useBoardKeymap.ts` | `⇧D` / `⇧U` in the global section |
| `src/commands/builder.ts` / `run.ts` | `issue:copy-description`, `issue:copy-title` |
| `src/components/ShortcutHelp.tsx` | `⇧D / ⇧U` row in the Issue group |
| `src/components/IssueDetail.tsx` | `⇧D copy` in the footer hints |
