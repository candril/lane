import { expect, test } from "bun:test"
import { assigneeCandidates, filterAssignees } from "./assign"
import type { Board, Task } from "./types"

const task = (key: string, assignee?: string, assigneeId?: string): Task => ({
  key,
  summary: key,
  type: "task",
  priority: "medium",
  columnId: "todo",
  assignee,
  assigneeId,
})

const board: Board = {
  columns: [{ id: "todo", title: "To Do" }],
  tasks: [task("A-1", "Ada"), task("A-2", "Ada"), task("A-3", "Grace"), task("A-4")],
}

test("me and Unassigned lead, then board assignees by descending count", () => {
  const c = assigneeCandidates(board, "Grace")
  expect(c[0]).toMatchObject({ value: "Grace", label: "me (Grace)" })
  expect(c[1]).toMatchObject({ value: null, label: "Unassigned" })
  // Grace is "me", so she isn't repeated; Ada (2 cards) is the only other person.
  expect(c.slice(2).map((x) => x.value)).toEqual(["Ada"])
  expect(c[2]!.detail).toBe("2")
})

test("without a current user there is no 'me' entry", () => {
  const c = assigneeCandidates(board)
  expect(c[0]).toMatchObject({ value: null, label: "Unassigned" })
  expect(c.slice(1).map((x) => x.value)).toEqual(["Ada", "Grace"])
})

test("candidate value is the assign id (email/accountId) when known, else the name", () => {
  const withIds: Board = {
    columns: [{ id: "todo", title: "To Do" }],
    tasks: [task("B-1", "Ada", "ada@x.io"), task("B-2", "Grace")],
  }
  const c = assigneeCandidates(withIds)
  const ada = c.find((x) => x.label === "Ada")!
  const grace = c.find((x) => x.label === "Grace")!
  expect(ada.value).toBe("ada@x.io") // exact identifier → non-interactive assign
  expect(grace.value).toBe("Grace") // no id → falls back to the display name
})

test("fuzzy filter narrows by label; empty query keeps all", () => {
  const c = assigneeCandidates(board)
  expect(filterAssignees(c, "").length).toBe(c.length)
  expect(filterAssignees(c, "grc").map((x) => x.value)).toEqual(["Grace"])
})
