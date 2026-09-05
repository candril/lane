# Change Epic

**Status**: Implemented (P1 picker + `setEpic` + optimistic/revert; P2 epic-source query & palette pending)

## Description

Change (or detach) the **epic** an issue is linked to, straight from the board,
persisted to Jira, optimistic with revert-on-failure. This is the write counterpart of
[029](./029-epic-on-card.md) (which *shows* the epic and filters by it) and the epic twin
of [028](./028-change-labels.md) (which edits labels) — same picker ergonomics, same
optimistic pattern as the status transition ([006](./006-card-movement.md)) and assignee
change ([027](./027-assign-issue-to-user.md)).

`Task.epicKey` already exists and is read from Jira ([034](./034-epic-grouped-backlog.md));
this feature makes it **editable**. Re-linking an issue's epic re-slots it live in the
epic-grouped views ([034](./034-epic-grouped-backlog.md)) and updates the card tag /
`epic:` filter placement ([029](./029-epic-on-card.md)) on the next render.

## Capabilities

### P1 — Must Have

- A binding on the focused issue (parent or sub-task, board or list view) opens an
  **epic picker**: choose among known epics, or **"none"** to detach. Reuses the picker
  UX from [013](./013-quick-field-edit.md) / [027](./027-assign-issue-to-user.md), opening
  on the issue's present epic (marked `◉`, `(no epic)` when it has none).
- **Optimistic**: update the card's epic (tag + grouping placement) immediately, then
  reconcile; **revert** on failure with an error
  ([006](./006-card-movement.md) / [nfr/004](./nfr/004-reliability-and-errors.md)).
- Provider gains `setEpic(key, epicKey | null)` on the seam
  ([provider.ts](../src/providers/provider.ts), beside `setLabels` / `assignTask`) → a
  REST write to the configured epic-link field (`PUT /rest/api/3/issue/{key}` on the
  custom field, or the `parent` field on the unified model — `jira.epic_link_field`,
  `parent` on SHOP; [005](./005-jira-provider.md)). `null` detaches.
- After the change, the card re-slots via the normal state update + `buildLanes`
  ([034](./034-epic-grouped-backlog.md) / grouping), exactly like a label edit re-slots a
  swimlane ([028](./028-change-labels.md)).

### P2 — Should Have

- **Epic candidate source — a query.** The loaded issues often reference few or no epics
  (a board of loose stories; Checkout references none today), so suggesting epics from
  the loaded set alone is thin or empty. A configurable **epic-source JQL** (per board /
  instance — e.g. `issuetype = Epic AND statusCategory != Done AND <team>`) fetches the
  meaningful candidate epics — one cheap `search/jql` requesting `summary` so candidates
  show names. Merge with epics already referenced by loaded issues, rank with the fuzzy
  matcher ([020](./020-filter-and-search.md) / [013](./013-quick-field-edit.md)). This
  same candidate set feeds the `epic:` filter completion ([029](./029-epic-on-card.md) P2).
- Provider gains `fetchEpics()` backing that candidate list.
- Reachable from the command palette ([010](./010-command-palette.md)).
- A pending/in-flight state on the card while the write runs
  ([006](./006-card-movement.md) P2).

### P3 — Nice to Have

- Live, instance-wide epic search as you type in the picker — no longer blocked (the
  `jira` CLI passthrough limit is gone since the provider moved to REST; contrast
  [025](./025-jql-search.md)). The P2 epic-source query gives a meaningful base set; this
  is the incremental-search refinement on top.
- Create-and-link a new epic in one step. Out of scope for now (epic *creation* is
  [012](./012-create-and-edit-items.md) territory).

## Out of Scope

- **Showing** the epic / filtering by it — [029](./029-epic-on-card.md).
- **Grouping** by epic — [034](./034-epic-grouped-backlog.md).
- Creating or editing the **epics themselves** (name, status) — only the *link* from an
  issue to an existing epic.
- **Bulk** re-linking across cards or a whole lane.
- Filing a *newly created* issue under an epic — that's create's `epicKey`
  ([019](./019-quick-create.md)); this is re-linking an existing issue.

## Technical Notes

- **Field parity with read.** `setEpic` writes the same field the provider reads for
  `epicKey` — `jira.epic_link_field` (`parent` on SHOP's unified hierarchy, an "Epic Link"
  custom field on classic projects; [034](./034-epic-grouped-backlog.md)). Writing
  `parent` re-parents to the epic; a custom field takes the epic key as its value. `null`
  clears it.
- **Binding.** `⇧E` opens the epic picker (mnemonic: **E**pic), sitting beside bare `e`
  (rename) without colliding with the other single-key actions (`a` assign, `#` labels,
  `o`/`y` issue actions, `n` create — see [App.tsx](../src/App.tsx)). The shifted form is
  checked before bare `e`.
- Reuse the picker component/UX from [013](./013-quick-field-edit.md); its value source
  is the epic candidate set (P2), the same source [029](./029-epic-on-card.md) uses for
  `epic:` completion.
- The mock provider implements `setEpic` (and `fetchEpics`) so the flow — and the live
  epic-grouped re-slot — works offline; it already seeds an epic
  ([mock.ts](../src/providers/mock.ts)).

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts` | `setEpic(key, epicKey \| null)` (+ `fetchEpics()`) on the seam |
| `src/providers/jira.ts` | `setEpic` REST write to the epic-link field; `fetchEpics` (epic-source JQL) |
| `src/providers/mock.ts` | Local `setEpic` / `fetchEpics` |
| `src/config/types.ts` / `validate.ts` | `epic_jql` (per board / instance) for the candidate source |
| `src/App.tsx` | Epic-change action + optimistic/revert; open the picker; palette entry |
| `src/components/…` | Epic picker (shares [013](./013-quick-field-edit.md) UI) |

## Open Questions

- ~~**Binding choice**~~ **Resolved:** `⇧E` (checked before bare `e`/rename).
- **Where the candidate list lives when a board references no epics** — relies on the P2
  `epic_jql`; until that's configured, the picker's list is limited to loaded-issue epics
  (often empty), so P1 is most useful once P2 lands.
