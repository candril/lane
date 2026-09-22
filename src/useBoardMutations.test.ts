import { expect, test } from "bun:test"
import { stepTargets } from "./useBoardMutations"
import type { Board, Task } from "./types"

const board: Board = {
  backlog: [{ id: "refine", title: "Refinement" }],
  columns: [
    { id: "todo", title: "To Do" },
    { id: "doing", title: "In Progress" },
    { id: "done", title: "Done" },
  ],
  tasks: [],
}

const task = (key: string, columnId: string): Task => ({
  key,
  summary: key,
  type: "task",
  priority: "medium",
  columnId,
})

test("each marked issue steps from its own status", () => {
  const moves = stepTargets(board, [task("A", "refine"), task("B", "todo")], 1)
  expect(Object.fromEntries(moves)).toEqual({ A: "todo", B: "doing" })
})

test("stepping back crosses onto the backlog, the way a single ⇧H does", () => {
  expect(stepTargets(board, [task("A", "todo")], -1).get("A")).toBe("refine")
})

test("an issue at the end of the workflow stays put", () => {
  const moves = stepTargets(board, [task("A", "done"), task("B", "doing")], 1)
  expect(Object.fromEntries(moves)).toEqual({ B: "done" })
})
