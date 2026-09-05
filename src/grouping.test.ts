import { expect, test } from "bun:test"
import {
  backlogRows,
  backlogTabTasks,
  buildLanes,
  listRows,
  nextStatus,
  splitBacklog,
} from "./grouping"
import type { Board, Task } from "./types"

const columns = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "In Progress" },
  { id: "done", title: "Done" },
]

const task = (key: string, columnId: string, parentKey?: string): Task => ({
  key,
  summary: key,
  type: parentKey ? "subtask" : "story",
  priority: "medium",
  columnId,
  parentKey,
})

// Parent in To Do; its two sub-tasks are In Progress and Done.
const board: Board = {
  columns,
  tasks: [task("P-1", "todo"), task("S-1", "doing", "P-1"), task("S-2", "done", "P-1")],
}

const cardKeys = (cols: { task: Task }[][]) => cols.map((cards) => cards.map((c) => c.task.key))

test("own-column: each sub-task sits in its own status column with a parentRef", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "own-column" })
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], ["S-1"], ["S-2"]])
  const sub = lane!.columns[1]![0]!
  expect(sub.isSubtask).toBe(true)
  expect(sub.parentRef).toBe("P-1")
  expect(sub.nested).toBeUndefined()
})

test("under-parent: sub-tasks nest in the parent's column, flagged nested", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "under-parent" })
  expect(cardKeys(lane!.columns)).toEqual([["P-1", "S-1", "S-2"], [], []])
  const sub = lane!.columns[0]![1]!
  expect(sub.isSubtask).toBe(true)
  expect(sub.nested).toBe(true)
  expect(sub.parentRef).toBeUndefined()
})

test("checklist buckets sub-tasks like under-parent (rendering differs, not cells)", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "checklist" })
  expect(cardKeys(lane!.columns)).toEqual([["P-1", "S-1", "S-2"], [], []])
  expect(lane!.columns[0]![1]!.nested).toBe(true)
})

// Rank order puts the finished sub-task first — the case the checklist reorders.
const withDoneFirst: Board = {
  columns,
  tasks: [
    task("P-1", "todo"),
    task("S-DONE", "done", "P-1"),
    task("S-OPEN", "doing", "P-1"),
    task("S-ALSO", "doing", "P-1"),
  ],
}

test("checklist sinks done rows to the bottom, keeping rank order within each group", () => {
  const [lane] = buildLanes(withDoneFirst, "none", { subtaskLayout: "checklist" })
  expect(cardKeys(lane!.columns)[0]).toEqual(["P-1", "S-OPEN", "S-ALSO", "S-DONE"])
})

test("only the checklist reorders — under-parent keeps pure rank order", () => {
  const [lane] = buildLanes(withDoneFirst, "none", { subtaskLayout: "under-parent" })
  expect(cardKeys(lane!.columns)[0]).toEqual(["P-1", "S-DONE", "S-OPEN", "S-ALSO"])
})

test("hiding the done children leaves the parent marking what it withheld", () => {
  const [lane] = buildLanes(withDoneFirst, "none", {
    subtaskLayout: "checklist",
    children: "hide-done",
  })
  expect(cardKeys(lane!.columns)[0]).toEqual(["P-1", "S-OPEN", "S-ALSO"])
  expect(lane!.columns[0]![0]!.hidden).toEqual({ count: 1, done: true })
})

test("basket buckets sub-tasks like own-column, and names the parent for the tray", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "basket" })
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], ["S-1"], ["S-2"]])
  const sub = lane!.columns[1]![0]!
  expect(sub.parentRef).toBe("P-1")
  expect(sub.parentSummary).toBe("P-1")
})

test("a parent's cards are contiguous in a column — what the basket tray groups by", () => {
  const two: Board = {
    columns,
    tasks: [
      task("P-1", "todo"),
      task("S-1", "doing", "P-1"),
      task("P-2", "doing"),
      task("S-2", "doing", "P-2"),
      task("S-3", "doing", "P-1"),
    ],
  }
  const [lane] = buildLanes(two, "none", { subtaskLayout: "basket" })
  expect(cardKeys(lane!.columns)[1]).toEqual(["S-1", "S-3", "P-2", "S-2"])
})

test("own-column is the default when no layout is given", () => {
  const [lane] = buildLanes(board, "none")
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], ["S-1"], ["S-2"]])
})

// ---- sub-task folds (specs/042) ----

test("a folded parent keeps its card and count, and drops its sub-task cards", () => {
  const folded = { subtaskLayout: "under-parent" as const, foldedSubtasks: new Set(["P-1"]) }
  const [lane] = buildLanes(board, "none", folded)
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], [], []])
  const parent = lane!.columns[0]![0]!
  expect(parent.subtaskCount).toBe(2)
  expect(parent.hidden).toEqual({ count: 2, done: false })
})

test("own-column: folding a parent removes its sub-tasks from the other columns too", () => {
  const [lane] = buildLanes(board, "none", {
    subtaskLayout: "own-column",
    foldedSubtasks: new Set(["P-1"]),
  })
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], [], []])
})

test("an unfolded parent still carries its sub-task count", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "under-parent" })
  const parent = lane!.columns[0]![0]!
  expect(parent.subtaskCount).toBe(2)
  expect(parent.hidden).toBeUndefined()
})

test("the parent-grouped view is unaffected by a fold — the lane fold owns it", () => {
  const lanes = buildLanes(board, "parent", { foldedSubtasks: new Set(["P-1"]) })
  expect(cardKeys(lanes[0]!.columns)).toEqual([[], ["S-1"], ["S-2"]])
})

// ---- backlog split (specs/044) ---------------------------------------------

const backlogColumns = [
  { id: "to-be-discussed", title: "To be discussed" },
  { id: "in-refinement", title: "In refinement" },
]

// A board story with a sub-task sitting in a backlog status, and a backlog story
// with a sub-task sitting in a board status — each sub-task must follow its parent.
const mixed: Task[] = [
  task("P-1", "todo"),
  task("S-1", "in-refinement", "P-1"),
  task("B-1", "in-refinement"),
  task("BS-1", "doing", "B-1"),
  task("B-2", "to-be-discussed"),
]

test("splitBacklog: a root's status decides for its whole sub-tree", () => {
  const { board: onBoard, backlog } = splitBacklog(mixed, backlogColumns)
  expect(onBoard.map((t) => t.key)).toEqual(["P-1", "S-1"])
  expect(backlog.map((t) => t.key)).toEqual(["B-1", "BS-1", "B-2"])
})

test("splitBacklog: no backlog columns leaves every task on the board", () => {
  expect(splitBacklog(mixed, undefined).board).toHaveLength(mixed.length)
  expect(splitBacklog(mixed, []).backlog).toEqual([])
})

const withBacklog: Board = { columns, tasks: mixed, backlog: backlogColumns }

test("backlogRows: the board's first column on top, everything backlogged below", () => {
  const rows = backlogRows(mixed, withBacklog, new Set())
  expect(rows.map((r) => r.task.key)).toEqual(["P-1", "B-1", "B-2"])
  expect(rows[0]!.section).toEqual({ title: "To Do", count: 1 })
  expect(rows[1]!.section).toEqual({ title: "Backlog", count: 2 })
  expect(rows.map((r) => r.segment)).toEqual(["board", "backlog", "backlog"])
})

test("backlogRows: the backlog segment keeps rank order across its statuses", () => {
  // B-1 is In refinement and B-2 To be discussed: one segment, query order, not
  // re-sorted by status.
  const rows = backlogRows(mixed, withBacklog, new Set())
  expect(rows.slice(1).map((r) => r.task.columnId)).toEqual(["in-refinement", "to-be-discussed"])
})

test("backlogRows: an expanded parent nests its sub-task inside its segment", () => {
  const rows = backlogRows(mixed, withBacklog, new Set(["B-1"]))
  expect(rows.map((r) => r.task.key)).toEqual(["P-1", "B-1", "BS-1", "B-2"])
  // The heading counts issues, not rows — a nested sub-task doesn't inflate it.
  expect(rows[1]!.section).toEqual({ title: "Backlog", count: 2 })
  expect(rows[2]!.segment).toBe("backlog")
})

test("backlogRows: an empty segment gets no heading", () => {
  const onlyBacklog = [task("B-2", "to-be-discussed")]
  const rows = backlogRows(onlyBacklog, { ...withBacklog, tasks: onlyBacklog }, new Set())
  expect(rows.map((r) => r.section?.title)).toEqual(["Backlog"])
})

test("backlogTabTasks: spans both segments, ignoring the rest of the board", () => {
  // W-1 is In Progress, so it is on the board only. S-1 comes along because its
  // parent sits in the first column — a sub-task follows its root.
  const alsoInProgress = [...mixed, task("W-1", "doing")]
  expect(backlogTabTasks(alsoInProgress, withBacklog).map((t) => t.key)).toEqual([
    "P-1",
    "S-1",
    "B-1",
    "BS-1",
    "B-2",
  ])
})

test("nextStatus: ⇧L promotes through the backlog and onto the board", () => {
  expect(nextStatus(withBacklog, "to-be-discussed", 1)?.id).toBe("in-refinement")
  expect(nextStatus(withBacklog, "in-refinement", 1)?.id).toBe("todo")
})

test("nextStatus: ⇧H sends an issue back off the board into the backlog", () => {
  expect(nextStatus(withBacklog, "todo", -1)?.id).toBe("in-refinement")
  expect(nextStatus(withBacklog, "to-be-discussed", -1)).toBeNull()
  expect(nextStatus(withBacklog, "done", 1)).toBeNull()
})

test("nextStatus: a board with no backlog walks its columns exactly as before", () => {
  const plain: Board = { columns, tasks: [] }
  expect(nextStatus(plain, "todo", -1)).toBeNull()
  expect(nextStatus(plain, "todo", 1)?.id).toBe("doing")
})

// ---- epics as root items (specs/034) ---------------------------------------

const epic = (key: string): Task => ({
  key,
  summary: key,
  type: "epic",
  priority: "medium",
  columnId: "todo",
})
const child = (key: string, columnId: string, epicKey: string): Task => ({
  key,
  summary: key,
  type: "story",
  priority: "medium",
  columnId,
  epicKey,
})

// An epic, a story under it, and that story's sub-task: three levels.
const epicTree: Task[] = [
  epic("E-1"),
  child("S-1", "doing", "E-1"),
  task("T-1", "done", "S-1"),
  child("S-2", "todo", "E-1"),
]

test("listRows: an issue nests under its epic when the epic is loaded", () => {
  const rows = listRows(epicTree, new Set(["E-1"]))
  expect(rows.map((r) => [r.task.key, r.depth])).toEqual([
    ["E-1", 0],
    ["S-1", 1],
    ["S-2", 1],
  ])
  expect(rows[0]!.hasChildren).toBe(true)
})

test("listRows: expanding the story reaches the third level", () => {
  const rows = listRows(epicTree, new Set(["E-1", "S-1"]))
  expect(rows.map((r) => [r.task.key, r.depth])).toEqual([
    ["E-1", 0],
    ["S-1", 1],
    ["T-1", 2],
    ["S-2", 1],
  ])
})

test("listRows: without its epic loaded, an issue is a root as before", () => {
  const rows = listRows(epicTree.slice(1), new Set(["S-1"]))
  expect(rows.map((r) => [r.task.key, r.depth])).toEqual([
    ["S-1", 0],
    ["T-1", 1],
    ["S-2", 0],
  ])
})

test("the epic board's cards are its epics, its issues rendered inside them", () => {
  // `under-parent` keeps a child in its parent's column, which is where the checklist
  // layout draws it inside the card — one card per epic, one level deep.
  const [lane] = buildLanes({ columns, tasks: epicTree }, "none", {
    subtaskLayout: "under-parent",
  })
  expect(cardKeys(lane!.columns)).toEqual([["E-1", "S-1", "S-2"], [], []])
  expect(lane!.columns[0]!.map((c) => c.isSubtask)).toEqual([false, true, true])
})

test("backlog segments follow the epic root, so a tree stays together", () => {
  const backlogged = [epic("E-2"), child("S-3", "in-refinement", "E-2")]
  const withBl: Board = { columns, tasks: backlogged, backlog: backlogColumns }
  // E-2 is To Do, so its refinement-status child comes along into the To Do segment.
  const rows = backlogRows(backlogged, withBl, new Set(["E-2"]))
  expect(rows.map((r) => r.task.key)).toEqual(["E-2", "S-3"])
  expect(rows[0]!.section).toEqual({ title: "To Do", count: 1 })
})

test("listRows: epics first, everything epic-less under one heading", () => {
  const mixedSet = [
    child("S-9", "todo", "E-9"),
    task("L-1", "todo"),
    epic("E-9"),
    task("L-2", "doing"),
  ]
  const rows = listRows(mixedSet, new Set(["E-9"]))
  expect(rows.map((r) => r.task.key)).toEqual(["E-9", "S-9", "L-1", "L-2"])
  expect(rows[2]!.section).toEqual({ title: "No epic", count: 2 })
  expect(rows[0]!.section).toBeUndefined()
})

test("listRows: a set with no epics keeps its plain order and no heading", () => {
  const rows = listRows([task("L-1", "todo"), task("L-2", "doing")], new Set())
  expect(rows.map((r) => r.task.key)).toEqual(["L-1", "L-2"])
  expect(rows.every((r) => r.section === undefined)).toBe(true)
})

const epicMix = [epic("E-9"), child("S-9", "doing", "E-9"), task("L-1", "todo")]

test("an epic board leaves epic-less issues off the board entirely", () => {
  const [lane] = buildLanes({ columns, tasks: epicMix }, "none")
  expect(cardKeys(lane!.columns)).toEqual([["E-9"], ["S-9"], []])
})

test("by parent reads flat on an epic board — an initiative is what would go above", () => {
  const lanes = buildLanes({ columns, tasks: epicMix }, "parent")
  expect(lanes).toHaveLength(1)
  expect(lanes[0]!.header).toBeNull()
  expect(cardKeys(lanes[0]!.columns)).toEqual([["E-9"], ["S-9"], []])
})

test("by type on an epic board offers only the Epics lane", () => {
  const lanes = buildLanes({ columns, tasks: epicMix }, "type")
  expect(lanes.map((l) => l.header)).toEqual([{ kind: "label", text: "Epics", count: 1 }])
})

test("a board with no epics is untouched: every root is still a lane", () => {
  const lanes = buildLanes(
    { columns, tasks: [task("L-1", "todo"), task("L-2", "doing")] },
    "parent",
  )
  expect(lanes.map((l) => l.key)).toEqual(["L-1", "L-2"])
})

test("backlogRows: a segment keeps its own heading and the No epic one inside it", () => {
  const set = [
    epic("E-9"),
    child("S-9", "todo", "E-9"),
    task("L-1", "todo"),
    task("L-2", "in-refinement"),
  ]
  const withBl: Board = { columns, tasks: set, backlog: backlogColumns }
  const rows = backlogRows(set, withBl, new Set(["E-9"]))
  expect(rows.map((r) => [r.task.key, r.section?.title])).toEqual([
    ["E-9", "To Do"],
    ["S-9", undefined],
    ["L-1", "No epic"],
    ["L-2", "Backlog"],
  ])
})

// ── Sprint lanes (specs/050) ─────────────────────────────────────────────────

const sprint = (
  id: number,
  name: string,
  state: "active" | "future",
  startDate: string,
  endDate: string,
) => ({ id, name, state, startDate, endDate })

// Midday instants on purpose: the label renders in local time (the clock the reader is
// on), so a fixture near midnight would assert a different day per timezone.
const ACTIVE = sprint(29134, "Sprint 190", "active", "2026-08-13T12:00Z", "2026-08-26T12:00Z")
const NEXT = sprint(29563, "Sprint 191", "future", "2026-08-27T12:00Z", "2026-09-09T12:00Z")
const LATER = sprint(29564, "Sprint 192", "future", "2026-09-10T12:00Z", "2026-09-23T12:00Z")

const sprinted = (key: string, columnId: string, s?: typeof ACTIVE): Task => ({
  ...task(key, columnId),
  sprint: s,
})

const sprintBoard: Board = {
  columns,
  // Deliberately out of order, so the lane sort is doing the work and not the input.
  tasks: [
    sprinted("A-3", "todo", LATER),
    sprinted("A-1", "doing", ACTIVE),
    sprinted("A-4", "todo", undefined),
    sprinted("A-2", "todo", NEXT),
  ],
}

test("sprint lanes run active first, then future by start date, then the unsprinted", () => {
  const lanes = buildLanes(sprintBoard, "sprint")
  expect(lanes.map((l) => l.key)).toEqual([
    "sprint:29134",
    "sprint:29563",
    "sprint:29564",
    "sprint:none",
  ])
  expect(lanes.map((l) => (l.header?.kind === "label" ? l.header.text : ""))).toEqual([
    "Sprint 190 · active · 13 Aug – 26 Aug",
    "Sprint 191 · 27 Aug – 9 Sep",
    "Sprint 192 · 10 Sep – 23 Sep",
    "No sprint",
  ])
  expect(cardKeys(lanes[0]!.columns)).toEqual([[], ["A-1"], []])
  expect(cardKeys(lanes[3]!.columns)).toEqual([["A-4"], [], []])
})

test("the unsprinted lane is dropped when every card is in a sprint", () => {
  const allSprinted: Board = { columns, tasks: [sprinted("A-1", "todo", ACTIVE)] }
  expect(buildLanes(allSprinted, "sprint").map((l) => l.key)).toEqual(["sprint:29134"])
})

test("two boards' sprints sharing a name stay separate lanes, told apart by their dates", () => {
  const other = sprint(32195, "Sprint 191", "future", "2026-09-24T12:00Z", "2026-10-07T12:00Z")
  const twinNames: Board = {
    columns,
    tasks: [sprinted("A-1", "todo", NEXT), sprinted("A-2", "todo", other)],
  }
  const lanes = buildLanes(twinNames, "sprint")
  expect(lanes.map((l) => l.key)).toEqual(["sprint:29563", "sprint:32195"])
  expect(lanes.map((l) => (l.header?.kind === "label" ? l.header.text : ""))).toEqual([
    "Sprint 191 · 27 Aug – 9 Sep",
    "Sprint 191 · 24 Sep – 7 Oct",
  ])
})

test("a sub-task follows its parent's sprint rather than splitting off into its own lane", () => {
  const withSubtask: Board = {
    columns,
    tasks: [sprinted("P-1", "todo", ACTIVE), { ...task("S-1", "doing", "P-1"), sprint: NEXT }],
  }
  const lanes = buildLanes(withSubtask, "sprint")
  expect(lanes.map((l) => l.key)).toEqual(["sprint:29134"])
  expect(cardKeys(lanes[0]!.columns)).toEqual([["P-1"], ["S-1"], []])
})

test("sprint grouping on a board with no sprints reads flat instead of one bogus lane", () => {
  const lanes = buildLanes(board, "sprint")
  expect(lanes).toHaveLength(1)
  expect(lanes[0]!.key).toBe("all")
  expect(lanes[0]!.header).toBeNull()
})

// ── Sprint backlog view (specs/050) ──────────────────────────────────────────

const sprintBacklogBoard: Board = {
  columns,
  tasks: [
    sprinted("A-2", "todo", NEXT),
    sprinted("A-1", "doing", ACTIVE),
    sprinted("A-3", "todo", undefined),
  ],
}

test("backlogRows: a board with no declared backlog sections by sprint instead", () => {
  const rows = backlogRows(sprintBacklogBoard.tasks, sprintBacklogBoard, new Set())
  expect(rows.map((r) => r.task.key)).toEqual(["A-1", "A-2", "A-3"])
  expect(rows.map((r) => r.segment)).toEqual(["sprint:29134", "sprint:29563", "sprint:none"])
  expect(rows.map((r) => r.section?.title)).toEqual([
    "Sprint 190 · active · 13 Aug – 26 Aug",
    "Sprint 191 · 27 Aug – 9 Sep",
    "Backlog",
  ])
})

test("backlogRows: a declared status backlog still wins over the board's sprints", () => {
  // Checkout' shape: backlog statuses configured, and a few issues that carry sprints.
  const mixed: Board = {
    columns,
    backlog: [{ id: "refine", title: "In refinement" }],
    tasks: [sprinted("A-1", "todo", ACTIVE), { ...task("B-1", "refine"), sprint: NEXT }],
  }
  const rows = backlogRows(mixed.tasks, mixed, new Set())
  expect(rows.map((r) => r.segment)).toEqual(["board", "backlog"])
  expect(rows.map((r) => r.section?.title)).toEqual(["To Do", "Backlog"])
})

test("backlogRows: a sub-task follows its parent's sprint section", () => {
  const withChild: Board = {
    columns,
    tasks: [sprinted("P-1", "todo", ACTIVE), { ...task("S-1", "doing", "P-1"), sprint: NEXT }],
  }
  const rows = backlogRows(withChild.tasks, withChild, new Set(["P-1"]))
  expect(rows.map((r) => r.task.key)).toEqual(["P-1", "S-1"])
  expect(rows.map((r) => r.segment)).toEqual(["sprint:29134", "sprint:29134"])
})

test("backlogTabTasks: a sprint backlog spans every issue, sprinted or not", () => {
  expect(backlogTabTasks(sprintBacklogBoard.tasks, sprintBacklogBoard).map((t) => t.key)).toEqual([
    "A-2",
    "A-1",
    "A-3",
  ])
})

// ---- child visibility (specs/052) ------------------------------------------

test("hide-done drops the finished children and says so on the parent card", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "own-column", children: "hide-done" })
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], ["S-1"], []])
  expect(lane!.columns[0]![0]!.hidden).toEqual({ count: 1, done: true })
})

test("none drops every child, whatever column it was in", () => {
  const [lane] = buildLanes(board, "none", { subtaskLayout: "own-column", children: "none" })
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], [], []])
  expect(lane!.columns[0]![0]!.hidden).toEqual({ count: 2, done: false })
})

test("hide-done thins a by-parent lane but leaves its header count whole", () => {
  const [lane] = buildLanes(board, "parent", { children: "hide-done" })
  expect(cardKeys(lane!.columns)).toEqual([[], ["S-1"], []])
  expect(lane!.header).toEqual({ kind: "issue", task: board.tasks[0]!, subtaskCount: 2 })
})

test("none is ignored in the by-parent view, where the children are the content", () => {
  const [lane] = buildLanes(board, "parent", { children: "none" })
  expect(cardKeys(lane!.columns)).toEqual([[], ["S-1"], ["S-2"]])
})

test("a fold still reads as folded while hide-done is on", () => {
  const [lane] = buildLanes(board, "none", {
    subtaskLayout: "own-column",
    children: "hide-done",
    foldedSubtasks: new Set(["P-1"]),
  })
  expect(cardKeys(lane!.columns)).toEqual([["P-1"], [], []])
  expect(lane!.columns[0]![0]!.hidden).toEqual({ count: 2, done: false })
})
