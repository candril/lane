# Swimlanes (Grouping)

**Status**: Draft

## Description

Group the board into horizontal **swimlanes** — bands that span all status columns. Grouping is
a view choice, selected by a **grouping key**:

| Key | Swimlane per… | Notes |
|-----|---------------|-------|
| `none` | (no grouping) | Flat board — today's default. See [002](./002-board-view.md). |
| `parent` | top-level issue, in **backlog order** | The primary illustrated mode below. |
| `type` | issue type (Stories / Bugs / Tasks) | Fixed order; original 009 behaviour. |
| `epic` | the issue's epic | One lane per epic + a `(No epic)` catch-all; see [029](./029-epic-on-card.md). |
| `query` | named JQL predicate | Per-board config; see [016](./016-multiple-boards.md) / [015](./015-configuration.md). |

The board defaults to `none`; the key is switchable at runtime via the **`g`+letter**
chord (`gn` none, `gp` parent, `gt` type, `gs` swimlanes; `ge` epic once [034](./034-epic-grouped-backlog.md)
lands) — the vim "go" idiom, sharing the `g` prefix with `gg`/`⇧G` jump
([003](./003-keyboard-navigation.md)) — plus the command palette
[010](./010-command-palette.md), and can be set per board from config.

This spec fully specifies the **`parent`** mode — the layout in the reference screenshot — and
keeps `type` / `epic` / `query` as the other grouping keys.

## Parent mode (backlog-ordered story swimlanes)

The headline layout. It reframes the board around **backlog items**: each top-level issue becomes
a swimlane, and its sub-tasks flow across the status columns.

```
▾  ◆ SHOP-60411  Cancel an order   (3 subtasks)   IN PROGRESS   (SL)
┌ TO DO ───────┬ IN PROGRESS 2 ─┬ IN REVIEW ──┬ DONE 1 ──────┐
│              │ Update Req.    │             │ Backend      │
│   + Create   │ ▪ 60413    = SL│             │ ▪ 6̶0̶4̶1̶4̶  = ·│
│              │ Frontend       │             │              │
│              │ ▪ 60415    = SL│             │              │
└──────────────┴────────────────┴─────────────┴──────────────┘

▾  ◆ SHOP-60412  Past Packages   (3 subtasks)   IN PROGRESS   (SL)
┌ TO DO 1 ─────┬ IN PROGRESS ───┬ IN REVIEW 1 ┬ DONE 1 ──────┐
│ [UX] Empty   │                │ Frontend    │ Backend      │
│ ▪ 60418  = ○ │                │ ▪ 60417 = ⬤│ ▪ 6̶0̶4̶1̶6̶  = ·│
└──────────────┴────────────────┴─────────────┴──────────────┘

▾  ● SHOP-60420  Fix resize crash   (0 subtasks)   TO DO   (SL)
┌ TO DO ───────┬ IN PROGRESS ───┬ IN REVIEW ──┬ DONE ────────┐
│      —       │       —        │      —      │      —       │
└──────────────┴────────────────┴─────────────┴──────────────┘
```

### Which issues are swimlanes

- **Every non-sub-task issue is a swimlane** — story, task, bug, or epic. Sub-tasks are never
  swimlanes; they only ever appear inside a lane's columns.
- A childless issue **still gets a lane** (all columns empty / `—`). There is **no "Everything
  else" catch-all** — everything top-level is a lane in its own right.
- **Order = sprint backlog rank.** Swimlanes appear in the order their top-level issues arrive
  from the provider, which supplies them in Jira backlog/rank order. Having (or not having)
  sub-tasks never reorders a lane — this extends the stable-order rule from
  [008](./008-sub-tasks.md).

### The swimlane header

One row per lane, carrying the parent issue itself (the parent is **not** also a card in a
column). Left to right:

- **Collapse chevron** (`▾` expanded / `▸` collapsed).
- **Type glyph** for the parent (`utils/glyphs.ts`).
- **Issue key** and **summary** (summary emphasised).
- **Sub-task count** — `(N subtasks)`; `(0 subtasks)` for a childless lane.
- **Status badge** — the parent's *own* workflow status (e.g. `IN PROGRESS`). This is why the
  parent needs no column: its status lives in the header.
- **Assignee avatar** — see [002](./002-board-view.md) card anatomy for the avatar treatment.

### Columns within a lane

- The same status columns as the flat board, repeated per lane.
- Each column header shows a **count badge** of the cards in it for this lane (`IN PROGRESS 2`),
  and **omits the badge when the count is 0** (matching the screenshot).
- A sub-task sits in the column matching **its own status** — this resolves the
  [008](./008-sub-tasks.md) open question in favour of *own-status column* (Model 2) for parent
  mode. (Flat mode keeps 008's nested Model 1.)
- Empty column → the usual `—` placeholder.

## Capabilities

### P1 — Must Have

- Grouping key `parent`: render one swimlane per top-level issue, in backlog order, including
  childless lanes; no catch-all.
- Swimlane header with chevron, type glyph, key, summary, `(N subtasks)`, parent status badge,
  and assignee.
- Sub-tasks placed in their own-status column within the parent's lane; per-lane per-column
  count badges (hidden at 0).
- Collapse/expand an individual lane (chevron). A collapsed lane shows only its header.
- Cursor navigation moves within a lane's columns and across lane boundaries coherently
  (define j/k at lane edges during implementation).

### P2 — Should Have

- Runtime switch of grouping key (`none` ↔ `parent` ↔ `type`), preserving cursor context where
  sensible; default key honoured from config.
- Grouping key `type`: one lane per issue type (Stories, Bugs, Tasks), fixed order — the
  original 009 behaviour, now just another key.
- **Inline `+ Create`** at the foot of a lane's column to add a sub-task to that parent in that
  status. Ties to [012](./012-create-and-edit-items.md).

### P3 — Nice to Have

- Grouping key `query`: named JQL swimlanes; an issue falls into the first lane it matches.
  Defined per board in config ([016](./016-multiple-boards.md) / [015](./015-configuration.md)).
- Collapse/expand **all** lanes at once.

## Out of Scope

- Grouping by ad-hoc dimensions beyond `parent` / `type` / `query` (e.g. assignee, epic).
- A UI for editing swimlane/query definitions — they live in config.
- Re-ranking the backlog (reordering lanes) — read-only order; ranking writes would be their
  own spec, cf. [017](./017-view-modes.md) backlog view.
- Moving a card between lanes (i.e. re-parenting a sub-task) — see [008](./008-sub-tasks.md)
  Out of Scope.

## Technical Notes

- Grouping composes with the existing column derivation. The derived view for `parent` mode is
  `topLevelIssue (backlog order) → column (status) → [its sub-tasks in that status]`. `grouping.ts`
  currently emits one flat `Row[]` per column for Model 1; parent mode needs a per-lane, per-column
  matrix instead — factor the grouping so the key selects the shape.
- **Backlog order is `board.tasks` order.** Top-level issues render as lanes in the order they
  appear in `board.tasks`; the provider ([005](./005-jira-provider.md)) is responsible for
  returning them in sprint rank order. No separate rank field is required for MVP — if the CLI
  can't guarantee order, revisit with an explicit `rank` on `Task`.
- Moving a sub-task across columns changes **its own status** (as the flat prototype already
  does for sub-tasks); the lane it belongs to never changes. Moving the parent header transitions
  the parent's status (the header badge), not a column position.
- Glyphs/colours from `utils/glyphs.ts`; all colours from `theme.ts`.

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | Grouping-key state; route the derived view by key; cursor nav across lanes |
| `src/grouping.ts` | Add parent-grouped shape: lanes (backlog order) × columns × sub-tasks-by-status |
| `src/components/Swimlane.tsx` | New: header (chevron, glyph, key, summary, count, status, assignee) + its row of columns |
| `src/components/Column.tsx` | Per-lane count badge (hidden at 0); optional inline `+ Create` foot |
| `src/providers/mock.ts` | Sample parent issues with backlog order + sub-tasks spread across statuses |
