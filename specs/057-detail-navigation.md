# Navigating the Detail View

**Status**: Implemented

## Description

The viewer ([007](./007-card-detail-view.md)) showed an issue's links — its epic, its
parent, its sub-tasks — as text you could read and nothing more. Acting on one meant
closing the viewer, finding that issue on the board, and acting there; and an epic
listed nothing at all, because the list was built from `parentKey` alone.

Now the viewer carries its own cursor. `j`/`k` walk the issue and the issues it links
to, every field action applies to whichever is selected, `⇧J`/`⇧K` reorder a child
among its siblings, and `↵` follows the selected link so the viewer walks the tree —
epic → story → sub-task — with `⌫` backing out the way it came in. Reading a ticket and
triaging what hangs off it stop being separate activities.

## Capabilities

### P1 — Must Have

- **A cursor over the viewer's items**: index 0 is the issue itself (the default on
  open), then one stop per linked issue in the order they are drawn — epic, parent,
  children. `j`/`k` move it; the selected row is highlighted like a focused card.
- **The description scrolls on the ctrl keys** — `^D`/`^U`/`^F`/`^B` — which is where a
  long read reaches for it anyway, freeing `j`/`k` for the cursor. `gg`/`⇧G` keep
  scrolling to the ends.
- **Every issue action targets the selection**: `⇧S`, `a`, `#`, `⇧E`, `⇧R`, `e`, `i`,
  `y`/`⇧Y`/`⇧U`/`⇧D`, `o`/`⇧O` act on the selected link rather than the issue on
  screen. App resolves `currentKey` to it, so no action needed changing
  ([013](./013-quick-field-edit.md), [014](./014-issue-actions.md)).
- **`↵` follows the selected link**, replacing the issue on screen. On the issue itself
  there is nothing to follow, so it closes — the same key that opened it
  ([055](./055-multi-select-copy.md)).
- **`⌫` backs up the trail** of links drilled through, closing the viewer at the root,
  and each step back lands on the link you went down through — so `↵` `⌫` is a round
  trip, and walking a list of sub-tasks is `↵` `⌫` `j` `↵` `⌫` `j`… rather than
  re-finding your place each time. `esc`/`q` still close outright from any depth.
- **An epic lists its stories** where a story lists its sub-tasks: children are whatever
  hangs off the issue by *either* link, the same rule `linkOf` uses to build the board's
  lanes ([034](./034-epic-grouped-backlog.md)). The label says which — `stories` on an
  epic, `subtasks` elsewhere.
- **Children the board never loaded are fetched.** The board only holds the children
  its query matched, so an issue reached from an all-of-Jira search — or an epic,
  whose stories straddle the sprints and teams a board query selects by — would list
  none or few, even having been opened *from* one of them. For an issue the board
  doesn't hold, and for every epic, the viewer asks the provider (`loadChildren`, one
  search per issue, cached for the session) and merges the result with what the board
  already shows, board order first. A story the board holds needs no fetch: the board
  load already follows its sub-tasks. Fetched rows open through the same fetch-first
  path as any off-board link.
- **The epic is named by key**, `SHOP-1 Cockpit`, as the parent and children already
  were — a name alone can't be acted on or looked up.
- **Done reads as done**: a finished issue's key is struck through and its summary
  dimmed, on the header and on every link row, exactly as the card and the list row
  draw it ([017](./017-list-view.md)) — the viewer spells a card out, it does not
  invent a second vocabulary for the same state.
- **The tab's child visibility rules the children section** ([052](./052-child-visibility.md)):
  `v d` keeps the finished children out of the list, with `✓ N done` under it so
  nothing vanishes silently, and `v n` starts the section *folded* rather than empty —
  the viewer is where the children get walked, so a fold that opens beats a list that
  cannot. Set from the viewer, either takes effect on the issue on screen.
- **`⇧J`/`⇧K` rank the selected child** against its siblings, mirroring the row views
  ([006](./006-card-movement.md)); the cursor follows the moved child. Marked children move
  as one block, on the same rule the board and the list views use ([056](./056-bulk-edit.md)).
- **`/` narrows the children** ([020](./020-filter-and-search.md)) with a filter of
  the viewer's own, in the board's filter language (`front`, `#UX`, `@me`,
  `-type:subtask`…), run over the family alone — children the board never loaded are
  judged on their own merits. The bar counts the children shown out of the family,
  completions work as on the board, and the tab's filter is untouched: closing the
  viewer changes nothing behind it. The filter resets per issue; `esc` clears it
  before it closes the viewer.
- **`s` jumps among the links** ([037](./037-jump-to-item.md)): while the viewer is
  up, the flash labels land on its link rows rather than on the board behind it, and
  a pick moves the viewer's cursor — the same gesture, the same overlay on the glyph.
- **No hint bar.** The viewer carries no permanent help line, like the rest of the
  app ([011](./011-shortcut-dialog.md)): `?` and the palette are where the keys live.
- **Status reads as it does on the board**: the column's glyph in the column's colour
  ([008](./008-sub-tasks.md)'s checklist ramp), bold, rather than bare text. The other
  fields borrow the board's vocabulary the same way — the assignee chip, the label tags
  — so an issue reads here as it does on its card, just spelled out.
- **The children are a section, not a field**: a heading (`stories` / `subtasks`) with
  the rows beneath it at full width, type glyph first and the status right-aligned in a
  column of its own, so ten sub-tasks scan down one edge rather than each status landing
  wherever its summary ended. Epic and parent stay single fields with the same row shape.
- **Reachable from search** ([046](./046-global-search.md)): `↵` on a `:` result shows it
  in the viewer, whether or not this tab holds the issue — the same fetch-first path a link
  off the board takes.

### P2 — Should Have

- Nothing pending.

### P3 — Nice to Have

- ~~**A link to an issue outside the board** is shown and selectable but cannot be
  opened (`↵` says so) — the header renders from board state, so there is no card to
  draw. Fetching a non-board issue into the viewer would lift that.~~ **Resolved:**
  done in the first pass, since it turned out to be the common case rather than an
  edge — a board query selects stories, so the epic above them is almost never loaded.
  `loadIssue` returns the full task, so `↵` fetches an off-board issue *before* the
  viewer switches to it (no blink out to the board mid-fetch) and the viewer renders
  from that copy where the board has none. Its stories still list, since those are on
  the board.
- **The field edits work on an off-board issue too**: the pickers read its fetched copy
  where the board has none, so they open on its current value, and the write settles by
  re-reading the issue rather than by an optimistic update — board state has nothing to
  update for it, and the re-read brings the changelog with it. `⇧S` transitions it *by
  name* ([047](./047-query-backed-tabs.md)), since it has no card to move and this
  board's column ids mean nothing outside its query. Known limit: `⇧H`/`⇧L` and the bulk
  writes still act on board state alone, so they pass an off-board issue over — and the
  epic and status candidates are this board's, so a result from another project is
  offered links its workflow may refuse. The toast reports what the write returned.
- **`⇧H`/`⇧L` on a selected child** to step its status without opening the picker.

## Out of Scope

- **Editing links** — attaching a sub-task to another parent, or re-pointing an epic,
  is [038](./038-change-epic.md)'s field editor, reachable here as `⇧E`.
- **Arbitrary Jira issue links** ("blocks", "relates to") — the viewer draws the
  hierarchy the board already loaded, not the link graph.
- ~~**Multi-select inside the viewer** — [055](./055-multi-select-copy.md)'s marks are
  a board/row concept; the viewer has one selection.~~ **Resolved:** built. `space`
  marks the selected item and `⇧V` ranges over the viewer's rows, into the *same*
  key-based set the board uses — a sub-task marked here is tinted on the board too,
  and the copies ([055](./055-multi-select-copy.md)) and bulk editors
  ([056](./056-bulk-edit.md)) act on it exactly as they do outside. `esc` drops a
  range before it closes the viewer; the marks outlive it. One consequence to know:
  while any marks exist, `⇧S` in the viewer targets the marks, not the issue on screen
  — the same rule as everywhere else.

## Keyboard

| Key | Action |
|-----|--------|
| `j` `k` `^N` `^P` | select the issue / its epic / its parent / its children (`⇧P` opens the palette here, since `^P` walks) |
| `↵` | open the selected link (on the issue itself: close) |
| `⌫` | back to the issue drilled in from, else close |
| `/` | filter the children (the viewer's own filter; the board is untouched) |
| `esc` | drop a visual range → clear the filter → close |
| `q` | close outright, at any depth |
| `⇧J` `⇧K` | rank the selected child among its siblings |
| `j` `k` onto a heading | the `subtasks`/`stories` and `history` headings are stops of their own, so a folded section can be reached |
| `l` `h` | open / close the section under the cursor — the list's tree disclosure; `h` from inside a section lands on its heading (↵ on a heading toggles) |
| `z a` `z o` `z c` | the same, on the section the cursor is in (the children by default) — [042](./042-fold-subtasks.md)'s chord; the heading keeps the count, folded rows leave the path. Every issue opens with its children in view: the fold is per issue, not a sticky layout preference |
| `^D` `^U` `^F` `^B` | scroll the description |
| `gg` `⇧G` | the viewer's first stop (the issue) / its last — a cursor motion here as everywhere ([003](./003-keyboard-navigation.md)) |
| `⇧S` `a` `#` `⇧E` `⇧R` `e` `i` `y` … | act on the selected issue |

## Technical Notes

- `useIssueDetail` keeps a `trail` of the keys drilled through, each with the cursor
  position it was left at: `push` records the issue being left and where its cursor
  stood, `back` pops it and restores both, and `open` (from the board) clears it, so
  the board is always the way out at the root. The viewer's cursor lives in the hook
  for that reason — restoring it has to win over the reset a fresh issue gets.
- App builds `detailLinks` — epic, parent, children — each carrying the cursor index
  that selects it, so the component can render its existing layout while the keymap
  thinks in one flat list. `currentKey` resolves to the selected link, which is the
  whole of what makes the actions target it.
- The viewer's cursor resets to the issue on every navigation, and is clamped when a
  refresh drops a child from under it.
- `statusGlyph(columnId, columns)` joins `columnGlyph` in `utils/glyphs`, so the
  checklist rows and the viewer's status field can't drift into showing one status as
  two different shapes.

## File Structure

| File | Change |
|------|--------|
| `src/useIssueDetail.ts` | `trail` + `push`/`back`; `open` clears it |
| `src/App.tsx` | `detailLinks`/`detailFocus`, `currentKey` → selection, the four handlers |
| `src/components/IssueDetail.tsx` | `DetailLink`, selectable rows, epic by key, status glyph |
| `src/useBoardKeymap.ts` | viewer `j`/`k`, `⇧J`/`⇧K`, `↵`, `⌫` |
| `src/utils/glyphs.ts` | `statusGlyph` shared with `ChecklistCard` |
