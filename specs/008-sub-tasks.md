# Sub-Tasks

**Status**: Draft

## Description

Support Jira sub-tasks: issues that belong to a parent issue. Sub-tasks render directly
beneath their parent. Crucially — **unlike Jira** — the presence of sub-tasks never reorders
parent items: parents keep their natural order whether or not they have children.

## Capabilities

### P1 — Must Have

- Model a parent → sub-task relationship on `Task` (e.g. `parentKey?: string`).
- Render sub-tasks so they read clearly as children, via one of the configurable layouts
  (`[display] subtasks`, see below) — never as ambiguous look-alike parent cards.
- Parent ordering is stable: an item's position does not change based on whether it has
  sub-tasks. Having children must not promote, demote, or regroup the parent.
- Sub-task cards are visually distinct from parent cards (a `↳` reference/connector plus the
  sub-task type glyph, and — when nested off its status column — a status badge).

### P2 — Should Have

- Toggle the board between **with sub-tasks** and **without sub-tasks** (hide all sub-task
  cards), so you can collapse to a parent-only view and back. This is now a **filter**, not
  a bespoke key: `-type:subtask` ([020](./020-filter-and-search.md)), typed in the bar or
  bound as an `f`-chord quick filter ([036](./036-quick-filters.md)). (The old dedicated
  `Shift+S` toggle / `showSubtasks` state was removed — one concept, filtering, covers it.)
- Cursor navigation lands on the first visible stop when the filter narrows the board.

## Out of Scope

- Editing the parent/child link (re-parenting) — not planned.
- Arbitrary nesting depth: Jira sub-tasks are one level deep; we assume the same.

## Where does a sub-task sit by status? — configurable

A sub-task has its own Jira status, which can differ from its parent's. In the **flat** (`none`),
**by-type**, and **query-swimlane** views the layout is chosen by `[display] subtasks` in
config ([015](./015-configuration.md)):

1. **`own-column`** (default) — the sub-task sits in the column matching *its own* status, as a
   sibling of its parent (which may be in another column), carrying a dim `↳PARENT-KEY` so the
   link stays legible. Best when you think in terms of "what's the status of everything".
2. **`under-parent`** — the sub-task nests in the *parent's* column directly below it, indented
   with a `↳` connector and its own status shown as a `[badge]` when it differs from that
   column. Best when you think in terms of "what's under each parent".
3. **`checklist`** — the sub-task folds *into* the parent card as a compact checklist row: a
   status icon only (`○` first column / `◔ ◑ ◕` spread across the columns in flight / `✓`
   done, coloured by column — shape *and* hue, since one `◐` in three colours left the
   middle columns indistinguishable), no issue key, no status text — plus its labels ([035](./035-labels-on-card-and-filter.md),
   subject to the `t l` toggle), since the row is where they are edited and hiding them
   makes an edit look like it did nothing. Rows stay individually selectable; status changes in place with
   the board's `Shift+H`/`Shift+L` (the same transition as a card move — it acts on the
   sub-task's status, not its position, so the icon just updates). Densest of the four.
   **The one layout that reorders**: done rows sink to the bottom of their group, stably,
   so rank still orders the work that is left and the finished rows stop interrupting it —
   a checklist is read as a to-do list, where every other layout reads as cards in rank
   order. `⇧J`/`⇧K` still rank against siblings, so ranking a done row moves it within
   the sunk group rather than back up.
4. **`basket`** — `own-column` cells, with each parent's run of cards drawn inside a tray
   headed by the parent's `KEY Summary` ([051](./051-parent-baskets.md)). Reads like
   `own-column` for *where* things are, like `under-parent` for *whose* they are.

Since [051](./051-parent-baskets.md) the layout is no longer config-only: `v o/u/c/g`
switches it per tab, and `[display] subtasks` is the default it starts from. Which children are drawn at all
is a separate setting, `v a/d/n` ([052](./052-child-visibility.md)).

The **parent-grouped** view (`g` → by parent) is unaffected: the parent *is* the lane header
and its sub-tasks always flow across that lane's own columns ([009](./009-swimlanes.md)), so no
`↳PARENT` reference or setting applies.

All options preserve stable parent ordering. (An earlier revision hard-coded a nest-and-badge
layout that read too much like a parent card; the `↳` connector + own-column default fixed the
legibility, and the setting keeps the nested layout available for those who prefer it.)

## Technical Notes

- `grouping.ts` `flatColumns(tasks, columns, layout)` builds the cells: `own-column` buckets each
  card by its own status (sub-tasks carry `parentRef`); `under-parent` and `checklist` keep each
  parent's sub-tasks in the parent's column (flagged `nested`). `checklist` is purely a render
  difference over the `under-parent` cells — `Column` folds a parent + its trailing `nested`
  sub-tasks into one `ChecklistCard`; `basket` is the same kind of render difference over the
  `own-column` cells ([051](./051-parent-baskets.md)). The layout comes from
  `LaneOptions.subtaskLayout` (cells) and a `SubtaskLayout` threaded `App → Board → Column`
  (render) — from the tab's projection, falling back to config via `index.tsx`.
- Hiding sub-tasks is just a filter (`-type:subtask`) applied through the normal
  [020](./020-filter-and-search.md) path — no separate view state. (The former
  `showSubtasks`/`Shift+S` toggle was removed in favour of this.)

## File Structure

| File | Change |
|------|--------|
| `src/types.ts` | Add `parentKey?: string` to `Task` |
| `src/App.tsx` | Sub-task grouping in the derived view; show/hide toggle state |
| `src/components/Card.tsx` | Sub-task rendering variant (`↳PARENT` reference) |
| `src/providers/mock.ts` | Add sample sub-tasks |
