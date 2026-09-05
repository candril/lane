import { expect, test } from "bun:test"
import { fuzzyMatch, fuzzyMatches } from "./fuzzy"

test("empty query matches anything with score 0", () => {
  expect(fuzzyMatch("", "whatever")).toEqual({ score: 0, positions: [] })
})

test("subsequence match reports positions", () => {
  const r = fuzzyMatch("abc", "aXbYc")
  expect(r).not.toBeNull()
  expect(r!.positions).toEqual([0, 2, 4])
})

test("non-subsequence returns null", () => {
  expect(fuzzyMatch("cba", "abc")).toBeNull()
  expect(fuzzyMatch("xyz", "abc")).toBeNull()
})

test("case-insensitive", () => {
  expect(fuzzyMatches("BUG", "a nasty bug")).toBe(true)
})

test("word-boundary matches outrank scattered ones", () => {
  const boundary = fuzzyMatch("ip", "In Progress")!
  const scattered = fuzzyMatch("ip", "wikipedia")!
  expect(boundary.score).toBeGreaterThan(scattered.score)
})

test("consecutive run outranks a scattered mid-word match", () => {
  const run = fuzzyMatch("abc", "abc")!
  const scattered = fuzzyMatch("abc", "aXbXcX")!
  expect(run.score).toBeGreaterThan(scattered.score)
})
