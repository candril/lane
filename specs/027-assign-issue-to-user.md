# Assign Issue to a User

**Status**: In Progress — `a` opens a picker: me / unassign / board people (fuzzy);
optimistic + revert. Board people are resolved to an exact `accountId` (via
`jira issue view`) so assignment is non-interactive. `currentUser` comes from the
startup `/myself` preflight, which is also what `assignee:me` / `@me`
([020](./020-filter-and-search.md)) and the `f`-chord quick filters
([036](./036-quick-filters.md)) match on. Still pending: the command-palette entry and
the in-flight card state.

## Description

Change the **assignee** of the focused issue straight from the board — assign to me,
unassign, or pick a user — persisted to Jira, optimistic with revert-on-failure. This
is the assignee counterpart to the status transition ([006](./006-card-movement.md))
and reuses the picker ergonomics of [013](./013-quick-field-edit.md).

`Task.assignee` already exists (shown as the card avatar, filtered by `@me` in
[020](./020-filter-and-search.md)); this feature makes it editable.

## Capabilities

### P1 — Must Have

- A binding on the focused issue (parent or sub-task, in board or list view):
  - **assign to me** (`currentUser`) and **unassign** as one-key actions, and
  - a **picker** to choose among known users, opening on the issue's present assignee
    (marked `◉` and highlighted first, `Unassigned` when there is none).
- **Optimistic**: update the avatar immediately, then reconcile; **revert** on failure
  with an error ([006](./006-card-movement.md) / [nfr/004](./nfr/004-reliability-and-errors.md)).
- Provider gains `assignTask(key, assignee | null)` → `jira issue assign <KEY> <user>`
  (and the CLI's unassign form), the same shell-out pattern as `moveTask`
  ([005](./005-jira-provider.md)).

### P2 — Should Have

- The user list comes from the **loaded issues'** assignees plus `currentUser`, ranked
  by the fuzzy matcher and rendered with the completion UI from
  [020](./020-filter-and-search.md) / [013](./013-quick-field-edit.md).
- Reachable from the command palette ([010](./010-command-palette.md)).
- A pending/in-flight state on the card while the change runs
  ([006](./006-card-movement.md) P2).

### P3 — Nice to Have

- Live user search from Jira. **Confirmed unavailable**: the `jira` CLI has no `user`
  command at all (only `me`), so there's no way to enumerate/search users. P1/P2 use the
  loaded-issue people; anyone else is reachable by typing their exact name/email, which
  `jira issue assign` resolves. A raw REST client is disallowed
  ([nfr/003](./nfr/003-security-and-credentials.md)).

## Out of Scope

- **Bulk** assignment across cards or a whole lane.
- A full org user directory / arbitrary user search (P3, blocked).

## Technical Notes

- **Assign by identifier, not display name.** `jira issue assign <KEY> "<display name>"`
  opens an *interactive* fuzzy picker (a display name isn't unique), which lane can't drive
  headlessly — it seizes the TUI's terminal. An exact `accountId` (or email) skips the prompt
  (`jira issue assign <KEY> <accountId>` → verified non-interactive). `null` unassigns
  (`jira issue assign <KEY> x`).
- **The list doesn't carry the id — the view does.** jira-cli's `issue list --raw` uses a
  *reduced* model whose user objects are `{ displayName }` only: no `accountId`, no email. So
  `Task.assigneeId` is always undefined against real Jira and the picker would submit a bare
  display name → the interactive picker. `jira issue view <KEY> --raw`, by contrast, returns
  the full Atlassian JSON with `accountId` (always present) and `emailAddress` (may be hidden).
- **Resolve the id lazily at assign time.** Each candidate carries a `sampleKey` — a loaded
  issue the person is currently assigned to. On assign, the provider `issue view`s that key,
  reads `accountId`, and assigns by it (memoized per session). A staleness guard checks the
  viewed `displayName` still matches the candidate before assigning, so a server-side
  reassignment of the sample issue can't silently target the wrong person. Cost: one fast call
  the first time you assign *to* a given person.
- **Off-list free text is refused against Jira.** With no way to resolve a stranger's
  `accountId` (jira-cli has no user search — P3), passing free-typed text is exactly what trips
  the interactive picker, so the Jira path rejects it and asks you to pick someone on the board.
  The mock still accepts free text.
- The picker's candidate `label` (display name) drives the optimistic card update; the resolved
  `accountId` is stamped back onto `Task.assigneeId` so a re-assign to the same person is instant.
- Reuse the picker component/UX from [013](./013-quick-field-edit.md); its value source
  is loaded assignees + `currentUser`, the same source [020](./020-filter-and-search.md) uses.
- The mock provider implements `assignTask` so the flow works offline.

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts` | `assignTask(key, assignee \| null)` on the seam |
| `src/providers/jira.ts` | `jira issue assign` shell-out |
| `src/providers/mock.ts` | Local assignee update |
| `src/App.tsx` | Assign action + optimistic/revert; open the picker |
| `src/components/…` | Assignee picker (shared with [013](./013-quick-field-edit.md)) |
