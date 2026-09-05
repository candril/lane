import { expect, test } from "bun:test"
import { matchesJql } from "./match"
import type { Column, Task } from "../types"

const columns: Column[] = [
  { id: "todo", title: "To Do" },
  { id: "review", title: "In Review" },
]
const ctx = { columns, currentUser: "Grace Hopper" }

function task(over: Partial<Task>): Task {
  return {
    key: "SHOP-1",
    summary: "x",
    type: "story",
    priority: "medium",
    columnId: "todo",
    ...over,
  }
}

// The two real Checkout swimlane predicates.
const DAILY = "labels not in (UX, PO) OR labels is EMPTY"
const POUX = "labels in (UX, PO)"

test("empty query is the catch-all (matches everything)", () => {
  expect(matchesJql(task({}), "", ctx)).toBe(true)
  expect(matchesJql(task({}), "   ", ctx)).toBe(true)
})

test("PO/UX stream matches UX or PO labels", () => {
  expect(matchesJql(task({ labels: ["UX"] }), POUX, ctx)).toBe(true)
  expect(matchesJql(task({ labels: ["PO", "backend"] }), POUX, ctx)).toBe(true)
  expect(matchesJql(task({ labels: ["backend"] }), POUX, ctx)).toBe(false)
  expect(matchesJql(task({ labels: [] }), POUX, ctx)).toBe(false)
})

test("Daily work matches non-UX/PO or unlabelled", () => {
  expect(matchesJql(task({ labels: [] }), DAILY, ctx)).toBe(true) // is EMPTY
  expect(matchesJql(task({ labels: ["backend"] }), DAILY, ctx)).toBe(true) // not in
  expect(matchesJql(task({ labels: ["UX"] }), DAILY, ctx)).toBe(false)
  expect(matchesJql(task({ labels: ["UX", "backend"] }), DAILY, ctx)).toBe(false)
})

test("the two lanes partition every task (first-match is unambiguous)", () => {
  for (const labels of [[], ["UX"], ["PO"], ["backend"], ["UX", "x"]]) {
    const t = task({ labels })
    // Exactly one of the two matches (POUX is checked first in practice).
    expect(matchesJql(t, POUX, ctx) !== matchesJql(t, DAILY, ctx)).toBe(true)
  }
})

test("scalar fields: equality, IN, and negation", () => {
  expect(matchesJql(task({ priority: "highest" }), "priority = Highest", ctx)).toBe(true)
  expect(matchesJql(task({ type: "bug" }), "type in (Bug, Story)", ctx)).toBe(true)
  expect(matchesJql(task({ type: "task" }), "type != Bug", ctx)).toBe(true)
  expect(matchesJql(task({ columnId: "review" }), "status ~ review", ctx)).toBe(true)
})

test("assignee me / EMPTY", () => {
  expect(matchesJql(task({ assignee: "Grace Hopper" }), "assignee = currentUser()", ctx)).toBe(true)
  expect(matchesJql(task({ assignee: undefined }), "assignee is EMPTY", ctx)).toBe(true)
  expect(matchesJql(task({ assignee: "Ada" }), "assignee is EMPTY", ctx)).toBe(false)
})

test("AND / OR / NOT and parentheses compose", () => {
  const t = task({ type: "bug", priority: "highest" })
  expect(matchesJql(t, "type = Bug AND priority = Highest", ctx)).toBe(true)
  expect(matchesJql(t, "type = Story OR priority = Highest", ctx)).toBe(true)
  expect(matchesJql(t, "NOT type = Bug", ctx)).toBe(false)
  expect(matchesJql(t, "(type = Story OR type = Bug) AND priority = Highest", ctx)).toBe(true)
})

test("unknown fields evaluate to no-match, never throw", () => {
  expect(matchesJql(task({}), "duedate < endOfWeek()", ctx)).toBe(false)
})

test("sprint matches by name and by the openSprints/futureSprints functions", () => {
  const active = task({
    sprint: { id: 29134, name: "Sprint 190", state: "active" as const },
  })
  const upcoming = task({
    sprint: { id: 29563, name: "Sprint 191", state: "future" as const },
  })
  const none = task({})

  expect(matchesJql(active, "sprint in openSprints()", ctx)).toBe(true)
  expect(matchesJql(upcoming, "sprint in openSprints()", ctx)).toBe(false)
  expect(matchesJql(upcoming, "sprint in (openSprints(), futureSprints())", ctx)).toBe(true)
  expect(matchesJql(none, "sprint in openSprints()", ctx)).toBe(false)

  expect(matchesJql(upcoming, 'sprint = "Sprint 191"', ctx)).toBe(true)
  expect(matchesJql(upcoming, 'sprint != "Sprint 191"', ctx)).toBe(false)
  expect(matchesJql(none, "sprint is EMPTY", ctx)).toBe(true)
  expect(matchesJql(active, "sprint is EMPTY", ctx)).toBe(false)
})
