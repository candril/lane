# Epic View

**Status**: In Progress — P1 built

## Description

An **epic board** is the boards we already have, with epics as the **root items**.
Today a root is a story, task or bug and its sub-tasks nest beneath it; on an epic
tab the root is an epic and the stories, tasks and bugs nest beneath *it*. Same
columns, same To Do / Backlog segments ([044](./044-board-backlog.md)), same modes
(`v b` / `v l` / `v k`), same folding, same actions — one hierarchy level up.

So an epic tab is a `[[boards]]` entry ([016](./016-multiple-boards.md)) whose JQL
matches a team's epics *and* their work, with its own `[[boards.columns]]` for the
epic workflow ([030](./030-per-board-columns.md)). No new view mode, no new grouping,
no new tab kind, no new provider call.

It is also where epics are **created** and issues are **filed under one**, so planning
does not mean leaving for the browser.

This supersedes the original "epic-grouped backlog" shape: the backlog is its own
two-segment screen now ([044](./044-board-backlog.md)), and epics-as-roots is a
property of the tree, not a mode.

## Decisions (as built)

- **P1 is built**: `partition()` links a child by `parentKey ?? epicKey` (each checked for
  presence), `listRows` walks depth-first, and the backlog's root walks follow the same
  link so a tree stays in one segment. Boards that load no epics are untouched.
- **Nothing was needed for create.** `⇧N` + `^T` already reaches `epic` (it is in the
  top-level type cycle) and the sticky type then remembers it; `n` on an epic row already
  files a child under it ([019](./019-quick-create.md)). The spec asked for a new binding
  that turned out to exist.
- **The board needed no change either** — `flatColumns` and `buildLanes` walk one level by
  construction, which is exactly the depth a board should show.
- **The board's cards are its roots.** On a work board that is stories with their sub-tasks
  inside them; on an epic board it is *epics* with their issues inside them, drawn by the
  same `[display] subtasks` layout ([008](./008-sub-tasks.md)). The tab opens in the right
  grouping via `grouping` in its config ([026](./026-default-view-per-board.md)).
- **Grouping groups the cards by something above them**, which on an epic board means:
  - `parent` → an epic's parent is an *initiative*, a level this Jira has no link for, so it
    reads flat rather than inventing a lane per epic;
  - `type` → only the Epics lane, since epics are the only cards;
  - `none` → one lane of epic cards.
- **Epic-less issues stay off the board.** A story linking to no epic would sit among the
  epics pretending to be one; it belongs to the row views, where `No epic` collects it
  under a heading. That keeps "what are we building" honest, at the cost of the board not
  being the whole issue set — which is what a board of epics is for.
- **Verified against SHOP**: an epics tab (`project = SHOP AND team = Checkout`, no
  `issuetype != Epic`) renders epics as roots with their issues nested, and expands to
  sub-tasks in list mode.

## What already exists

- `Task.epicKey` / `epicName`, plumbed from Jira's `parent` (a classic Epic Link custom
  field is configurable). The mock seeds them.
- `⇧E` re-links or detaches an epic ([038](./038-change-epic.md)), `epic:` filters by it
  ([029](./029-epic-on-card.md)), and the tag renders on cards and in the backlog's epic
  column ([044](./044-board-backlog.md)).
- `createIssue({ epicKey })` files an issue under an epic; the quick-create draft already
  carries epic context ([019](./019-quick-create.md)).
- Per-board JQL and columns — everything an epic tab needs to *exist*.

## The gap this spec closes

`partition()` ([grouping.ts](../src/grouping.ts)) links a child to its parent by
**`parentKey` only**. Load a set of epics together with their work and nothing connects
them: the epics render as rows among the stories, unrelated. The link exists on every
issue (`epicKey`) — the tree simply never looks at it.

Two consequences follow from fixing that, and both are the point:

- an issue nests under its epic wherever the epic is present (an epic tab), and behaves
  exactly as today wherever it is not (every current board excludes epics);
- the tree gains a third level (epic → story → sub-task), which the row builder must
  walk recursively — today it expands a root's direct children only, so a sub-task whose
  story is itself nested would silently vanish.

## Capabilities

### P1 — Must Have

- **Nest by the nearest ancestor present in the set**: a task's parent is its
  `parentKey` when that issue is loaded, else its `epicKey` when *that* is loaded, else
  it is a root. Boards that load no epics are bit-for-bit unchanged.
- **Epics are roots** in every view: a lane per epic in the parent-grouped board
  ([009](./009-swimlanes.md)), an expandable root row in list and backlog
  ([044](./044-board-backlog.md)) with its issues nested under it.
- **The board stays one level deep** — an epic and its stories/tasks/bugs, no sub-tasks.
  A kanban card is a unit of work in a column; a sub-task under a story under an epic has
  no column of its own to sit in, and three levels of nesting is a list's job, not a
  board's. (This is what the board code already does; nothing to add.)
- **Rows go the whole way down**, so list and backlog expand epic → story → sub-task.
  That is where you go when you want the depth.
- **Create an epic** (`⇧N`), and **file an issue under the epic** the cursor is on
  (`n`) — the quick-create draft already models epic context
  ([019](./019-quick-create.md)).
- Folding (`z`, [042](./042-fold-subtasks.md)), expand/collapse, ranking, status changes
  and every issue action work on epic roots exactly as they do on story roots.

### P2 — Should Have

- **Progress on an epic root**: `3/8` or a compact bar — an epic's value is its rollup.
- **Wording that generalises**: the fold marker says "N subtasks"; under an epic those
  are issues. `subtaskCount` becomes a child count ([042](./042-fold-subtasks.md)).
- **Filter scope follows the tree** ([043](./043-subtask-filter-scope.md)): a matching
  epic keeps its children, the same way a matching story keeps its sub-tasks.
- **Open the epic under the cursor in a tab of its own**: from any card or row, take its
  `epicKey` and open a tab listing that epic and *all* its children — including the ones
  the current tab's query never loaded. This is the honest version of "show me this
  epic": a tab whose source is the query `parent = <epic>` rather than a config board,
  which is the same query-backed source [046](./046-global-search.md) needs to keep a
  search as a tab. Closable like any ad-hoc tab ([045](./045-ad-hoc-tabs.md)).

### P3 — Nice to Have

- Re-parent by dragging a child between epic roots (`⇧H`/`⇧L`-style), on top of `⇧E`.
- Roll a status up from children to the epic row.
- An epic's issues fetched on demand when the tab's query didn't load them.

## Out of Scope

- **A new grouping or view mode.** Epics-as-roots is what the tree does when epics are
  present; `g`'s cycle and `v`'s modes are untouched ([009](./009-swimlanes.md),
  [017](./017-view-modes.md)).
- **A new provider read.** Children come from the tab's own query; an epic whose work the
  query doesn't match shows fewer children (P3 revisits this).
- **Epic administration** (renaming, closing, ranking epics against each other) beyond
  create — those are ordinary issue actions on the epic's row.
- **The backlog screen itself** — [044](./044-board-backlog.md).

## Technical Notes

- **One function changes**: `partition()` resolves a task's link as
  `parentKey ?? epicKey`, each checked for presence in the set. Everything downstream —
  `flatColumns`, `buildLanes`'s parent mode, `listRows`, `backlogRows`, `splitBacklog`'s
  root walk — already speaks in terms of "roots and their children".
- **`listRows` must recurse** — and only `listRows`. It currently pushes a root and its
  direct children, so a third level would drop the deepest. A depth-first walk carrying
  `depth` keeps the existing `▸`/`▾` and indent rules. The board builders (`flatColumns`,
  `buildLanes`) already stop at one level, which is exactly what the board should do.
- **A sub-task's `epicKey` is unset** (its `parent` is a story), so nothing changes for
  sub-tasks: they follow their story, which now itself follows an epic. On the board that
  means they simply do not appear under an epic lane, which is the intent.
- **Backlog segments are unaffected**: `splitBacklog` already decides by the *root's*
  status ([044](./044-board-backlog.md)), so an epic in a backlog status carries its
  whole tree, and an epic in the first column puts it in To Do.
- **Create**: `useCreateDraft` already handles `contextParent.kind === "epic"`; `⇧N`
  needs a draft with `type: "epic"` and no parent.

## Open Questions

- ~~**Where do epics come from?**~~ **Resolved:** the tab's own JQL, like any board — a
  configured tab, not a discovery heuristic.
- ~~**Is this a new view mode or grouping?**~~ **Resolved:** neither. Epics are roots;
  the existing views render them.
- ~~**How deep do board lanes go?**~~ **Resolved:** one level. The board shows an epic
  and its issues; sub-tasks appear in the list and backlog views, where the tree can be
  expanded as deep as it goes.
- ~~**Can one column set serve both levels?**~~ **Resolved (measured):** yes, on SHOP.
  Checkout epics sit in `Open` and `In Progress` — both already mapped by the existing
  columns, and the work statuses are the same set. So an epic tab reuses the ordinary
  column map, `⇧H`/`⇧L` transitions stay valid for a story inside an epic's lane, and no
  per-level status mapping is needed. An instance whose epics *do* run a separate
  workflow already has the escape hatch: an epic tab is its own board config with its own
  `[[boards.columns]]` ([030](./030-per-board-columns.md)).
- **Does an epic tab want its own Done cap?** The work board drops issues that entered
  Done over a week ago; on an epic tab that also hides an epic's finished children, which
  may be the wrong default for a planning view.
- **What does the backlog mode of an epic tab show?** The segment is decided by the
  *root's* status ([044](./044-board-backlog.md)), so an epic in `Open` puts its whole
  tree in To Do regardless of where its children sit. That may make the Backlog segment
  near-empty on an epic tab — fine, or an argument for deciding the segment by the
  children. Worth a look once it renders.

## File Structure

| File | Change |
|------|--------|
| `src/grouping.ts` | `partition()` links by `parentKey ?? epicKey`; `listRows` recurses |
| `src/components/Card.tsx` | Child-count wording on an epic root (P2) |
| `src/tabs.ts` | A query-backed source for "open this epic" (P2, shared with [046](./046-global-search.md)) |
