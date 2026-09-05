import type { Board, Column, IssueType, Sprint, Task } from "./types"
import type { ChildVisibility, SubtaskLayout, SwimlaneConfig } from "./config/types"
import { matchesJql } from "./jql/match"

export type Grouping = "none" | "parent" | "type" | "swimlanes" | "sprint"

const DEFAULT_SUBTASK_LAYOUT: SubtaskLayout = "own-column"

/** Extra inputs for the query-swimlane grouping (specs/016). */
export interface LaneOptions {
  swimlanes?: SwimlaneConfig[]
  currentUser?: string
  /** How sub-tasks lay out in the flat/type/query views (specs/008). */
  subtaskLayout?: SubtaskLayout
  /** Which children are drawn at all (specs/052); defaults to `all`. */
  children?: ChildVisibility
  /** Parent keys whose sub-task cards are folded away (specs/042). */
  foldedSubtasks?: Set<string>
}

/** Children a parent has here but does not show, and why (specs/042, specs/052). */
export interface HiddenChildren {
  count: number
  /** Hidden for being done (`hide-done`) rather than folded or switched off. */
  done: boolean
}

/** One card rendered inside a column. */
export interface BoardCard {
  task: Task
  isSubtask: boolean
  /**
   * `own-column` / `basket` layouts: a child shown *away* from the issue it hangs off
   * (in its own status column) — that issue's key, so the card can print a `↳PARENT`
   * reference and the basket can head its tray with it. It is the link the lanes were
   * built on, so on an epic board (specs/034) it is the epic, not a sub-task parent.
   * Absent in the parent-grouped view, where the parent is the lane header.
   */
  parentRef?: string
  /** That issue's summary, for the `basket` layout's tray header (specs/051). */
  parentSummary?: string
  /**
   * `under-parent` layout: a sub-task nested in its parent's column — render it
   * indented with a `↳` connector, and badge its own status when it differs from
   * the column it's shown in.
   */
  nested?: boolean
  /**
   * On a parent card: how many sub-tasks it has in this view — set whether or not they
   * are shown, so the fold keys always have the count (specs/042).
   */
  subtaskCount?: number
  /** On a parent card: the children it isn't showing, so the card can say so. */
  hidden?: HiddenChildren
}

/** A swimlane's label: either the parent issue itself, or a group heading. */
export type LaneHeader =
  | { kind: "issue"; task: Task; subtaskCount: number }
  | { kind: "label"; text: string; count: number }

/** A horizontal band: an optional header plus one card list per board column. */
export interface Lane {
  key: string
  header: LaneHeader | null
  columns: BoardCard[][]
}

/**
 * The issue a task nests under: its sub-task parent, else its epic — whichever of the
 * two is actually in this set (specs/034).
 *
 * That second half is what makes an epic board work: load a team's epics alongside
 * their issues and each issue nests under its epic, one hierarchy level up from the
 * usual story/sub-task pair. A set without epics — every work board — resolves exactly
 * as it did before, since `epicKey` never finds a match.
 */
function linkOf(task: Task, present: Set<string>): string | undefined {
  if (task.parentKey && present.has(task.parentKey)) {
    return task.parentKey
  }
  return task.epicKey && present.has(task.epicKey) ? task.epicKey : undefined
}

/**
 * Split tasks into lane roots and each root's children, preserving order.
 *
 * A task is a *root* when nothing it links to is in this set — an orphan sub-task
 * (parent outside the sprint) becomes its own lane rather than vanishing, and an epic
 * is a root because epics link to nothing above them.
 */
function partition(tasks: Task[]): { roots: Task[]; subsByParent: Map<string, Task[]> } {
  const present = new Set(tasks.map((t) => t.key))
  const subsByParent = new Map<string, Task[]>()
  const roots: Task[] = []
  for (const task of tasks) {
    const link = linkOf(task, present)
    if (!link) {
      roots.push(task)
      continue
    }
    const siblings = subsByParent.get(link) ?? []
    siblings.push(task)
    subsByParent.set(link, siblings)
  }
  return { roots, subsByParent }
}

/**
 * Flat layout for grouping "none"/"type"/query-"swimlanes". Parents keep their
 * natural order; where each sub-task sits depends on `layout` (specs/008):
 *
 * - `own-column` (default) / `basket`: the sub-task goes in the column matching *its
 *   own* status, carrying its parent's key and summary so the link survives the parent
 *   sitting elsewhere. Cards keep the parent-first flattened order within a column,
 *   which puts one parent's cards in a contiguous run — that run is what `basket`
 *   draws its tray around (a render concern, see `Column`/`Basket` — specs/051).
 * - `under-parent` / `checklist`: the sub-task nests in the *parent's* column right
 *   below it, flagged `nested`. `under-parent` renders it as an indented card;
 *   `checklist` folds it into the parent card as a checklist row (a render concern,
 *   so the column layout is identical — see `Column`/`ChecklistCard`) and is the one
 *   layout that reorders: its done rows sink to the bottom of the group.
 *
 * A parent in `folded` keeps its card (carrying the child count) but contributes no
 * sub-task cards at all — in `own-column` that removes them from the other columns too
 * (specs/042). `visibility` withholds children the same way, by rule rather than per
 * card: `hide-done` drops the ones in the done column, `none` drops them all
 * (specs/052). Either way the parent card says how many it is not showing.
 */
function flatColumns(
  tasks: Task[],
  columns: Column[],
  layout: SubtaskLayout,
  folded: Set<string>,
  visibility: ChildVisibility,
): BoardCard[][] {
  const { roots, subsByParent } = partition(tasks)
  const doneColumnId = columns[columns.length - 1]?.id
  const childrenOf = (task: Task) => {
    if (folded.has(task.key) || visibility === "none") {
      return []
    }
    const children = subsByParent.get(task.key) ?? []
    return visibility === "hide-done"
      ? children.filter((c) => c.columnId !== doneColumnId)
      : children
  }
  const parentCard = (task: Task): BoardCard => {
    const count = subsByParent.get(task.key)?.length ?? 0
    if (count === 0) {
      return { task, isSubtask: false }
    }
    const shown = childrenOf(task).length
    const card: BoardCard = { task, isSubtask: false, subtaskCount: count }
    return shown === count
      ? card
      : {
          ...card,
          hidden: {
            count: count - shown,
            done: visibility === "hide-done" && !folded.has(task.key),
          },
        }
  }

  // A checklist reads as a to-do list, so finished rows sink to the bottom instead of
  // interrupting the work that is left — stable, so rank still orders each group. Only
  // this layout sorts: everywhere else a sub-task is a card among cards, where rank is
  // what the eye follows. (⇧J/⇧K still rank against siblings, so ranking a done row
  // moves it within the sunk group rather than back up.)
  const childRows = (task: Task): Task[] => {
    const children = childrenOf(task)
    if (layout !== "checklist") {
      return children
    }
    const done = (t: Task) => t.columnId === doneColumnId
    return [...children.filter((t) => !done(t)), ...children.filter(done)]
  }

  if (layout === "under-parent" || layout === "checklist") {
    return columns.map((column) => {
      const cards: BoardCard[] = []
      for (const task of roots) {
        if (task.columnId !== column.id) {
          continue
        }
        cards.push(parentCard(task))
        for (const sub of childRows(task)) {
          cards.push({ task: sub, isSubtask: true, nested: true })
        }
      }
      return cards
    })
  }

  const sequence: BoardCard[] = []
  for (const task of roots) {
    sequence.push(parentCard(task))
    for (const sub of childrenOf(task)) {
      sequence.push({
        task: sub,
        isSubtask: true,
        parentRef: task.key,
        parentSummary: task.summary,
      })
    }
  }
  return columns.map((column) => sequence.filter((c) => c.task.columnId === column.id))
}

/** Heading for issues that link to no epic, where epics are what the view is about. */
const NO_EPIC = "No epic"

/** A set holding epics is an epic board: the epics are what it is about (specs/034). */
function isEpicBoard(tasks: Task[]): boolean {
  return tasks.some((t) => t.type === "epic")
}

/** Only the epics and what hangs off them — the board's cards on an epic board. */
function epicSubtrees(tasks: Task[]): Task[] {
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const present = new Set(byKey.keys())
  const rootOf = (task: Task): Task => {
    const link = linkOf(task, present)
    const parent = link ? byKey.get(link) : undefined
    return parent ? rootOf(parent) : task
  }
  return tasks.filter((t) => rootOf(t).type === "epic")
}

const NO_SPRINT = "No sprint"

/** `2026-08-27T11:00:00.000Z` → `27 Aug`. Undated sprints print nothing. */
export function shortDate(iso: string | undefined): string {
  if (!iso) {
    return ""
  }
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getDate()} ${MONTHS[date.getMonth()] ?? ""}`.trim()
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** `Sprint 190 · active · 13 Aug – 26 Aug` — dates are what tells two same-named sprints apart. */
function sprintLabel(sprint: Sprint): string {
  const span = [shortDate(sprint.startDate), shortDate(sprint.endDate)].filter(Boolean).join(" – ")
  return [sprint.name, sprint.state === "active" ? "active" : "", span].filter(Boolean).join(" · ")
}

/**
 * The sprints present in this task set, ordered the way the board reads: the active
 * sprint first, then the upcoming ones by start date. Sorting by state before date
 * rather than by date alone is deliberate — an active sprint is *where you are*, so it
 * heads the board even if a future sprint were somehow scheduled to start earlier.
 */
function sprintsOf(roots: Task[]): Sprint[] {
  const byId = new Map<number, Sprint>()
  for (const task of roots) {
    if (task.sprint && !byId.has(task.sprint.id)) {
      byId.set(task.sprint.id, task.sprint)
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.state !== b.state) {
      return a.state === "active" ? -1 : 1
    }
    return (a.startDate ?? "").localeCompare(b.startDate ?? "")
  })
}

const TYPE_LANES: { type: IssueType; label: string }[] = [
  { type: "story", label: "Stories" },
  { type: "bug", label: "Bugs" },
  { type: "task", label: "Tasks" },
  { type: "epic", label: "Epics" },
]

/** Derive the swimlanes for a grouping key. Lane order is meaningful and stable. */
export function buildLanes(board: Board, grouping: Grouping, options: LaneOptions = {}): Lane[] {
  const { columns } = board
  const layout = options.subtaskLayout ?? DEFAULT_SUBTASK_LAYOUT
  const folded = options.foldedSubtasks ?? new Set<string>()
  // In the by-parent view the children *are* the lane's content (specs/009), so
  // switching them off would leave every lane blank — `none` is ignored there, while
  // hiding the done ones still reads as "what's left on this story".
  const visibility =
    grouping === "parent" && options.children === "none" ? "all" : (options.children ?? "all")

  // On an epic board (specs/034) the cards *are* the epics, with their issues rendered
  // inside them like sub-tasks. An issue linking to no epic is left to the row views,
  // where "No epic" collects it — as a loose card here it would sit among the epics
  // pretending to be one.
  const epicBoard = isEpicBoard(board.tasks)
  const tasks = epicBoard ? epicSubtrees(board.tasks) : board.tasks
  // Lanes group the cards by something *above* them. Above an epic sits an initiative,
  // which Jira does not link here — so on an epic board the parent grouping has nothing
  // to group by and reads flat.
  if (epicBoard && grouping === "parent") {
    grouping = "none"
  }

  // A board whose issues carry no sprint has nothing to lane by — a config asking for
  // `sprint` on a kanban board reads flat rather than as one lane called "No sprint".
  if (grouping === "sprint" && !tasks.some((t) => t.sprint)) {
    grouping = "none"
  }

  if (grouping === "sprint") {
    // One lane per live sprint (specs/050), then the work no live sprint has claimed.
    // Sub-tasks follow their root's sprint rather than their own: a parent and its
    // children split across two lanes would read as two unrelated pieces of work.
    const { roots, subsByParent } = partition(tasks)
    const laneOf = (root: Task) => root.sprint?.id ?? null
    const lane = (key: string, text: string, members: Task[]): Lane => ({
      key,
      header: { kind: "label", text, count: members.length },
      columns: flatColumns(
        members.flatMap((r) => [r, ...(subsByParent.get(r.key) ?? [])]),
        columns,
        layout,
        folded,
        visibility,
      ),
    })
    const lanes = sprintsOf(roots).map((sprint) =>
      lane(
        `sprint:${sprint.id}`,
        sprintLabel(sprint),
        roots.filter((r) => laneOf(r) === sprint.id),
      ),
    )
    const unsprinted = roots.filter((r) => laneOf(r) === null)
    return unsprinted.length > 0 ? [...lanes, lane("sprint:none", NO_SPRINT, unsprinted)] : lanes
  }

  if (grouping === "swimlanes" && options.swimlanes && options.swimlanes.length > 0) {
    // Query-based lanes: each root falls into the first swimlane whose JQL it
    // matches (an empty JQL is the catch-all). Its sub-tasks follow, laid out
    // flat by column — the same shape as `type`. Empty lanes are kept so the
    // board's structure stays stable.
    const { roots, subsByParent } = partition(tasks)
    const ctx = { columns, currentUser: options.currentUser }
    const assigned = new Set<string>()
    return options.swimlanes.map((lane) => {
      const laneRoots = roots.filter((r) => !assigned.has(r.key) && matchesJql(r, lane.jql, ctx))
      laneRoots.forEach((r) => assigned.add(r.key))
      const laneTasks = laneRoots.flatMap((p) => [p, ...(subsByParent.get(p.key) ?? [])])
      return {
        key: `lane:${lane.name}`,
        header: { kind: "label", text: lane.name, count: laneRoots.length },
        columns: flatColumns(laneTasks, columns, layout, folded, visibility),
      }
    })
  }

  if (grouping === "none" || grouping === "swimlanes") {
    return [
      {
        key: "all",
        header: null,
        columns: flatColumns(tasks, columns, layout, folded, visibility),
      },
    ]
  }

  if (grouping === "parent") {
    // Every root issue is a lane, in backlog (task-list) order; its sub-tasks
    // fill the columns by their own status. Childless roots get an empty lane —
    // no catch-all. (009 parent mode)
    const { roots, subsByParent } = partition(tasks)
    const doneColumnId = columns[columns.length - 1]?.id
    return roots.map((parent) => {
      const children = subsByParent.get(parent.key) ?? []
      // The header keeps the *total* count while `hide-done` thins the lane: a lane
      // that reads "3" with one card left is saying two of them are finished.
      const shown =
        visibility === "hide-done" ? children.filter((c) => c.columnId !== doneColumnId) : children
      return {
        key: parent.key,
        header: { kind: "issue", task: parent, subtaskCount: children.length },
        columns: columns.map((column) =>
          shown.filter((c) => c.columnId === column.id).map((c) => ({ task: c, isSubtask: true })),
        ),
      }
    })
  }

  // grouping === "type": one lane per issue type present, flat layout within.
  const { roots, subsByParent } = partition(tasks)
  return TYPE_LANES.flatMap(({ type, label }) => {
    const parents = roots.filter((t) => t.type === type)
    if (parents.length === 0) {
      return []
    }
    const laneTasks = parents.flatMap((parent) => [parent, ...(subsByParent.get(parent.key) ?? [])])
    return [
      {
        key: `type:${type}`,
        header: { kind: "label", text: label, count: parents.length },
        columns: flatColumns(laneTasks, columns, layout, folded, visibility),
      },
    ]
  })
}

/** Find a card's position across lanes, so the cursor can follow a move. */
export function locate(
  lanes: Lane[],
  key: string,
): { lane: number; column: number; row: number } | null {
  for (let lane = 0; lane < lanes.length; lane++) {
    const cols = lanes[lane]!.columns
    for (let column = 0; column < cols.length; column++) {
      const row = cols[column]!.findIndex((c) => c.task.key === key)
      if (row >= 0) {
        return { lane, column, row }
      }
    }
  }
  return null
}

// ---- list view -------------------------------------------------------------

export interface ListRow {
  task: Task
  depth: number
  hasChildren: boolean
  expanded: boolean
  /**
   * Group heading rendered above this row — the backlog's segments (specs/044). The
   * count is the segment's issues, so the heading can show its size.
   */
  section?: { title: string; count: number }
  /**
   * Which backlog segment this row is in, so ⇧J/⇧K can tell when it crosses over.
   * `board`/`backlog` on a status backlog (specs/044); `sprint:<id>` / `sprint:none` on
   * a sprint one (specs/050), where crossing is a sprint move and stays a no-op.
   */
  segment?: string
}

/**
 * Rows for the list view: root issues, each optionally expanded to its children.
 *
 * The walk is depth-first rather than root-then-children, because the tree can now be
 * three deep — epic → story → sub-task (specs/034). Stopping at one level would drop
 * the sub-task entirely, since its story is no longer a root.
 */
export function listRows(tasks: Task[], expanded: Set<string>): ListRow[] {
  const { roots, subsByParent } = partition(tasks)
  // Epics first, then everything that links to none of them under one heading
  // (specs/034) — an epic view is about the epics, and a pile of loose issues between
  // them hides exactly what you came to see. Sets without epics are untouched.
  const epics = roots.filter((r) => r.type === "epic")
  const loose = epics.length > 0 ? roots.filter((r) => r.type !== "epic") : []
  const ordered = epics.length > 0 ? [...epics, ...loose] : roots
  const rows: ListRow[] = []
  const walk = (task: Task, depth: number) => {
    const children = subsByParent.get(task.key) ?? []
    const isOpen = expanded.has(task.key)
    rows.push({ task, depth, hasChildren: children.length > 0, expanded: isOpen })
    if (isOpen) {
      for (const child of children) {
        walk(child, depth + 1)
      }
    }
  }
  for (const task of ordered) {
    if (loose.length > 0 && task === loose[0]) {
      const at = rows.length
      walk(task, 0)
      rows[at] = { ...rows[at]!, section: { title: NO_EPIC, count: loose.length } }
      continue
    }
    walk(task, 0)
  }
  return rows
}

// ---- backlog view (specs/044) ----------------------------------------------

/**
 * Split a task set into what the board shows and what its backlog does.
 *
 * A *root's* status decides for its whole sub-tree: a sub-task in a backlog status
 * under a board story stays with its parent (and vice versa), so no issue is rendered
 * in both tabs and no parent loses a child to the other one.
 */
export function splitBacklog(
  tasks: Task[],
  backlog: Column[] | undefined,
): { board: Task[]; backlog: Task[] } {
  if (!backlog || backlog.length === 0) {
    return { board: tasks, backlog: [] }
  }
  const backlogIds = new Set(backlog.map((c) => c.id))
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const present = new Set(byKey.keys())
  const rootOf = (task: Task): Task => {
    const link = linkOf(task, present)
    const parent = link ? byKey.get(link) : undefined
    return parent ? rootOf(parent) : task
  }
  const inBacklog = (task: Task) => backlogIds.has(rootOf(task).columnId)
  return {
    board: tasks.filter((t) => !inBacklog(t)),
    backlog: tasks.filter(inBacklog),
  }
}

/**
 * The status one step left/right of `columnId`: the backlog statuses and the board
 * columns as a single sequence, so promoting an issue through refinement and onto the
 * board — and sending it back — walk the same line (specs/044). `null` at either end.
 */
export function nextStatus(board: Board, columnId: string, direction: -1 | 1): Column | null {
  const lane = [...(board.backlog ?? []), ...board.columns]
  const at = lane.findIndex((c) => c.id === columnId)
  return at < 0 ? null : (lane[at + direction] ?? null)
}

/**
 * Rows for the backlog tab, shaped like Jira's backlog screen: the board's **first
 * column** on top, then everything in a **backlog** status below it. Those two
 * segments are what the screen is for — deciding what crosses from one to the other —
 * so the individual refinement statuses stay visible per row rather than splitting the
 * list further.
 *
 * Headings ride on the first row of their segment rather than occupying rows of their
 * own, so the cursor, ranking and scroll-into-view all keep counting plain issue rows.
 * An empty segment is dropped; its heading would say nothing the count doesn't.
 */
export function backlogRows(tasks: Task[], board: Board, expanded: Set<string>): ListRow[] {
  const at = rootAt(tasks)
  return backlogSegments(board).flatMap((segment) => {
    const rows = listRows(
      tasks.filter((t) => segment.holds(at.get(t.key) ?? { columnId: t.columnId, sprintId: null })),
      expanded,
    )
    const first = rows[0]
    if (!first) {
      return []
    }
    const count = rows.filter((r) => r.depth === 0).length
    // The segment's own heading goes on its first row; any heading the rows already
    // carry — "No epic" inside an epic tab (specs/034) — is kept, or the epic-less
    // issues would sit flat among the epics with nothing marking them.
    return rows.map((row, i) => ({
      ...row,
      segment: segment.key,
      section: i === 0 ? { title: segment.title, count } : row.section,
    }))
  })
}

/** The issues the backlog tab renders: its two segments, in one list. */
export function backlogTabTasks(tasks: Task[], board: Board): Task[] {
  const at = rootAt(tasks)
  const segments = backlogSegments(board)
  return tasks.filter((t) =>
    segments.some((segment) =>
      segment.holds(at.get(t.key) ?? { columnId: t.columnId, sprintId: null }),
    ),
  )
}

/** Where a row's *root* sits — the two axes a backlog segment can group by. */
interface RootAt {
  columnId: string
  sprintId: number | null
}

interface BacklogSegment {
  key: string
  title: string
  holds: (at: RootAt) => boolean
}

/**
 * The backlog tab's segments.
 *
 * A **status** backlog (specs/044) has two: the board's first column, named after
 * itself ("To Do") since that is the status an issue lands in when it crosses over,
 * and everything in a backlog status below it.
 *
 * A **sprint** backlog (specs/050) has one per live sprint, in board order, then the
 * work no sprint has claimed — Jira's scrum backlog screen. A board that declares
 * backlog statuses keeps them: that declaration says what its backlog *is*, and a
 * kanban board with a handful of sprinted issues must not silently become scrum.
 */
function backlogSegments(board: Board): BacklogSegment[] {
  const declared = (board.backlog ?? []).length > 0
  if (!declared && board.tasks.some((t) => t.sprint)) {
    return [
      ...sprintsOf(board.tasks).map((sprint) => ({
        key: `sprint:${sprint.id}`,
        title: sprintLabel(sprint),
        holds: (at: RootAt) => at.sprintId === sprint.id,
      })),
      { key: "sprint:none", title: "Backlog", holds: (at: RootAt) => at.sprintId === null },
    ]
  }
  const first = board.columns[0]
  const backlogIds = new Set((board.backlog ?? []).map((c) => c.id))
  const segments: BacklogSegment[] = []
  if (first) {
    segments.push({ key: "board", title: first.title, holds: (at) => at.columnId === first.id })
  }
  segments.push({ key: "backlog", title: "Backlog", holds: (at) => backlogIds.has(at.columnId) })
  return segments
}

/**
 * Each task's *root's* position, keyed by issue key: a sub-task groups under its
 * parent's status and its parent's sprint, so a story and its children never split
 * across two segments.
 */
function rootAt(tasks: Task[]): Map<string, RootAt> {
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const present = new Set(byKey.keys())
  const resolved = new Map<string, RootAt>()
  const own = (task: Task): RootAt => ({
    columnId: task.columnId,
    sprintId: task.sprint?.id ?? null,
  })
  const resolve = (task: Task): RootAt => {
    const cached = resolved.get(task.key)
    if (cached) {
      return cached
    }
    const link = linkOf(task, present)
    const parent = link ? byKey.get(link) : undefined
    // A cycle would only come from bad data, but it must not hang the render.
    resolved.set(task.key, own(task))
    const at = parent ? resolve(parent) : own(task)
    resolved.set(task.key, at)
    return at
  }
  tasks.forEach(resolve)
  return resolved
}
