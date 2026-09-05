# Board View

**Status**: Done

## Description

The main visualisation: a horizontal row of columns (Jira statuses), each containing a
vertically scrollable stack of cards (issues), plus a top header and a bottom help bar.

## Capabilities

### P1 — Must Have (built)

- Render one column per `Board.column`, in order, sharing horizontal space evenly.
- Each column shows its title, its issue count, and its cards.
- The column holding the cursor is visually highlighted (header + active styling).
- Cards scroll within a column (`<scrollbox>`) when they overflow vertically.
- Each card shows: issue key, summary, type glyph, priority glyph, story points, assignee.
- The focused card is highlighted (border + background).
- Empty columns render a placeholder (`—`).
- Header shows the board name and total issue count. _With multiple boards, the header name
  becomes a tab bar — see [016](./016-multiple-boards.md)._

> **Superseded:** the scaffold also renders a persistent `HelpBar` at the bottom. That is
> being replaced by an on-demand shortcut dialog ([011](./011-shortcut-dialog.md)); `HelpBar`
> will be removed when 011 lands. No permanent status/help bar in the target design.

### Card & column anatomy (target — refines the scaffold)

Shared by all groupings ([009](./009-swimlanes.md)); refines what the scaffold draws today.

- **Card**: summary on top, then a footer row of `type glyph + key` (left), `priority glyph`,
  and `assignee` (right).
- **Done cards** render the key with **strike-through** and a dimmed treatment (the greyed-out
  `6̶0̶4̶1̶4̶` in the reference), so completed work reads as settled at a glance.
- **Assignee** shows as an avatar: coloured initials chip (e.g. `SL`) when assigned, a muted
  generic-person glyph when unassigned. There is no DOM/image, so initials stand in for the
  photo avatar.
- **Column header count** is a small badge after the title; in swimlane mode it is **per lane**
  and **hidden when 0** (see [009](./009-swimlanes.md)).

## Out of Scope

- Card **detail** view (full description, comments) — see
  [007-card-detail-view](./007-card-detail-view.md).
- Swimlane grouping ([009](./009-swimlanes.md)) and sub-task nesting
  ([008](./008-sub-tasks.md)) — this spec covers the flat base rendering only.
- A persistent help/status bar — see [011](./011-shortcut-dialog.md).
- Column configuration / reordering / hiding.
- Horizontal scrolling when columns exceed terminal width (assume they fit for now).

## Technical Notes

- Tasks are grouped by column with a single `useMemo` over `board.tasks`, keyed by
  `columnId`, so counts and positions stay consistent with a single source of truth.
- Glyphs and their colours live in `utils/glyphs.ts` (type → glyph/colour, priority →
  arrow/colour); components never hardcode these.
- All colours come from `theme.ts`; no literal hex in components.

## Key Files

| File | Role |
|------|------|
| `src/components/Column.tsx` | One lane: header, count, scrollable card list |
| `src/components/Card.tsx` | One issue card |
| `src/components/Header.tsx` | Top bar: board name, issue count, version |
| `src/components/HelpBar.tsx` | Bottom bar: key hints — _to be removed, see [011](./011-shortcut-dialog.md)_ |
| `src/utils/glyphs.ts` | Issue-type and priority glyph/colour mapping |
