# Change Labels

**Status**: Implemented (P1 + P2 editor; palette entry & instance-wide autocomplete pending)

## Description

Add and remove **labels** on the focused issue from the board, persisted to Jira,
optimistic with revert-on-failure. Labels already drive client filtering
([020](./020-filter-and-search.md)) and query-swimlane assignment
([016](./016-multiple-boards.md)), so editing them can re-slot a card live — e.g.
adding `UX` moves an issue into the PO/UX lane on the next render.

`Task.labels` already exists; this feature makes it editable.

## Capabilities

### P1 — Must Have

- A binding opens a **label editor** for the focused issue (parent or sub-task, board
  or list view): toggle known labels on/off and add a new one.
- **Optimistic**: apply immediately, then reconcile; **revert** on failure with an
  error ([006](./006-card-movement.md) / [nfr/004](./nfr/004-reliability-and-errors.md)).
- Provider gains `setLabels(key, labels[])` → `jira issue edit <KEY> --label …`
  (add/remove form), the same shell-out pattern as `moveTask` ([005](./005-jira-provider.md)).
- After a change, re-evaluate the card's swimlane/filter placement — falls out of the
  normal state update + `buildLanes` ([016](./016-multiple-boards.md) / grouping).

### P2 — Should Have

- Known-label suggestions from the **loaded issues'** labels, ranked by the fuzzy
  matcher and rendered with the [020](./020-filter-and-search.md) completion UI.
- Multiple add/remove operations in one editing session before committing.
- Reachable from the command palette ([010](./010-command-palette.md)).

### P3 — Nice to Have

- Instance-wide label autocomplete from Jira. **Blocked** by the same `jira` CLI
  passthrough limitation as [025](./025-jql-search.md); P1/P2 use the loaded-issue set.

## Out of Scope

- **Bulk** label edits across cards or a lane.
- Managing the org's label vocabulary (Jira creates a label on first use).

## Technical Notes

- `setLabels` sends the resulting label set (or an add/remove diff, whichever the CLI
  supports cleanly); the CLI rejects invalid input → treat as failure and revert.
- The confirmation toast names the resulting set (`SHOP-1 labels: BFF UX`, or
  `labels cleared`) rather than a bare "updated": with the label tags toggled off
  ([039](./039-card-decoration-visibility.md)) the toast is the only evidence the edit
  landed.
- Reuse the multi-select editor UX and fuzzy matcher from
  [020](./020-filter-and-search.md) / [013](./013-quick-field-edit.md).
- The mock provider implements `setLabels` so the flow (and the live swimlane re-slot)
  works offline.

## File Structure

| File | Change |
|------|--------|
| `src/providers/provider.ts` | `setLabels(key, labels[])` on the seam |
| `src/providers/jira.ts` | `jira issue edit --label` shell-out |
| `src/providers/mock.ts` | Local labels update |
| `src/App.tsx` | Label-edit action + optimistic/revert; open the editor |
| `src/components/…` | Label editor (multi-select; shares the [020](./020-filter-and-search.md) UI) |
