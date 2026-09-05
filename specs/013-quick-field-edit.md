# Quick Field Edit

**Status**: Draft

## Description

Fast, single-field changes on the focused issue via a quick-pick overlay: change **status**,
**assignee**, **priority**, and similar fields without opening the full editor. Keyboard-first
and instant.

## Capabilities

### P1 — Must Have

- Change **status** via a picker of valid transitions (this is the picker equivalent of the
  drag in [006-card-movement](./006-card-movement.md); both perform the same transition).
- Change **assignee** via a picker of candidate users.
- Change **priority** via a picker.
- Each change persists through the provider; optimistic with revert-on-failure.
- Reachable both by direct key binding and from the command palette.

### P2 — Should Have

- Additional single fields as needed (e.g. issue type), following the same picker pattern.
- Pre-filter the picker by typing (fuzzy).

## Out of Scope

- Multi-field editing in one go — that's [012-create-and-edit-items](./012-create-and-edit-items.md).
- Bulk changes across multiple cards.

## Technical Notes

- Each quick-edit is a small fuzzy picker overlay reusing the palette/dialog pattern; the
  candidate list and the update both go through the `jira` CLI
  ([005](./005-jira-provider.md)):
  - **status** → `jira issue move <KEY> "<status>"`
  - **assignee** → `jira issue assign <KEY> <user>`
  - **priority** → `jira issue edit <KEY> -y <priority>` (confirm flag)
- Status changes must respect **valid Jira transitions**, not assume any value is reachable
  (same constraint as [006-card-movement](./006-card-movement.md)).
- Candidate lists (assignable users, priorities) come from the CLI where it can supply them;
  otherwise from a configured/static list. Confirm at implementation time.

## File Structure

| File | Change |
|------|--------|
| `src/components/FieldPicker.tsx` | New: generic single-field fuzzy picker |
| `src/providers/jira.ts` | Candidate lists + field-update commands (`move`/`assign`/`edit`) |
| `src/App.tsx` | Wire quick-edit actions + key bindings |
