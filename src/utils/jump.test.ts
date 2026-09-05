import { expect, test } from "bun:test"
import { jumpLabels } from "./jump"

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
