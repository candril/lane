import { expect, test } from "bun:test"
import { jumpLabels, searchLabels, searchMatches } from "./jump"

test("single-char labels while they fit, all distinct", () => {
  const labels = jumpLabels(5)
  expect(labels).toHaveLength(5)
  expect(labels.every((l) => l.length === 1)).toBe(true)
  expect(new Set(labels).size).toBe(5)
})

test("switches to uniform two-char labels past the alphabet", () => {
  const labels = jumpLabels(40)
  expect(labels).toHaveLength(40)
  expect(labels.every((l) => l.length === 2)).toBe(true)
  expect(new Set(labels).size).toBe(40)
})

test("no label is a prefix of another (unambiguous typing)", () => {
  const labels = jumpLabels(30)
  for (const a of labels) {
    for (const b of labels) {
      if (a !== b) {
        expect(b.startsWith(a)).toBe(false)
      }
    }
  }
})

test("does not use s (the jump trigger)", () => {
  expect(jumpLabels(25).join("")).not.toContain("s")
})

test("count 0 yields no labels", () => {
  expect(jumpLabels(0)).toEqual([])
})

const target = (key: string, text: string, lane = false) => ({ key, lane, text })

const board = [
  target("SHOP-412", "SHOP-412 Rework the checkout summary step"),
  target("SHOP-413", "SHOP-413 Wireframe the summary card"),
  target("SHOP-388", "SHOP-388 Totals drift on refund"),
  target("lane:UX", "PO/UX stream", true),
]

test("an empty query labels nothing — there is nothing to pick from yet", () => {
  expect(searchLabels(board, "")).toEqual(new Map())
})

test("only the matching targets are labelled, one key each", () => {
  const labels = searchLabels(board, "summary")
  expect([...labels.keys()]).toEqual(["SHOP-412", "SHOP-413"])
  expect([...labels.values()].every((l) => l.length === 1)).toBe(true)
})

test("the search reads the key as well as the summary", () => {
  expect([...searchLabels(board, "388").keys()]).toEqual(["SHOP-388"])
})

test("a lane header is searchable by its own text", () => {
  expect([...searchLabels(board, "ux stream").keys()]).toEqual(["lane:UX"])
})

test("no label can be a key that would narrow the search further", () => {
  // "summar" continues into "y" on both matches, so "y" must not be a label.
  expect([...searchLabels(board, "summar").values()]).not.toContain("y")
})

test("matches past the alphabet stay unlabelled rather than growing a second key", () => {
  const many = Array.from({ length: 40 }, (_, i) => target(`SHOP-${i}`, `SHOP-${i} thing`))
  const labels = searchLabels(many, "thing")
  expect(labels.size).toBeLessThan(many.length)
  expect([...labels.values()].every((l) => l.length === 1)).toBe(true)
})

test("the match count is every match, labelled or not", () => {
  expect(searchMatches(board, "SHOP").length).toBe(3)
  expect(searchMatches(board, "nothing here").length).toBe(0)
})

test("a continuation anywhere in the text is not a label, not only the first one", () => {
  // "s" occurs in "SHOP" and again in "summary"; typing "u" must narrow, not jump.
  expect([...searchLabels(board, "s").values()]).not.toContain("u")
})
