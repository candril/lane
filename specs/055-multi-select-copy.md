# Multi-Select Copy

**Status**: Implemented

## Description

Select several issues — `space` marks one, `⇧V` extends a range over rows — and copy
them all at once: `y` a list of keys, `⇧Y` a list of URLs, `⇧U` a list of titles
([054](./054-copy-fields.md)), newline-separated. Collecting a set of issues for a
standup note, a PR reference list, or a message previously meant one cursor round trip
and one paste per issue.

The selection is a set of issue *keys*, not positions: a mark survives a refresh, a
re-grouping, and a board↔list switch, where an index would land on a different issue.

This spec also owns the key rebinds that make room for it (see Decisions): `space`
becomes the mark toggle, `⇧V` the visual anchor, and **`↵` takes over opening the
viewer** — superseding [007](./007-card-detail-view.md)'s `⇧V` binding.

## Capabilities

### P1 — Must Have

- **`space` toggles a mark** on the focused issue — a board card (checklist sub-rows
  included), a list row, a backlog row, or the viewer's selected item
  ([057](./057-detail-navigation.md)). On a lane header it keeps folding, since a
  header can't be marked.
- **`⇧V` anchors a visual range** in the row views (nvim's `V`): `j`/`k` extend it from
  the anchor, `esc` or a second `⇧V` drops it. On the board grid there is no linear
  order to extend along, so `⇧V` does nothing there.
- **`^A` marks the ring around the cursor, and again widens it.** Each press marks
  the innermost ring that isn't already whole: in a row view a sub-task's siblings
  (or, on a root, every root), then — in a backlog — the sprint or segment the cursor
  is in ([044](./044-board-backlog.md), [050](./050-sprint-swimlanes.md)), then every
  visible row; on the board a checklist row's
  siblings, then the cell (that column of that lane), the swimlane, the board; in the
  viewer ([057](./057-detail-navigation.md)) the children, and no further — the epic
  or parent above is a link up the tree, not a member of the family. A toast names
  the ring taken (`cell · 5 marked`). This is what makes "all the sub-tasks of this
  story" or "everything in In Review" one keystroke instead of a `⇧V` walk.
- **Marked issues show a tinted background** (`theme.cardBgSelected`, a warm hue
  deliberately apart from the blue focus). A card that is focused *and* selected keeps
  the focus background and flips its key to the selection color instead — both states
  stay readable. See Decisions for why not a marker glyph.
- **`y` / `⇧Y` copy the whole selection** (marks ∪ range) when one exists, one key/URL
  per line in display order, with a counting toast (`3 keys copied`). Copying ends the
  visual range; the marks stay for a follow-up copy. No selection → the focused issue,
  as before ([014](./014-issue-actions.md)).
- **`esc` backs out in layers**: an active range first, then the marks, then the filter.
- **Lifecycle**: the marks are one set for the whole session. They survive board↔list
  switches, tab switches and filter edits; a key marked on one tab is marked on every
  tab that holds it. What the copies and bulk editors act on is the marks the current
  board (or the open viewer) can show — a mark on a key this tab doesn't hold waits,
  unseen, for a tab that does. `esc` clears them.
- **`↵` opens the viewer** on the focused card or row, and closes it from inside —
  the rebind that frees `⇧V`. A parent-lane header keeps `↵` for its fold (the
  natural gesture there); the header issue's viewer stays reachable via the palette's
  `View …` command.

### P2 — Should Have

- **`⇧U` copies the selected titles** ([054](./054-copy-fields.md)).
- **The palette copy commands follow the selection** and say so (`Copy 3 selected
  keys`), staying available even with the cursor on nothing selectable.

### P3 — Nice to Have

- ~~**Bulk actions on the selection** — transition, label, assign several issues at
  once. A separate spec: mutation fan-out (partial failure, optimistic revert) is its
  own design, and this spec's selection set is the seam it would build on.~~
  **Resolved:** built as [056](./056-bulk-edit.md).

## Out of Scope

- **Bulk mutations** — [056](./056-bulk-edit.md); nothing in *this* spec writes to Jira.
- **Visual ranges on the board grid** — a 2D range is ambiguous; `space` covers the
  board, and a range wants the row views.
- **Multi-issue description copy** — excluded in [054](./054-copy-fields.md).

## Keyboard

| Key | Action |
|-----|--------|
| `space` | mark / unmark the focused issue (lane header: still folds) |
| `⇧V` | anchor / drop a visual range (list & backlog, the viewer) |
| `^A` | mark the ring around the cursor; again widens: siblings → cell → lane → board (backlog: siblings → sprint → all rows) |
| `y` `⇧Y` `⇧U` | copy selection: keys / URLs / titles — or the focused issue if none |
| `esc` | drop range → clear marks → clear filter |
| `↵` | open the viewer (was `⇧V`); inside it: close |

## Technical Notes

- `src/useSelection.ts` owns the state: a marked `Set<string>` plus a row-index anchor;
  the derived selection intersects the marks with the loaded board and adds the rows
  between anchor and cursor. Copy order comes from the view (lane grid or rows), with
  still-selected keys the view doesn't show trailing rather than dropped.
- The set threads to the components exactly like jump labels do
  ([037](./037-jump-to-item.md)): one prop from App down to `Card` / `ChecklistCard` /
  `ListView`.
- `copyToClipboard` pipes via stdin ([`src/actions.ts`](../src/actions.ts)), so a
  multi-line payload needs nothing new.
- URLs come from `provider.issueUrl?.()`, which is optional — keys whose source can't
  produce one are filtered out of a `⇧Y` copy rather than copied as blanks.

## Decisions (as built)

- **`space` was free in practice.** Its two bindings — expand a list row, fold a lane
  header — each had `↵` and `h`/`l` doing the same thing; only the row-expand was
  actually given up (to `↵`'s rebind), and headers keep all three fold keys.
- **`⇧V` was the viewer's only key, so the viewer moved to `↵`** — which did nothing
  on a card and only duplicated `l`/`h` on rows. nvim hands `⇧V` linewise selection,
  which is exactly the borrowed semantics; a mode key should match its muscle memory.
- ~~**Marks don't survive a filter edit or tab switch.** A selection that outlives the
  set of issues it was made against silently feeds invisible issues into the next copy
  — the same reason the cursor resets there.~~ **Reversed:** marks are global for the
  session. Gathering a set across tabs — this sprint's board, that epic's backlog, a
  search — is what a global set is for, and clearing it on every tab switch made that
  impossible. The invisible-copy risk is contained differently: a mark only counts
  where the current board (or the viewer) holds the key, and one hidden by a filter
  is still on the board and still tinted the moment the filter clears. Only the
  visual *range* resets on a tab or filter change, being a row index.
- **Color, not a marker glyph.** The first build inserted a `▌` before the card glyph,
  which shifted the card text sideways as marks came and went; a reserved gutter fixed
  the list but cost every row a cell. A background tint moves nothing and hides
  nothing, and the checklist's key-less sub-rows get the same treatment for free
  (their summary carries the focused+selected color, having no key to flip).

## File Structure

| File | Change |
|------|--------|
| `src/useSelection.ts` | **new** — marks + visual anchor, derived selection, ordered copy list |
| `src/App.tsx` | mount the hook, `copySelection()`, thread `selectedKeys` to the views |
| `src/useBoardKeymap.ts` | `space` / `⇧V` / `↵` rebinds, selection-aware `y`/`⇧Y`/`⇧U`, layered `esc` |
| `src/theme.ts` | `cardBgSelected` token |
| `src/components/Card.tsx` `ChecklistCard.tsx` `ListView.tsx` | selected tint; key in the selection color when also focused |
| `src/components/Board.tsx` `Swimlane.tsx` `Column.tsx` | pass-through |
| `src/commands/builder.ts` / `types.ts` | selection-aware copy labels (`selectionCount`) |
| `src/components/ShortcutHelp.tsx` | `space`, `⇧V`, `↵` rows |
