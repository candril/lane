# Sprint Swimlanes

**Status**: Implemented (P1 + P2; P3 outstanding)

## Description

lane models a Jira board as columns + a status-split backlog ([044](./044-board-backlog.md)),
which is what a **kanban** board is. A **scrum** board is a different shape: its rows are
sprints, and the backlog is everything not yet in one. Board 42 (`Web & Apps`,
projects WEB + APP) is scrum, and lane could only render it by pinning the query to
`sprint in openSprints()` — the current sprint and nothing else. Widen the query and all
five upcoming sprints collapse into the same four columns, indistinguishable.

This spec makes the sprint a first-class field on a `Task` and adds a **`sprint`
grouping**: one swimlane per sprint, active first, then future by start date, then a
trailing lane for work in no live sprint. Columns stay the statuses — a sprint board is
still a board, it just reads by sprint down the page.

The grouping is data-driven, not a board *type*: a board is "scrum" precisely when its
issues carry sprints. Nothing declares kanban-vs-scrum; a board whose issues have no
sprint simply never offers the grouping.

## Capabilities

### P1 — Must Have

- `Task.sprint` carries the issue's live sprint (`id`, `name`, `state`, `startDate`,
  `endDate`), read from the Jira sprint custom field named by `[jira] sprint_field`.
- An issue in several sprints resolves to one: the **active** sprint if it is in one,
  else the **earliest-starting future** sprint. Closed-only → no live sprint.
- `grouping = "sprint"` builds one lane per live sprint: active sprints first, then
  future by start date, then a trailing `No sprint` lane (omitted when empty). Lane
  header reads `Sprint 191 · 27 Aug – 10 Sep`, and `· active` on the active one.
- Selectable at runtime with the `g r` chord and from the palette
  ([010](./010-command-palette.md)) — offered only when the loaded board has sprint data.
- Settable per board from config as any other grouping ([026](./026-default-view-per-board.md)).
- `grouping = "sprint"` on a board with no sprint data falls back to `none` rather than
  rendering one bogus lane — the same guard the epic board already applies to `parent`.
- The **backlog view** (`v k`, [044](./044-board-backlog.md)) sections by sprint on a
  scrum board — one section per live sprint, then `Backlog` — and needs no
  `backlog_statuses` to be reachable there. This is the shape of Jira's own scrum
  backlog screen, and the counterpart to the lanes: same split, read as a ranked list.
- A board that *declares* `backlog_statuses` keeps them, sprints or no sprints. The
  declaration says what that board's backlog is; a kanban board with a handful of
  sprinted issues must not silently turn into a scrum one.
- Ranking (`⇧J`/`⇧K`) stops at a sprint section's edge instead of crossing it. On a
  status backlog crossing the divider is a status transition; on a sprint one it would
  be a sprint move, which nothing here performs — see Out of Scope.

### P2 — Should Have

- Per-board `sprint_board_id`: keep only sprints belonging to that Jira board. Real
  need, not hypothetical — WEB/APP issues sit in sprints from **two** boards, and
  both name theirs `Sprint 193`, so without it the board grows two identically-titled
  lanes. The sprint field carries `boardId`, so this is a filter, not a second request.
- `sprint` in the swimlane/filter grammar, so `sprint in openSprints()` stops evaluating
  to no-match in [`jql/match.ts`](../src/jql/match.ts) and a hand-written lane can name
  a sprint.

### P3 — Nice to Have

- Sprint tag on the card, like the epic tag ([029](./029-epic-on-card.md)), for the flat
  groupings where the lane header isn't there to say it.
- Sprint goal in the lane header (the field returns it; Sprint 190's is
  *"Köcki kann bestenfalls früh Feierabend machen"*).

## Out of Scope

- **Closed sprints as lanes.** Only active and future sprints become lanes; an issue
  whose sprints are all closed lands in `No sprint`. A full-project query would
  otherwise grow a lane per historical sprint — WEB/APP have ~190 closed. This mirrors
  Jira's own backlog view, which lists live sprints plus the backlog and nothing else.
  Scope the board JQL if you want a past sprint back.
- **Moving a card between sprints.** Status transitions are [041](./041-set-status.md);
  a sprint move is a different mutation and belongs in its own spec. This is why ranking
  stops at a sprint section's edge rather than dragging the issue across it, and why the
  backlog view is read-only across sections.
- **Sprint capacity / velocity / burndown.** lane is a board, not a report.
- **A `scrum` board type in config.** Deliberately absent — the grouping is offered when
  the data has sprints, so there is no flag to get wrong. See Description.

## Technical Notes

The sprint field id is instance-wide, not per board: `customfield_10020` on jiradg. It
comes back from `/rest/api/3/search/jql` as an array of objects — `{id, name, state,
boardId, goal, startDate, endDate}` — so no parsing of the legacy
`com.atlassian.greenhopper…[id=1,name=…]` string form is needed.

`buildLanes` already has the shape this needs: the query-swimlane branch maps a lane list
over `partition(tasks)` + `flatColumns`. The sprint branch is the same, except the lane
list is derived from the tasks rather than from config, and sub-tasks follow their root's
sprint — a sub-task's own sprint field is unreliable and splitting a parent from its
children across lanes would be worse than wrong.

Lane keys are the sprint **id**, never the name: two boards on one project can and do
issue sprints with the same name.

## Open Questions

- ~~**Where does an issue in several sprints go?**~~ **Resolved:** active wins, else the
  earliest future one. Carry-over issues (closed sprint + active sprint) are common; the
  live sprint is the one you are working in.
- **Should the active sprint's lane sort first even when a future sprint starts
  earlier?** Cannot happen with well-formed sprints, so left as "sort by state, then
  start date" rather than special-cased. Revisit if Jira proves otherwise.

## Decisions (as built)

- **P1 and P2 both shipped.** `sprint_board_id` could not wait for a second pass: without
  it board 42 rendered two lanes called `Sprint 193` and two called `Sprint 194` on the
  first live run, because board 12469 issues sprints of the same name into the same two
  projects.
- **The board query is live sprints *plus all open work*, not sprints alone.** Scoping it
  to sprints left the trailing lane holding 19 issues — precisely the ones parked in
  another board's sprint — which reads as "the backlog" while being a nineteenth of it.
  Widening it makes that lane the real backlog (143), and the sprint lanes above are
  unchanged either way.
- **Lane labels render in local time.** Jira returns sprint bounds as instants, and the
  day a reader calls "the end of the sprint" is the one on their own clock — Sprint 191
  ends `2026-09-09T22:00Z`, which is 10 Sep in Zurich, and 10 Sep is what Jira shows.
  Fixtures sit at midday so the tests don't assert a timezone.
- **`g r`, not `g s`.** Sprint lanes *are* the scrum board's swimlanes, but query
  swimlanes already hold `s` and they remain a distinct grouping.
- **The backlog view reuses 044's segments rather than growing a mode of its own.** A
  segment was a status predicate; it is now a predicate over the root's *position* —
  status and sprint — so `backlogRows` and `backlogTabTasks` serve both shapes unchanged
  and `ListRow.segment` widened from `"board" | "backlog"` to an opaque key.
- **`hasBacklog` is now `config || the data has sprints`**, so `v k` opens on a scrum
  board that declares nothing. Verified live: Compax sections into its five sprints plus
  a 143-issue `Backlog`, while Checkout — which has both `backlog_statuses` and six
  sprinted issues — still reads `To Do` / `Backlog`.

## File Structure

| File | Change |
|------|--------|
| `src/types.ts` | `Sprint` interface; `Task.sprint` |
| `src/config/types.ts` | `JiraSettings.sprintField`, `BoardConfig.sprintBoardId` |
| `src/config/validate.ts` | parse `jira.sprint_field` / `boards[].sprint_board_id`; `"sprint"` in `GROUPINGS` |
| `src/providers/jira.ts` | `sprintField` on `JiraConfig`; request it, map it in `toTask`, filter by `sprintBoardId` |
| `src/grouping.ts` | `"sprint"` in `Grouping`; sprint branch in `buildLanes`; sprint segments in `backlogSegments`; `rootColumns` → `rootAt` |
| `src/useBoardKeymap.ts` | ranking crosses only a status backlog's divider |
| `src/App.tsx` | `g r` in `GROUPING_KEYS`; offer `sprint` and `v k` when the board has sprint data |
| `src/commands/builder.ts`, `src/commands/types.ts` | palette entry, gated on `hasSprints` |
| `src/jql/match.ts` | `sprint` field + `openSprints()` / `futureSprints()` (P2) |
| `config.example.toml` | document `sprint_field`, `sprint_board_id`, `grouping = "sprint"` |
