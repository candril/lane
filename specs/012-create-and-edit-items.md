# Create & Edit Items

**Status**: Partial — create + rename-summary (`e`) done via in-TUI prompt; full edit
(description / fields) not yet

## Decisions (as built)

- Resolved the open question in favour of an **in-TUI prompt** (option 2), not
  the interactive CLI spawn — the mock provider has no CLI to spawn, and the
  keyboard-first flow is the point. Create runs `jira issue create --no-input`
  with flags for summary/type/parent + board `createDefaults`.
- Only **create** landed here (summary + type + parent, first column, pending
  insert). Editing summary/description and setting priority/assignee at create
  are still open. See [019-quick-create](./019-quick-create.md) for the ergonomics.

## Description

Create new issues and edit existing ones from the board — at minimum summary, description,
type, and priority. Small, single-field changes (status, assignee, …) are handled separately
by [013-quick-field-edit](./013-quick-field-edit.md); this spec covers fuller create/edit.

## Capabilities

### P1 — Must Have

- Create a new issue (key binding + palette command), choosing at least type and summary,
  landing in a sensible default column.
- Edit an existing issue's summary and description.
- Persist create/edit through the provider; optimistic UI with revert-on-failure
  (see [nfr/004-reliability-and-errors](./nfr/004-reliability-and-errors.md)).

### P2 — Should Have

- Set type, priority, assignee at create time.
- Validation (e.g. non-empty summary) before submit.
- **Inline `+ Create` in a swimlane column** ([009](./009-swimlanes.md), parent mode): create a
  sub-task under that lane's parent, pre-set to that column's status. Pre-fills parent + status,
  then runs the normal create path.
- **Configurable issue-type names** (done): Jira type names vary by project scheme — a sub-task
  is `Technical task` on SHOP, something else on a team-managed project — so `create -t` uses the
  name from `[jira.issue_types]` / `[boards.issue_types]` (specs/030 pattern), falling back to
  the built-in defaults. Without this, `create` fails with `Specify a valid issue type`.

## Out of Scope

- Rich Jira markup editing / attachments / linked issues.
- Creating sub-tasks specifically (may fold in once [008-sub-tasks](./008-sub-tasks.md) lands).

## Open Question — edit surface

Now that the provider is the `jira` CLI ([005](./005-jira-provider.md)), there are two options:

1. **Delegate to the CLI's interactive create/edit** — spawn `jira issue create` / `jira issue
   edit <KEY>` with the terminal inherited (as presto spawns `riff`), letting the CLI drive the
   prompts / `$EDITOR`. Least code; the TUI suspends and resumes around it.
2. **In-TUI form dialog** — collect fields in an overlay, then call the CLI non-interactively
   with flags (`-t`, `-s`, `-b`, …). Keeps the experience inside the app; more code.

Decide before promoting to `Ready`. Option 1 is the smaller first step and matches the
"delegate to the CLI" spirit of 005.

## Technical Notes

- Create/edit run through the `jira` CLI: `jira issue create` and `jira issue edit <KEY>`.
  Interactive spawns use `Bun.spawn(..., { stdin/stdout/stderr: "inherit" })`, the caller
  suspending/resuming the renderer around the child (presto's pattern).
- After a create/edit, refresh the affected issue(s) from the provider to reconcile.
- Custom-field mapping (e.g. story points) is a provider/CLI-flag concern.
- Against the mock provider, create/edit mutate in-memory state (offline dev).

## File Structure

| File | Change |
|------|--------|
| `src/providers/jira.ts` | Create/edit via CLI (interactive spawn and/or flag-driven) |
| `src/components/IssueForm.tsx` | Only if option 2 (in-TUI form) is chosen |
| `src/App.tsx` | Wire create/edit actions + renderer suspend/resume |
