# Issue Actions: Open in Browser, Copy Key, Copy URL

**Status**: Draft

## Description

Quick actions on the focused issue: open it in the default web browser, copy its issue key,
and copy its URL. Available by direct key binding and from the command palette.

## Capabilities

### P1 — Must Have

- **Open in browser** — open the issue's Jira URL in the default browser.
- **Copy key** — copy the issue key (e.g. `BOARD-123`) to the clipboard.
- **Copy URL** — copy the issue's full Jira URL to the clipboard.
- Each action confirms with a brief, non-blocking notification.

## Out of Scope

- ~~Copying other fields (summary, description) — not requested.~~ **Superseded:**
  [054](./054-copy-fields.md) adds `⇧D` (description as Markdown) and `⇧U` (title).
- ~~Opening anything other than the single focused issue.~~ Copying (not opening) many
  at once is now [055](./055-multi-select-copy.md); opening stays single-issue.

## Technical Notes

Mirrors presto's `actions/tools.ts`:

- **Open in browser** delegates to the CLI: `jira open <KEY>` (the CLI opens the default
  browser), exactly as presto uses `gh pr view --web`. No OS-opener code of our own.
- **Copy** uses the platform clipboard as presto does — `pbcopy` on macOS, `xclip`/`xsel` on
  Linux (`printf <text> | pbcopy`). OSC 52 is a possible alternative for SSH/tmux, but the
  presto approach is the baseline.
- The issue **URL** is the Jira base URL + key. The base URL comes from the CLI's config /
  issue data ([005](./005-jira-provider.md)); against the mock provider, use a placeholder base.
- Feedback uses the transient notification/toast mechanism referenced in
  [nfr/004-reliability-and-errors](./nfr/004-reliability-and-errors.md) (not yet built).

## File Structure

| File | Change |
|------|--------|
| `src/actions/tools.ts` | New: open-in-browser (`jira open`), copy key, copy URL (pbcopy/xclip) |
| `src/App.tsx` | Wire the three actions + key bindings |
