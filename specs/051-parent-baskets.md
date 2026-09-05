# Parent Baskets

**Status**: Implemented (P1)

## Description

A fourth sub-task layout ([008](./008-sub-tasks.md)): sub-tasks sit in the column their
*own* status puts them in — as in `own-column` — but the ones sharing a parent are drawn
inside a **basket**: a recessed tray headed by the parent's `KEY Summary`.

The motivating use is the board where a story's children are spread over three columns.
`own-column` gets each child into the right column but the link degrades to a dim
`↳SHOP-61329` per card, so reconstructing "what is left on this story" means reading keys.
A basket says it once, at the top of the run, and the cards below it read as one piece of
work in flight. When the parent card itself is in that column the basket holds it as its
first card and prints no header — the card is already the label.

It does not replace `checklist`, or any other layout: the layout is now switchable at
runtime (`v o/u/c/g`), so the same board can be read either way without editing config.

## Capabilities

### P1 — Must Have

- **`basket` layout** (`[display] subtasks = "basket"`): cells identical to `own-column`
  — a sub-task is in its own status column — with each parent's run of cards wrapped in
  a basket.
- **Header only when it says something new**: a basket whose first card *is* the parent
  prints no header; one holding only sub-tasks is headed `KEY Summary` in dim text.
- **No basket for a lone card**: a childless root, and a parent whose children are all in
  other columns, render as a plain card. A tray around one card is noise.
- **No `↳PARENT` reference** in this layout — the basket carries the link, and printing
  both says it twice.
- **Runtime switch**: `v o` own-column, `v u` under-parent, `v c` checklist, `v g`
  grouped (baskets), plus a palette entry per layout ([010](./010-command-palette.md)).
  Direct letters rather than one cycling key: the point is switching *back and forth*
  between two layouts, which a 4-cycle makes a three-press round trip.
- **Per tab, like the tag toggles** ([039](./039-card-decoration-visibility.md)): the
  layout lives in the tab's `Projection` ([045](./045-ad-hoc-tabs.md)), so a cloned tab
  can read the same query a different way, and the choice survives a restart with the
  rest of the session ([033](./033-cached-boot-and-refresh.md)). Unset → the
  `[display] subtasks` default.

### P2 — Should Have

- Folding a parent ([042](./042-fold-subtasks.md)) empties its baskets in every column;
  the parent's own card keeps the `▸ N subtasks` marker and drops its tray. The same holds
  for children withheld by [052](./052-child-visibility.md).

### P3 — Nice to Have

- ~~Baskets keyed on the **epic** rather than the parent, for an epic board
  ([034](./034-epic-grouped-backlog.md)).~~ **Resolved: free.** `parentRef` now carries the
  link the lanes were built on rather than `task.parentKey`, which on an epic board *is*
  the epic — so an epic trays its stories exactly as a story trays its sub-tasks. That
  also fixed `own-column`, where an epic's children had been printing no `↳` reference at
  all.
- A basket header that shows its parent's status, so a story sitting in *On Hold* while
  its children run is visible from the column you are reading.

## Out of Scope

- The by-parent grouping (`g p`) — there the parent *is* the lane header
  ([009](./009-swimlanes.md)), so a basket would draw a box around the whole lane cell.
  The layout is neutralised there, as `checklist` already is.
- Nesting baskets (epic → story → sub-task): one level, like the rest of 008.
- Borders. The tray is a background and padding, nothing else — it has to survive
  terminals that render box-drawing characters at odd widths (nfr/002).

## Technical Notes

- **Cells**: `flatColumns` treats `basket` exactly as `own-column`; the tray is a render
  concern, the same way `checklist` is one over `under-parent` cells. That works because
  the flattened sequence is `[P1, subs(P1), P2, subs(P2), …]` and filtering it by column
  preserves order — so one parent's cards are always *contiguous* within a column, which
  is what lets the renderer group by runs and the cursor keep counting plain rows.
- **`BoardCard.parentSummary`** rides along with `parentRef` so the header needs no
  lookup back into the task list from the renderer.
- **Threading**: `Board` resolves the effective layout once (neutralising it under `g p`)
  and passes a `SubtaskLayout` to `Column`/`Swimlane`, replacing the `checklist` boolean —
  two render variants was a boolean's limit.
- **Colour**: the basket is `theme.bg` — *darker* than the column it sits in, with the
  cards lighter still, so the tray reads as recessed rather than as another card.
- **State**: `Projection.subtasks`, set through `updateProjection` like `epics`/`labels`.
  It is an input to `buildLanes`, so it is read in `App` before the lanes are built.

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` | `"basket"` in `SubtaskLayout` |
| `src/config/validate.ts` | Accept it in `[display] subtasks` |
| `src/grouping.ts` | `basket` shares the `own-column` branch; `BoardCard.parentSummary` |
| `src/tabs.ts` | `Projection.subtasks` |
| `src/App.tsx` | Effective layout (tab → config → default), `setSubtaskLayout`, threading |
| `src/useBoardKeymap.ts` | `v o/u/c/g` in the view chord |
| `src/components/Board.tsx` | Resolve the layout, pass it down instead of `checklist` |
| `src/components/Column.tsx` | `basketCards()`: group runs by parent, render the tray |
| `src/components/Basket.tsx` | New: the tray + its header |
| `src/components/Swimlane.tsx` | Pass the layout through |
| `src/components/ShortcutHelp.tsx` | Document the layout keys |
| `src/commands/*` | One palette command per layout you are not in |
