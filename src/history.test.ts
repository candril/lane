import { expect, test } from "bun:test"
import { describeChange, HISTORY_CAP, historyRows } from "./history"
import type { ChangeEntry } from "./providers/provider"

const entry = (at: string, items: ChangeEntry["items"]): ChangeEntry => ({
  at,
  author: "Ada Lovelace",
  items,
})

test("a value change names the new value; a text edit only says it happened", () => {
  expect(describeChange({ field: "status", from: "To Do", to: "In Review" })).toBe(
    "status → In Review",
  )
  expect(describeChange({ field: "assignee", from: "Ada" })).toBe("assignee cleared")
  expect(describeChange({ field: "description", from: "a", to: "b" })).toBe("description edited")
})

test("rows continue the viewer's cursor indices and carry the first text edit as a diff", () => {
  const rows = historyRows(
    [
      entry("2026-09-03T12:00:00Z", [{ field: "status", to: "Done" }]),
      entry("2026-09-01T12:00:00Z", [
        { field: "summary", from: "a", to: "b" },
        { field: "description", from: "x", to: "y" },
      ]),
    ],
    4,
  )
  expect(rows.map((r) => r.index)).toEqual([4, 5])
  expect(rows[0]!.diff).toBeUndefined()
  expect(rows[1]!.diff).toEqual({ field: "summary", from: "a", to: "b" })
  expect(rows[1]!.summary).toBe("summary edited · description edited")
  // Local time, so only the shape is fixed — including the padded single-digit day.
  expect(rows[0]!.when).toMatch(/^ 3 Sep \d\d:\d\d$/)
})

test("the section caps what it draws, until asked for the rest", () => {
  const many = Array.from({ length: HISTORY_CAP + 5 }, (_, i) =>
    entry(`2026-08-${String(i + 1).padStart(2, "0")}T12:00:00Z`, [{ field: "labels", to: "x" }]),
  )
  expect(historyRows(many, 1)).toHaveLength(HISTORY_CAP)
  expect(historyRows(many, 1, Infinity)).toHaveLength(HISTORY_CAP + 5)
})
