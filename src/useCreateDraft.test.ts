import { expect, test } from "bun:test"
import { createParent } from "./useCreateDraft"
import type { Task } from "./types"

const task = (key: string, type: Task["type"], parentKey?: string): Task => ({
  key,
  summary: key,
  type,
  priority: "medium",
  columnId: "todo",
  parentKey,
})

const epic = task("SHOP-100", "epic")
const story = task("SHOP-412", "story")
const subtask = task("SHOP-413", "subtask", "SHOP-412")
const tasks = [epic, story, subtask]

test("an epic parents a child issue", () => {
  expect(createParent(epic, tasks)).toEqual({
    key: "SHOP-100",
    color: expect.any(String),
    kind: "epic",
  })
})

test("a story parents a sub-task", () => {
  expect(createParent(story, tasks)?.kind).toBe("issue")
})

test("a sub-task files under its own parent, so `n` on one gives a sibling", () => {
  expect(createParent(subtask, tasks)?.key).toBe("SHOP-412")
})

test("nothing in context is top-level", () => {
  expect(createParent(undefined, tasks)).toBeNull()
})

test("a sub-task whose parent the board never loaded falls back to top-level", () => {
  expect(createParent(subtask, [subtask])).toBeNull()
})

test("an anchor the board doesn't hold still parents — the epic above its stories", () => {
  expect(createParent({ key: "SHOP-900", type: "epic" }, tasks)).toMatchObject({
    key: "SHOP-900",
    kind: "epic",
  })
})
