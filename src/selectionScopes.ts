import type { Lane, ListRow } from "./grouping"
import type { Cursor } from "./useBoardCursor"

/** One ring around the cursor that `^A` can mark whole (specs/055), innermost first. */
export interface SelectionScope {
  name: string
  keys: string[]
}

/**
 * The rings in a row view: a sub-task's siblings (or, on a root, every root), then —
 * in a backlog, whose rows sit in segments (a sprint, or the board/backlog split,
 * specs/044 and 050) — the segment the cursor is in, named by its heading, then every
 * visible row. Siblings are the rows at the same depth under the same parent, and
 * roots are counted within the segment: "select all" inside a sprint means that
 * sprint, and one more press means everything.
 */
export function rowScopes(rows: ListRow[], focus: number): SelectionScope[] {
  const row = rows[focus]
  if (!row) {
    return []
  }
  const keysOf = (list: ListRow[]) => list.map((r) => r.task.key)
  const segment = row.segment
  const within = segment === undefined ? rows : rows.filter((r) => r.segment === segment)
  const scopes: SelectionScope[] =
    row.depth === 0
      ? [{ name: "roots", keys: keysOf(within.filter((r) => r.depth === 0)) }]
      : [
          {
            name: "siblings",
            keys: keysOf(
              within.filter(
                (r) => r.depth === row.depth && r.task.parentKey === row.task.parentKey,
              ),
            ),
          },
        ]
  if (segment !== undefined) {
    const heading = rows.find((r) => r.segment === segment && r.section)?.section?.title
    scopes.push({ name: heading ?? "segment", keys: keysOf(within) })
  }
  scopes.push({ name: "all rows", keys: keysOf(rows) })
  return scopes
}

/**
 * The rings on the board grid: a sub-task's siblings in its cell, the cell (one
 * column of one lane), the swimlane, the board. A single-lane board skips the lane
 * ring — it would be the board under another name.
 */
export function boardScopes(lanes: Lane[], cursor: Cursor): SelectionScope[] {
  const lane = lanes[cursor.lane]
  if (!lane) {
    return []
  }
  const cell = lane.columns[cursor.column] ?? []
  const keysOf = (l: Lane) => l.columns.flatMap((cards) => cards.map((c) => c.task.key))
  const scopes: SelectionScope[] = []
  const card = cursor.onHeader ? undefined : cell[cursor.row]
  if (card?.isSubtask) {
    const siblings = cell.filter((c) => c.isSubtask && c.task.parentKey === card.task.parentKey)
    scopes.push({ name: "siblings", keys: siblings.map((c) => c.task.key) })
  }
  if (card) {
    scopes.push({ name: "cell", keys: cell.map((c) => c.task.key) })
  }
  if (lanes.length > 1) {
    scopes.push({ name: "lane", keys: keysOf(lane) })
  }
  scopes.push({ name: "board", keys: lanes.flatMap(keysOf) })
  return scopes
}
