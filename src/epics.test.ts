import { expect, test } from "bun:test"
import { epicChoices } from "./epics"
import type { Task } from "./types"

const task = (key: string, extra: Partial<Task> = {}): Task => ({
  key,
  summary: `${key} summary`,
  type: "task",
  priority: "medium",
  columnId: "todo",
  ...extra,
})

test("an epic on the board is offered before anything links to it", () => {
  const choices = epicChoices([task("SHOP-100", { type: "epic", summary: "Checkout redesign" })])
  expect(choices).toEqual([
    { value: "SHOP-100", label: "Checkout redesign", color: expect.any(String) },
  ])
})

test("an epic the board only knows by link is offered too", () => {
  const choices = epicChoices([task("SHOP-1", { epicKey: "SHOP-900", epicName: "Loyalty" })])
  expect(choices).toMatchObject([{ value: "SHOP-900", label: "Loyalty" }])
})

test("an epic's own summary wins over the name a child reports", () => {
  const choices = epicChoices([
    task("SHOP-100", { type: "epic", summary: "Checkout redesign" }),
    task("SHOP-1", { epicKey: "SHOP-100", epicName: "stale name" }),
  ])
  expect(choices).toMatchObject([{ value: "SHOP-100", label: "Checkout redesign" }])
})

test("a link with no name falls back to the key", () => {
  expect(epicChoices([task("SHOP-1", { epicKey: "SHOP-900" })])).toMatchObject([
    { label: "SHOP-900" },
  ])
})
