# Child Visibility

**Status**: Implemented (P1)

## Description

Which children a board draws, as a setting of its own: **all**, **all but the done ones**,
or **none**. It is a second axis over [008](./008-sub-tasks.md)'s layouts — those say
*where* a child sits, this says *whether it is drawn at all* — so the two compose instead
of multiplying into a dozen modes.

Two things drove it. A story that has run for a month drags four finished sub-tasks
through the Done column forever, and they are the least interesting cards on the board:
`hide-done` drops them and marks the parent `✓ 4 done`. And sometimes you want the board
to be a list of work items, not of their pieces: `none` leaves the parents, each carrying
`▸ N subtasks`.

Neither was expressible before. The `-type:subtask` filter ([020](./020-filter-and-search.md))
removes children from the model entirely — counts and all — and its grammar is flat, so
"done *and* a child" cannot be written at all; on an epic board ([034](./034-epic-grouped-backlog.md))
it does not even name the right issues, since an epic's children are stories. `z ⇧M`
([042](./042-fold-subtasks.md)) hides every child but folds every swimlane with them, and
is per-card transient state rather than a rule. This is the rule.

## Capabilities

### P1 — Must Have

- **Three settings**, per tab, on the `v` chord: `v a` all (default), `v d` hide the done
  ones, `v n` none — plus a palette entry each ([010](./010-command-palette.md)).
- **`hide-done`** withholds children whose status is the board's last column, wherever the
  layout would have put them.
- **`none`** withholds all of them.
- **Nothing silently vanishes**: a parent that is not showing children says so on its card
  — `✓ N done` when they are finished, `▸ N subtasks` otherwise (the marker
  [042](./042-fold-subtasks.md) already had, now shared by both causes).
- **The viewer honours it too** ([057](./057-detail-navigation.md)): `hide-done` keeps
  the finished children out of its list under the same `✓ N done` marker, and `none`
  starts the section folded, where the heading already carries the count.
- **Composes with every layout** ([051](./051-parent-baskets.md), 008): a basket with no
  children left is not drawn, a checklist with none falls back to a plain card, and one
  hiding only *some* of its rows carries the marker as a final muted row (it reads as a
  note under the list, indented to the row summaries rather than posing as another row).
- **Per tab and persisted**, like the layout and the tag toggles
  ([039](./039-card-decoration-visibility.md), [045](./045-ad-hoc-tabs.md)): unset on a tab
  → the `[display] children` config default → `all`.

### P2 — Should Have

- **The by-parent view keeps its content**: `hide-done` thins each lane to what is left of
  the story while the lane header keeps the *total* count, so "3" over one card reads as
  "two are finished". `none` is ignored there — the children *are* the lane.

### P3 — Nice to Have

- Hide children done *before* a date ("this sprint's leftovers"), rather than all done.
- A column-level version: collapse the Done column's children only
  ([040](./040-collapse-columns.md) collapses the whole column today).

## Out of Scope

- Hiding *parents* — that is what the filter is for; this setting only ever withholds
  children, so a board never loses a work item.
- The list and backlog views: they have their own disclosure (`enter` / `h` / `l`), and
  reconciling the two is the same open question 042 left.
- Changing counts: the lane and column counts follow the cards, but the *issue* is still
  in the board and still matched by filters — hiding is not filtering.

## Technical Notes

- `LaneOptions.children` reaches `flatColumns`, whose `childrenOf` is the single place a
  child can be withheld — fold, `hide-done` and `none` all resolve there, so no layout
  branch has to know about visibility. The by-parent branch filters separately, since it
  builds its cells from the children directly.
- `BoardCard.folded` became `hidden?: { count, done }`: the card needs to say *how many*
  it is not showing and *why*, and the two causes now differ. Done-ness is decided by the
  board's last column, the same rule `Board` uses to strike a card through.
- The setting is `Projection.children`, set through `updateProjection` like the layout.

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` | `ChildVisibility`, `[display] children` |
| `src/config/validate.ts` | Validate it |
| `src/grouping.ts` | `LaneOptions.children`; `childrenOf` withholds; `BoardCard.hidden` |
| `src/tabs.ts` | `Projection.children` |
| `src/App.tsx` | Effective visibility (tab → config → `all`), `setChildVisibility` |
| `src/index.tsx` | Read the config default |
| `src/useBoardKeymap.ts` | `v a/d/n` |
| `src/components/Card.tsx` | `✓ N done` / `▸ N subtasks` marker |
| `src/components/ChecklistCard.tsx` | the same marker as a trailing row, for a part-hidden checklist |
| `src/components/Column.tsx` | Pass `hidden` through both paths |
| `src/components/ShortcutHelp.tsx` | Document the keys |
| `src/commands/*` | One palette command per setting |
