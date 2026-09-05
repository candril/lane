import { expect, test } from "bun:test"
import { unifiedDiff } from "./unifiedDiff"

const body = (diff: string) => diff.split("\n").slice(3)

test("a changed line is a removal beside an addition, the rest is context", () => {
  expect(body(unifiedDiff("a\nb\nc", "a\nB\nc"))).toEqual([" a", "-b", "+B", " c"])
})

test("identical texts are all context", () => {
  expect(body(unifiedDiff("a\nb", "a\nb"))).toEqual([" a", " b"])
})

test("a description written from nothing is all additions, with a zero-length old side", () => {
  const diff = unifiedDiff("", "one\ntwo", "description")
  expect(diff.split("\n").slice(0, 3)).toEqual([
    "--- a/description",
    "+++ b/description",
    "@@ -0,0 +1,2 @@",
  ])
  expect(body(diff)).toEqual(["+one", "+two"])
})

test("appended and removed lines land where they belong", () => {
  expect(body(unifiedDiff("keep\nold", "keep\nnew\nmore"))).toEqual([
    " keep",
    "-old",
    "+new",
    "+more",
  ])
})
