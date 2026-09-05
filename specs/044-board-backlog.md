# Board Backlog Tab

**Status**: In Progress — P1 built

> A **scrum** board's backlog sections by sprint rather than by status, and needs no
> `backlog_statuses` to open — see [050](./050-sprint-swimlanes.md). The segments below
> are the status shape; both go through the same `backlogSegments` seam.

## Description

A Kanban board with a backlog splits its issue set in two: statuses mapped to a column are
*on the board*, the rest sit in the *backlog*. Jira does this per board; lane doesn't — so the
Checkout board config works around it by excluding the pre-refinement statuses in its JQL
(`status not in ("To be discussed", "In refinement")`), and those issues are invisible in lane.

This spec makes the split first-class. The board config names its **backlog statuses**, the same
JQL loads everything, and the backlog gets its **own tab** next to the board tab — not a view you
toggle. Switching to it is `]` or its number, the same as any board ([016](./016-multiple-boards.md)).
It lists the backlog issues in rank order, grouped by status, each parent expandable to its
sub-tasks.

Two tabs over one query means a tab can no longer *be* a board. A tab becomes a **source** (a
provider + JQL + the snapshot it fetched) times a **projection** (how to render it: mode, filter,
grouping). The board tab and the backlog tab share one source and one fetch; only their projection
differs. [045](./045-ad-hoc-tabs.md) makes that projection user-creatable at runtime — this spec
is the mechanism's first use, and its shape should be settled with 045 in view.

The rendering is the tree from [017](./017-view-modes.md) / the planned epic view
([034](./034-epic-grouped-backlog.md)): heading rows with nested, foldable children. This spec keys
that tree on **status**; [034](./034-epic-grouped-backlog.md) keys it on the epic link and lands as
an alternative grouping of this same view (P3).

## Decisions (as built)

- **P1 is built.** `backlog_statuses` (board + instance), `Board.backlog`, the root-decides
  split, the status-grouped tree with expandable sub-tasks, the derived backlog tab, and
  backlog-aware `status:` filtering all landed. P2/P3 are open.
- **No `BacklogView.tsx`.** Headings ride on `ListRow.section` and `ListView` renders them, so
  the backlog and the list view share one row renderer, one cursor model and one rank path.
  A second component would have duplicated all three to print a heading.
- **The segments are structural, not per-status.** Grouping by each backlog status was the
  first cut; it buried the decision the screen exists for (is this ready for the board?) under
  refinement bookkeeping. The status is still on every row.
- **An empty segment shows no heading**, since headings ride on rows — but crossing is decided
  by *direction*, not by the neighbouring row, so `⇧K` still promotes into an empty first column.
- **The epic has a column of its own** in list and backlog rows, immediately left of the
  status, rather than trailing the summary. A backlog is read down the epic, and a tag that
  starts wherever the title happens to end can't be scanned that way; the name elides to fit.
  `t e` ([039](./039-card-decoration-visibility.md)) hides the column and reclaims its width.
  The status beside it is a fixed, right-aligned column for the same reason — a variable-width
  status shifted the epic column a couple of cells per row, which is what a column is meant to
  prevent.
- **Backlog columns are muted** in the status readout (`theme.textDim`) — not being on the
  board is the distinction worth showing.
- **`⇧H`/`⇧L` walk the backlog and the board as one sequence** (`nextStatus`): ⇧L promotes
  an issue through the refinement statuses and onto the board, ⇧H sends it back the same
  way. A one-way door — promote only — was the first cut and was wrong: demoting is half of
  triage. Crossing the boundary moves the issue to the other tab, so it toasts.
- **The derived backlog tab is gone.** It was built before tabs could be cloned and saved
  ([045](./045-ad-hoc-tabs.md)); once they could, a per-board tab lane invents — with a locked
  mode and a config key to name it — was just a worse version of one you make and name
  yourself. `backlog_statuses` stays: it is the data split, not the view.

## The gap this spec closes

`providers/jira.ts` builds `statusToColumn` from the board's columns and falls back to `columns[0]`
for anything unmapped ([jira.ts:226](../src/providers/jira.ts)) — so an "In refinement" issue would
render as a first-column card, which is wrong twice over: it isn't on the board, and it displaces
real To Do work. There is no way today to say "these statuses exist, but they are not the board."

## Capabilities

### P1 — Must Have

- **Backlog statuses in config** ([015](./015-configuration.md)): `backlog_statuses = [...]` on a
  board (and instance-wide under `[jira]` as the fallback, mirroring columns in
  [030](./030-per-board-columns.md)). Array order is display order.
- **Board / backlog split**: an issue whose status is a backlog status is excluded from the board
  tab and forms the backlog tab's set. A status in neither list keeps today's first-column fallback
  (see Open Questions).
- **Sub-tasks follow their parent**, not their own status — the split is decided by the root issue,
  so a story never appears in both tabs. (An orphan sub-task, whose parent is outside the query, is
  already a root and splits on its own status.)
- **Backlog is a tab mode** (`v k`), so the board and its backlog are two projections of one
  fetched snapshot — one query, however many tabs. A permanent backlog tab is a clone
  ([045](./045-ad-hoc-tabs.md)); `view = "backlog"` in config opens a board there by default.
- **Two segments**: the board's first column (named after itself — "To Do") and everything in a
  backlog status, under a `Backlog` heading, both in rank order. The first column belongs on this
  screen because deciding what crosses into it is what the screen is *for*; those issues stay on
  the board tab too. A row carries the same info as the list row ([017](./017-view-modes.md)):
  type glyph, key, summary, status, priority, assignee, plus epic/label tags
  ([039](./039-card-decoration-visibility.md)).
- **`⇧J`/`⇧K` cross the divider**: ranking off the end of a segment moves the issue into the other
  one — into the first column, or back to the backlog status nearest it — which is what dragging
  an issue over the divider does in Jira. Within a segment they rank as before.
- **Expandable sub-tasks**: a parent renders with a disclosure control (`▸` collapsed / `▾`
  expanded) and its sub-tasks nest as indented child rows; collapsed parents hide their children and
  the cursor skips them — the existing `listRows` tree ([grouping.ts](../src/grouping.ts)).
- **Filter & search** ([020](./020-filter-and-search.md)) narrows within the backlog tab, including
  `status:` on backlog statuses; `⇧F` sub-task scope ([043](./043-subtask-filter-scope.md)) applies
  unchanged.
- The active tab (backlog included) is restored on relaunch, as today
  ([033](./033-cached-boot-and-refresh.md)).

### P2 — Should Have

- **Count on each status heading** (`In refinement (7)`) — the point of a backlog is its size.
- ~~**Fold keys**~~ **built** ([021](./021-fold-and-collapse-controls.md) /
  [042](./042-fold-subtasks.md)): `z o` / `z c` / `z a` on the focused row, `z ⇧R` / `z ⇧M`
  for everything. The chord was board-only; in a row view it acts on the expand/collapse
  set instead of the lane/sub-task fold state, so the same keys mean the same thing in
  every view — including the plain list view, which had no fold keys at all.
- **Reordering**: `⇧J` / `⇧K` rank the focused issue, reusing the list view's `applyRank` path —
  the backlog is the one place rank actually matters.
- ~~**`⇧S` set-status**~~ **built**: the picker ([041](./041-set-status.md)) offers backlog *and*
  board statuses, so an issue can jump either way in one keystroke; `⇧H`/`⇧L` step through the
  same sequence.
- **Jump** ([037](./037-jump-to-item.md)) labels backlog rows like any other view.

### P3 — Nice to Have

- **Group by epic instead of status** in the backlog tab — [034](./034-epic-grouped-backlog.md)'s
  tree, selected with the `g` grouping cycle.
- Epic/parent rollup on a heading (done/total).
- `lane import` ([018](./018-import-jira-board-config.md)) emitting `backlog_statuses` from the real
  board's configuration (see Open Questions).

## Out of Scope

- **User-created tabs and per-tab filters** — [045](./045-ad-hoc-tabs.md). This spec only introduces
  the source/projection split those tabs need.
- **A backlog as a separately-queried board** — [024](./024-backlog-tab.md) covers "a board whose JQL
  selects backlog issues", which stays valid for a backlog that isn't a Kanban board's own backlog.
- **Epic grouping itself** — [034](./034-epic-grouped-backlog.md).
- **Sprint planning** (sprint assignment, moving issues between boards).
- **Writing the backlog configuration back to Jira** — lane reads which statuses are backlog from
  its own config; it never edits the Jira board.

## Technical Notes

- **`Board` gains `backlog: Column[]`** ([types.ts](../src/types.ts)) — the backlog statuses as
  columns (`id = slug(status)`), so `Task.columnId` keeps pointing at exactly one place and no task
  needs a new field. The provider builds it next to `columns` and extends `statusToColumn` with it;
  the first-column fallback then only catches genuinely unmapped statuses.
- **Tab = source × projection.** Today `BoardTab` ([App.tsx](../src/App.tsx)) *is* the source
  (provider + cacheKey) and `useBoardData` keys its cache by tab index. Split it: a `BoardSource`
  (provider, cacheKey, swimlanes, columns) with the snapshot cache keyed by *source*, and a tab as
  `{ name, sourceId, mode, … }`. Two tabs on one source must not fetch twice, must share one
  refresh, and an optimistic mutation on one must show in the other
  ([033](./033-cached-boot-and-refresh.md)).
- **Splitting is a projection concern**, like filtering ([useDerivedBoard.ts](../src/useDerivedBoard.ts)):
  filter first, then partition the visible tasks into board vs backlog by their root's `columnId`,
  then group. `buildLanes` receives only the board half; the backlog half feeds the rows builder.
  The board/list rendering itself is unchanged.
- **Rows**: add `backlogRows(tasks, backlogColumns, expanded)` to [grouping.ts](../src/grouping.ts),
  reusing `partition` + `listRows` per status group. Give `ListRow` an optional `section?: string`
  printed as a heading above that row, rather than inserting header rows — a flat row array keeps
  `focusedIndex`, `⇧J`/`⇧K` and the scroll-into-view math identical to the list view.
- **Filter context** takes `columns.concat(backlog)` so `status:` matching and its suggestions
  ([filter.ts](../src/filter.ts)) cover backlog statuses in every tab.
- **Config change for Checkout**: drop `status not in ("To be discussed", "In refinement")` from the
  board's JQL and declare those two as `backlog_statuses`. That exclusion exists only because
  unmapped statuses land in column 1; once the split is real, the workaround is what hides the backlog.

## Open Questions

- **Should an unmapped status (in no column *and* no backlog list) go to the backlog instead of
  column 1?** Jira's answer is "neither" — the issue is invisible. Proposed default: keep the
  first-column fallback (no silent behaviour change) and revisit if unmapped statuses turn out to be
  common. Explicit config is the intended path either way.
- **Can `lane import` derive the backlog statuses?** `/rest/agile/1.0/board/{id}/configuration` gives
  columns; whether a Kanban-with-backlog board exposes its backlog column there, or whether it takes
  `/rest/agile/1.0/board/{id}/backlog`, is unverified — check against the real Checkout board before
  wiring P3. Hand-written config works meanwhile.
- ~~**Does `v` still switch view inside a backlog tab?**~~ **Resolved:** the question dissolved
  with the derived tab. Every tab owns its mode and switches freely with `v b`/`v l`/`v k`
  ([017](./017-view-modes.md)); `v k` is refused only where the board declares no backlog
  statuses, since there would be nothing to show.

## Keyboard

| Key | Action |
|-----|--------|
| `v k` | Render this tab's backlog (`v b` board, `v l` list) |
| `⇧T c` | Save it as a tab of its own ([045](./045-ad-hoc-tabs.md)) |
| `j` / `k` | Move the cursor between visible rows |
| `→` / `←`, `Enter` | Expand / collapse the focused parent's sub-tasks |
| `z o` / `z c` / `z a` | Fold controls on the focused row (P2) |
| `z ⇧R` / `z ⇧M` | Unfold / fold all (P2) |
| `⇧J` / `⇧K` | Re-rank the focused issue (P2) |
| `⇧S` | Set status — including board statuses, moving the issue out of the backlog (P2) |

## File Structure

| File | Change |
|------|--------|
| `src/types.ts` | `backlog: Column[]` on `Board` |
| `src/providers/jira.ts` | Build backlog columns; map their statuses; narrow the fallback |
| `src/providers/mock.ts` | Seed backlog-status issues so the view works offline |
| `src/config/types.ts` / `validate.ts` | `backlog_statuses` (board + instance) |
| `src/grouping.ts` | Board/backlog partition; `backlogRows` with `section` headings |
| `src/filter.ts` | Status matching + suggestions over board *and* backlog columns |
| `src/useDerivedBoard.ts` | Split the filtered tasks; derive backlog rows |
| `src/useBoardData.ts` | Snapshot cache keyed by source, not tab index |
| `src/components/ListView.tsx` | Renders a row's `section` heading (no separate BacklogView) |
| `src/App.tsx` | `BoardSource` vs tab; route the mode |
| `src/useBoardKeymap.ts` | Backlog-tab cursor / fold / rank routing |
