# Bulk Edit

**Status**: Implemented

## Description

With a multi-select active ([055](./055-multi-select-copy.md)), the field editors act
on the whole selection: `⇧S` sets one status on every selected issue, `a` assigns them
to one person, `⇧E` re-links their epic, `#` edits their labels, `⇧R` closes them all
with one reason. Triaging a sprint previously meant the same picker round trip once per
issue; the selection set was built as exactly this seam ([055](./055-multi-select-copy.md)
P3), and the pickers themselves don't change — only who they write to.

Nothing new to learn: the same keys, the same pickers, the same palette submenus
([010](./010-command-palette.md)) — titled for the count (`status 3 issues`,
`Set status of 3 selected…`) so what is about to happen is always named.

## Capabilities

### P1 — Must Have

- **`⇧S` / `a` / `⇧E` / `#` / `⇧R` act on the selection** when one exists, else on the
  focused issue as before. They fire even with the cursor on nothing selectable, since
  the selection carries the targets.
- **Pickers name the scope**: `status SHOP-1` for one issue, `status 3 issues` for a
  bulk edit; the palette's field commands read `Set status of 3 selected…`.
- **Pre-selection follows the shared value**: the picker highlights the current status
  /assignee/epic/reason only when every selected issue agrees; a mixed set pre-selects
  nothing rather than lying about one of them.
- **Rank is the exception to per-issue revert**: `rankTask` takes the whole block in one
  request, and the issues are ranked *relative to each other*, so a half-applied order is
  not a partial success — it reverts whole, like a single-issue rank always did.
- **One optimistic update, per-issue writes, per-issue revert.** The board updates
  once; the provider is called once per issue; only the issues whose write failed
  revert. One toast carries the whole outcome: `3 moved`, or
  `2 moved · 1 failed (SHOP-9: …)`.
- **Labels edit as a diff.** The editor opens on the labels the selected issues have
  *in common*; additions apply to every issue, removals strike from every issue, and
  labels the editor never showed stay untouched — a replace would silently wipe
  whatever the issues didn't share.
- **`⇧R` splits per issue** ([053](./053-close-reason.md)): the open ones close with
  the reason, the already-done ones have their reason amended.
- The selection survives the edit, so a status change can chain into an assign.

### P2 — Should Have

- Nothing pending.

### P3 — Nice to Have

- ~~**Bulk rank/move-adjacent** (`⇧H`/`⇧L`, `⇧J`/`⇧K` over a selection) — stepping many
  issues relative to their own positions; wants its own ordering semantics.~~
  **Resolved for rank:** `⇧J`/`⇧K` move the marked issues as **one block, gathered at the
  cursor** — the block lands one non-moving sibling further in that direction than the
  cursor sat, so a scattered selection becomes contiguous on the first press and steps as a
  unit after that. The alternative, each mark stepping past its own neighbour (the editor's
  "move line down"), keeps the set scattered forever and reads on a board as several
  unrelated cards twitching at once. Rank is a column's own order, so only the marks in the
  cursor's column and at its hierarchy level take part, and the toast says how many were
  left elsewhere (`3 ranked · 2 elsewhere`); the cursor's card anchors the move whether or
  not it is itself marked, which makes an unmarked cursor read as "bring them here". The
  ordering rule is one pure function ([`src/rank.ts`](../src/rank.ts)) so the board, the row
  views and the viewer's children cannot drift apart on it.
  `⇧H`/`⇧L` over a selection stays out: crossing the backlog divider by ranking is a status
  change ([044](./044-board-backlog.md)), and a bulk transition is `⇧S`, not a reorder — so
  a block stops at the divider.

## Out of Scope

- **Bulk rename / description edit** — prose is written per issue (`e`, `i` stay
  single, [049](./049-edit-in-editor.md)).
- **Bulk create/delete** — nothing here makes or removes issues.
- **A transaction.** Jira has no atomic multi-issue write; this is a fan-out with
  per-issue reverts, and the toast says exactly what landed.

## Technical Notes

- The single-issue writes in [`src/useBoardMutations.ts`](../src/useBoardMutations.ts)
  capture the whole board as their revert point — correct alone, but concurrent calls
  would clobber each other's optimistic state, and one failure would roll back the
  others. The bulk functions (`bulkMoveTo`, `bulkAssign`, `bulkSetEpic`,
  `bulkSetLabels`, `bulkResolution`) instead snapshot the targeted tasks, apply one
  functional update, fan out with `Promise.allSettled`, and restore only the failed
  issues' fields.
- Assign resolves the accountId **once** ([027](./027-assign-issue-to-user.md)) before
  fanning out; a failed resolution reverts everything, since nothing was written.
- The dialogs ([`src/useDialogs.ts`](../src/useDialogs.ts)) and the palette submenu
  ([`src/usePalette.ts`](../src/usePalette.ts)) carry `keys: string[]` — one entry from
  the cursor, or the whole selection — so every surface funnels into the same routing:
  one key → the existing single write (which keeps its cursor-follow), several → bulk.
- A bulk status change deliberately does not chase the cards with the cursor; they
  scatter across a column, and the cursor stays where the user is working.

## File Structure

| File | Change |
|------|--------|
| `src/useBoardMutations.ts` | `fanOut`/`revertFailed`/`bulkToast` plus the five bulk writes |
| `src/useDialogs.ts` | field-picker state carries `keys: string[]` |
| `src/usePalette.ts` | submenu state carries `keys: string[]` |
| `src/App.tsx` | `editTargets`/`editTitle`/`sharedCurrent`/`commonLabels`; start/submit routing; picker props |
| `src/useBoardKeymap.ts` | field-editor guards accept a selection with no focused issue |
| `src/commands/builder.ts` / `types.ts` | field commands offered for and labeled with the selection |
| `src/components/ShortcutHelp.tsx` | `space` row mentions bulk edit |
