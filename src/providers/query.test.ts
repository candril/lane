import { expect, test } from "bun:test"
import { createQueryProvider, deriveColumns } from "./query"
import type { BoardProvider } from "./provider"
import type { Task } from "../types"

const task = (key: string, status: string): Task => ({
  key,
  summary: key,
  type: "task",
  priority: "medium",
  columnId: "whatever-this-board-said",
  status,
})

function baseProvider(results: Task[], moves: string[] = []): BoardProvider {
  return {
    loadBoard: () => Promise.resolve({ columns: [], tasks: [] }),
    searchIssues: (_jql, limit) => Promise.resolve(results.slice(0, limit)),
    transitionTo: (key, status) => {
      moves.push(`${key}→${status}`)
      return Promise.resolve()
    },
    moveTask: () => Promise.reject(new Error("the board mapping must not be used")),
    createIssue: () => Promise.reject(new Error("unused")),
    editSummary: () => Promise.resolve(),
    setLabels: () => Promise.resolve(),
    setEpic: () => Promise.resolve(),
    assignTask: () => Promise.resolve(),
  }
}

test("deriveColumns: one column per status present", () => {
  const columns = deriveColumns([
    task("A-1", "In Review"),
    task("A-2", "Done"),
    task("A-3", "Done"),
  ])
  expect(columns).toEqual([
    { id: "in-review", title: "In Review" },
    { id: "done", title: "Done" },
  ])
})

test("deriveColumns: the origin's order wins, unknown statuses append", () => {
  const tasks = [task("A-1", "Done"), task("A-2", "Escalated"), task("A-3", "To Do")]
  const columns = deriveColumns(tasks, ["To Do", "In Progress", "Done"])
  expect(columns.map((c) => c.title)).toEqual(["To Do", "Done", "Escalated"])
})

test("deriveColumns: an issue with no status still gets a column", () => {
  const columns = deriveColumns([{ ...task("A-1", ""), status: undefined }])
  expect(columns).toEqual([{ id: "unknown", title: "Unknown" }])
})

test("loadBoard: results are re-slotted into the derived columns", async () => {
  const provider = createQueryProvider(
    baseProvider([task("A-1", "To Do"), task("B-9", "Done")]),
    'text ~ "parcel*"',
  )
  const board = await provider.loadBoard()
  expect(board.columns.map((c) => c.title)).toEqual(["To Do", "Done"])
  // The incoming columnId came from whichever board answered; it must not survive.
  expect(board.tasks.map((t) => t.columnId)).toEqual(["to-do", "done"])
})

test("moveTask: transitions to the status its column names, not through the board mapping", async () => {
  const moves: string[] = []
  const provider = createQueryProvider(
    baseProvider([task("A-1", "To Do"), task("A-2", "Done")], moves),
    "x",
  )
  await provider.loadBoard()
  await provider.moveTask("A-1", "done")
  expect(moves).toEqual(["A-1→Done"])
})

test("moveTask: a column this result set doesn't have is refused", async () => {
  const provider = createQueryProvider(baseProvider([task("A-1", "To Do")]), "x")
  await provider.loadBoard()
  expect(provider.moveTask("A-1", "shipped")).rejects.toThrow("can't move A-1 here")
})

test("createIssue is refused: it would land in another board and vanish on refresh", () => {
  const provider = createQueryProvider(baseProvider([]), "x")
  expect(provider.createIssue({ type: "task", summary: "nope" })).rejects.toThrow("search tab")
})

test("rankTask is absent, so the reorder gesture hides itself", () => {
  expect(createQueryProvider(baseProvider([]), "x").rankTask).toBeUndefined()
})

test("loadBoard: the sub-tasks of what matched come along, as a board load does", async () => {
  const story = task("A-1", "To Do")
  const sub: Task = { ...task("A-2", "In Progress"), type: "subtask", parentKey: "A-1" }
  const asked: string[] = []
  const base: BoardProvider = {
    ...baseProvider([]),
    searchIssues: (jql, limit) => {
      asked.push(jql)
      return Promise.resolve(
        /subTaskIssueTypes/.test(jql) ? [sub].slice(0, limit) : [story].slice(0, limit),
      )
    },
  }
  const board = await createQueryProvider(base, "parent = A-9").loadBoard()
  expect(board.tasks.map((t) => t.key)).toEqual(["A-1", "A-2"])
  expect(asked[1]).toBe("parent in (A-1) AND issuetype in subTaskIssueTypes()")
})

test("loadBoard: a query that already returned sub-tasks doesn't get them twice", async () => {
  const sub: Task = { ...task("A-2", "To Do"), type: "subtask", parentKey: "A-1" }
  const base: BoardProvider = {
    ...baseProvider([]),
    searchIssues: () => Promise.resolve([sub]),
  }
  const board = await createQueryProvider(base, "type:subtask").loadBoard()
  expect(board.tasks.map((t) => t.key)).toEqual(["A-2"])
})

test("loadBoard: nothing matched means no follow-up query", async () => {
  const asked: string[] = []
  const base: BoardProvider = {
    ...baseProvider([]),
    searchIssues: (jql) => {
      asked.push(jql)
      return Promise.resolve([])
    },
  }
  await createQueryProvider(base, 'text ~ "zzz*"').loadBoard()
  expect(asked).toHaveLength(1)
})
