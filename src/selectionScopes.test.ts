import { expect, test } from "bun:test"
import type { BoardCard, Lane, ListRow } from "./grouping"
import type { Task } from "./types"
import { boardScopes, rowScopes } from "./selectionScopes"

const task = (key: string, parentKey?: string): Task => ({
  key,
  summary: key,
  type: parentKey ? "subtask" : "story",
  priority: "medium",
  columnId: "todo",
  parentKey,
})

const row = (key: string, depth: number, parentKey?: string): ListRow => ({
  task: task(key, parentKey),
  depth,
  hasChildren: false,
  expanded: false,
})

// Two families and a childless root, all expanded.
const rows: ListRow[] = [
  row("P-1", 0),
  row("S-1", 1, "P-1"),
  row("S-2", 1, "P-1"),
  row("P-2", 0),
  row("S-3", 1, "P-2"),
  row("P-3", 0),
]

const names = (scopes: { name: string }[]) => scopes.map((s) => s.name)

test("on a child: its siblings, then every row", () => {
  const scopes = rowScopes(rows, 2)
  expect(names(scopes)).toEqual(["siblings", "all rows"])
  expect(scopes[0]!.keys).toEqual(["S-1", "S-2"])
  expect(scopes[1]!.keys).toHaveLength(6)
})

test("on a root: every root, then every row", () => {
  const scopes = rowScopes(rows, 3)
  expect(names(scopes)).toEqual(["roots", "all rows"])
  expect(scopes[0]!.keys).toEqual(["P-1", "P-2", "P-3"])
})

// A sprint backlog (specs/050): two segments, the first headed, the second with a
// sub-task under its root.
const seg = (r: ListRow, segment: string, section?: string): ListRow => ({
  ...r,
  segment,
  section: section ? { title: section, count: 0 } : undefined,
})
const backlog: ListRow[] = [
  seg(row("A-1", 0), "sprint:1", "Sprint 1"),
  seg(row("A-2", 0), "sprint:1"),
  seg(row("B-1", 0), "sprint:none", "No sprint"),
  seg(row("B-1a", 1, "B-1"), "sprint:none"),
  seg(row("B-2", 0), "sprint:none"),
]

test("in a backlog the segment is a ring of its own, named by its heading", () => {
  const scopes = rowScopes(backlog, 1)
  expect(names(scopes)).toEqual(["roots", "Sprint 1", "all rows"])
  expect(scopes[0]!.keys).toEqual(["A-1", "A-2"])
  expect(scopes[1]!.keys).toEqual(["A-1", "A-2"])
  expect(scopes[2]!.keys).toHaveLength(5)
})

test("roots and siblings are counted within the segment, not across the backlog", () => {
  expect(rowScopes(backlog, 4)[0]!.keys).toEqual(["B-1", "B-2"])
  const child = rowScopes(backlog, 3)
  expect(names(child)).toEqual(["siblings", "No sprint", "all rows"])
  expect(child[0]!.keys).toEqual(["B-1a"])
  expect(child[1]!.keys).toEqual(["B-1", "B-1a", "B-2"])
})

const card = (key: string, parentKey?: string): BoardCard => ({
  task: task(key, parentKey),
  isSubtask: !!parentKey,
})

const lanes: Lane[] = [
  {
    key: "a",
    header: null,
    columns: [[card("A-1"), card("A-1a", "A-1"), card("A-1b", "A-1"), card("A-2")], [card("A-3")]],
  },
  { key: "b", header: null, columns: [[card("B-1")], []] },
]

test("on a checklist row: siblings, the cell, the lane, the board", () => {
  const scopes = boardScopes(lanes, { lane: 0, column: 0, row: 1, onHeader: false })
  expect(names(scopes)).toEqual(["siblings", "cell", "lane", "board"])
  expect(scopes[0]!.keys).toEqual(["A-1a", "A-1b"])
  expect(scopes[1]!.keys).toEqual(["A-1", "A-1a", "A-1b", "A-2"])
  expect(scopes[2]!.keys).toEqual(["A-1", "A-1a", "A-1b", "A-2", "A-3"])
  expect(scopes[3]!.keys).toHaveLength(6)
})

test("on a plain card there are no siblings to start from; on a header, no cell", () => {
  expect(names(boardScopes(lanes, { lane: 0, column: 1, row: 0, onHeader: false }))).toEqual([
    "cell",
    "lane",
    "board",
  ])
  expect(names(boardScopes(lanes, { lane: 1, column: 0, row: 0, onHeader: true }))).toEqual([
    "lane",
    "board",
  ])
})

test("a single-lane board has no lane ring — it would be the board twice", () => {
  const one = [lanes[0]!]
  expect(names(boardScopes(one, { lane: 0, column: 1, row: 0, onHeader: false }))).toEqual([
    "cell",
    "board",
  ])
})
