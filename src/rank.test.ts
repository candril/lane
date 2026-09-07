import { expect, test } from "bun:test"
import { rankPlan } from "./rank"

interface Row {
  key: string
  parent?: string
}

/** `A B* C* D` — a `*` marks the issue, `<` puts the cursor on the one before it. */
function parse(shape: string): { rows: Row[]; cursor: number; marked: Set<string> } {
  const rows: Row[] = []
  const marked = new Set<string>()
  let cursor = -1
  for (const token of shape.trim().split(/\s+/)) {
    const key = token.replace(/[*<]/g, "")
    const [name, parent] = key.split(".")
    rows.push(parent ? { key: name!, parent } : { key: name! })
    if (token.includes("*")) {
      marked.add(name!)
    }
    if (token.includes("<")) {
      cursor = rows.length - 1
    }
  }
  return { rows, cursor, marked }
}

function plan(shape: string, direction: -1 | 1) {
  const { rows, cursor, marked } = parse(shape)
  const result = rankPlan(rows, cursor, direction, {
    key: (row) => row.key,
    sibling: (row, cursorRow) => row.parent === cursorRow.parent,
    marked: (row) => marked.has(row.key),
  })
  return result && { keys: result.keys, neighbor: result.neighbor.key }
}

/** The order the board ends up in, so a plan reads as the move it makes. */
function order(shape: string, direction: -1 | 1): string {
  const { rows } = parse(shape)
  const result = plan(shape, direction)
  if (!result) {
    return rows.map((r) => r.key).join(" ")
  }
  const moving = new Set(result.keys)
  const rest = rows.filter((r) => !moving.has(r.key)).map((r) => r.key)
  const at = rest.indexOf(result.neighbor)
  rest.splice(direction < 0 ? at : at + 1, 0, ...result.keys)
  return rest.join(" ")
}

test("an unmarked issue steps past its next sibling", () => {
  expect(order("A B< C D", 1)).toBe("A C B D")
  expect(order("A B< C D", -1)).toBe("B A C D")
})

test("an adjacent block moves as one", () => {
  expect(order("A B* C*< D E", 1)).toBe("A D B C E")
  expect(order("A B*< C* D E", -1)).toBe("B C A D E")
})

test("a scattered block gathers at the cursor and steps", () => {
  expect(order("A B* C*< D E* F", 1)).toBe("A D B C E F")
  expect(order("A B* C*< D E* F", -1)).toBe("B C E A D F")
})

test("a second press moves the gathered block by one", () => {
  expect(order("A D B* C*< E* F", 1)).toBe("A D F B C E")
})

test("an unmarked cursor brings the block to it", () => {
  expect(order("A B* C D< E* F", 1)).toBe("A C D B E F")
  expect(order("A B* C D< E* F", -1)).toBe("A C B E D F")
})

test("the block keeps board order, not the order it was marked in", () => {
  expect(order("A B* C D E*< F", 1)).toBe("A C D F B E")
})

test("no sibling that way leaves everything put", () => {
  expect(plan("A*< B* C", -1)).toBeNull()
  expect(plan("A B*< C*", 1)).toBeNull()
})

test("ranking stays at one level: a sub-task ranks against its siblings", () => {
  // B's sub-tasks nest under it; ⇧J on the first one skips C entirely.
  expect(order("A B x.B*< y.B z.B C", 1)).toBe("A B y x z C")
  // …and a root skips the nested rows to reach the next root.
  expect(order("A B< x.B y.B C", 1)).toBe("A x y C B")
})

test("marks at another level do not join the block", () => {
  expect(plan("A B< x.B* y.B* C", 1)).toEqual({ keys: ["B"], neighbor: "C" })
})
