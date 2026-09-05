import { expect, test } from "bun:test"
import { columnColor, columnGlyph } from "./glyphs"
import { theme } from "../theme"

const FIVE = ["To Do", "In Progress", "In Review", "On Hold", "Done"]

test("the first and last columns are the same not-started/done grey", () => {
  expect(columnColor(0, 5, "To Do")).toBe(theme.textDim)
  expect(columnColor(4, 5, "Done")).toBe(theme.textDim)
})

test("a parked column is amber wherever it sits", () => {
  expect(columnColor(3, 5, "On Hold")).toBe(theme.warning)
  expect(columnColor(1, 4, "Blocked")).toBe(theme.warning)
  expect(columnColor(2, 5, "Waiting for review")).toBe(theme.warning)
})

test("columns in flight alternate blue and purple", () => {
  expect(columnColor(1, 5, "In Progress")).toBe(theme.primary)
  expect(columnColor(2, 5, "In Review")).toBe(theme.secondary)
})

// The positional palette wrapped at four columns, painting On Hold the success green
// and Done the grey of To Do — the two columns whose colour matters most, backwards.
test("no column takes the success green, at any board width", () => {
  for (const total of [2, 3, 4, 5, 8, 13]) {
    for (let i = 0; i < total; i++) {
      expect(columnColor(i, total, FIVE[i] ?? `Column ${i}`)).not.toBe(theme.success)
    }
  }
})

test("the glyph ramp spreads across the columns in flight", () => {
  expect(FIVE.map((_, i) => columnGlyph(i, 5))).toEqual(["○", "◔", "◑", "◕", "✓"])
  expect([0, 1, 2, 3].map((i) => columnGlyph(i, 4))).toEqual(["○", "◔", "◕", "✓"])
  expect([0, 1, 2].map((i) => columnGlyph(i, 3))).toEqual(["○", "◑", "✓"])
  expect([0, 1].map((i) => columnGlyph(i, 2))).toEqual(["○", "✓"])
})

test("a status the board holds no column for reads as not started", () => {
  expect(columnGlyph(-1, 5)).toBe("○")
})
