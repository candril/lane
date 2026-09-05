import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { locate, type Lane, type ListRow } from "./grouping"
import type { Column } from "./types"
import type { TabMode } from "./tabs"

/**
 * Cursor on the board grid. It addresses a lane and a column; within that cell
 * `row` picks a card (or 0 for an empty cell — every cell is selectable). When
 * `onHeader` is set the whole lane's header is selected instead of a cell, and
 * `column` is just remembered for when the cursor drops back into the grid.
 */
export interface Cursor {
  lane: number
  column: number
  row: number
  onHeader: boolean
}

/** A reachable stop in a column's top-to-bottom walk: a lane header or a cell. */
interface Position {
  lane: number
  row: number
  onHeader: boolean
}

/**
 * Owns the board grid cursor and per-lane fold state, plus all the navigation that
 * walks the lanes: column/row moves, top/bottom jumps, and lane folding. Also
 * derives where the cursor sits in its column, so the scroll-into-view snap knows
 * when to pin the scrollbar to an extreme.
 */
export function useBoardCursor(args: {
  lanes: Lane[]
  columns: Column[]
  rows: ListRow[]
  view: TabMode
  query: string
  setListIndex: Dispatch<SetStateAction<number>>
  /** Parent keys whose sub-tasks are folded away (specs/042); owned by App, since
   *  `buildLanes` consumes it before this hook runs. */
  foldedSubtasks: Set<string>
  setFoldedSubtasks: Dispatch<SetStateAction<Set<string>>>
}) {
  const { lanes, columns, rows, view, query, setListIndex, foldedSubtasks, setFoldedSubtasks } =
    args
  // Default grouping is "parent", so the first lane has a header — land on it.
  const [cursor, setCursor] = useState<Cursor>({ lane: 0, column: 0, row: 0, onHeader: true })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Columns folded to a narrow strip (specs/040), keyed by column id. Orthogonal to the
  // lane `collapsed` set above: this is the horizontal axis, that one the vertical.
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())

  // When the filter query narrows the visible set the focused card may be gone —
  // land the cursor on the first stop of the narrowed board so it stays valid.
  const prevNarrowRef = useRef(query)
  useEffect(() => {
    if (prevNarrowRef.current === query) {
      return
    }
    prevNarrowRef.current = query
    setCursor({ lane: 0, column: 0, row: 0, onHeader: lanes[0]?.header != null })
    setListIndex(0)
  }, [query, lanes, setListIndex])

  // Cards can disappear from under the cursor — a sub-task fold (specs/042), a
  // refresh, a mutation — so pull `row` back inside the cell it addresses.
  useEffect(() => {
    const last = Math.max(0, (lanes[cursor.lane]?.columns[cursor.column]?.length ?? 0) - 1)
    if (!cursor.onHeader && cursor.row > last) {
      setCursor((c) => ({ ...c, row: last }))
    }
  }, [lanes, cursor])

  const activeCards = lanes[cursor.lane]?.columns[cursor.column] ?? []
  const columnCollapsed = (column: number) => {
    const id = columns[column]?.id
    return id !== undefined && collapsedColumns.has(id)
  }
  // A cell holds a card only when the cursor is on a cell (not the header) and a
  // card actually sits at that row; empty cells, headers, and collapsed columns (cards
  // hidden) have no focused card.
  const focusedKey =
    cursor.onHeader || columnCollapsed(cursor.column)
      ? null
      : (activeCards[cursor.row]?.task.key ?? null)
  const laneHeader = lanes[cursor.lane]?.header

  const isCollapsed = (lane: number) => {
    const key = lanes[lane]?.key
    return key !== undefined && collapsed.has(key)
  }

  // Every top-to-bottom stop in one column: each lane's header (if it has one),
  // then — unless the lane is folded — its cards, or a single empty-cell stop.
  // Vertical navigation and edge detection both walk this list, so headers,
  // empty cells, and folds are all first-class without special cases.
  const columnPositions = (column: number): Position[] => {
    const positions: Position[] = []
    // A collapsed column hides its cards, so each lane's cell is a single stop.
    const collapsedCol = columnCollapsed(column)
    lanes.forEach((lane, li) => {
      if (lane.header) {
        positions.push({ lane: li, row: 0, onHeader: true })
      }
      if (!isCollapsed(li)) {
        const count = collapsedCol ? 0 : (lane.columns[column]?.length ?? 0)
        if (count === 0) {
          positions.push({ lane: li, row: 0, onHeader: false })
        } else {
          for (let row = 0; row < count; row++) {
            positions.push({ lane: li, row, onHeader: false })
          }
        }
      }
    })
    return positions
  }

  const positionIndex = (positions: Position[], c: Cursor) =>
    positions.findIndex(
      (p) => p.lane === c.lane && p.onHeader === c.onHeader && (p.onHeader || p.row === c.row),
    )

  const cursorIndex = positionIndex(columnPositions(cursor.column), cursor)

  function moveCursorColumn(direction: -1 | 1) {
    setCursor((c) => {
      // The header spans every column, so left/right does nothing while it holds
      // the cursor (it toggles the fold instead — see the keymap).
      if (c.onHeader) {
        return c
      }
      const column = Math.max(0, Math.min(columns.length - 1, c.column + direction))
      // A collapsed column is a single stop with no card — pin the row to 0.
      if (columnCollapsed(column)) {
        return { ...c, column, row: 0 }
      }
      const count = lanes[c.lane]?.columns[column]?.length ?? 0
      return { ...c, column, row: Math.max(0, Math.min(c.row, count - 1)) }
    })
  }

  function moveCursorRow(direction: -1 | 1) {
    setCursor((c) => {
      const positions = columnPositions(c.column)
      const idx = positionIndex(positions, c)
      const next = positions[idx + direction]
      return next ? { ...c, lane: next.lane, row: next.row, onHeader: next.onHeader } : c
    })
  }

  /** `^D`/`^U`: a run of stops at once — clamped, so a short column just lands on its end. */
  function moveCursorRowBy(delta: number) {
    setCursor((c) => {
      const positions = columnPositions(c.column)
      const idx = positionIndex(positions, c)
      const next = positions[Math.max(0, Math.min(positions.length - 1, idx + delta))]
      return next ? { ...c, lane: next.lane, row: next.row, onHeader: next.onHeader } : c
    })
  }

  /** Jump to the top (`gg`) or bottom (`⇧G`) of the current column / list. */
  function jumpEdge(edge: "top" | "bottom") {
    if (view !== "board") {
      setListIndex(edge === "top" ? 0 : Math.max(0, rows.length - 1))
      return
    }
    setCursor((c) => {
      const positions = columnPositions(c.column)
      const pos = edge === "top" ? positions[0] : positions[positions.length - 1]
      return pos ? { ...c, lane: pos.lane, row: pos.row, onHeader: pos.onHeader } : c
    })
  }

  /** Fold the lane under the cursor. Only lanes with a header (parent/type) fold. */
  function foldLane(mode: "toggle" | "open" | "close") {
    const key = lanes[cursor.lane]?.key
    if (key === undefined || !lanes[cursor.lane]?.header) {
      return
    }
    const willClose = mode === "close" || (mode === "toggle" && !collapsed.has(key))
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (mode === "open" || (mode === "toggle" && prev.has(key))) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    // Collapsing hides the lane's cells, so pull the cursor up onto its header.
    if (willClose && !cursor.onHeader) {
      setCursor((c) => ({ ...c, onHeader: true }))
    }
  }

  /**
   * The card under the cursor and the sub-task fold it addresses: its own key when it
   * has children, otherwise its parent's — so `z c` on a sub-task closes the fold you
   * are standing in. The parent has to be a *card* here (in the parent-grouped view it
   * is the lane header instead), which is what `locate` establishes.
   */
  function foldTarget(): { key: string; parent: ReturnType<typeof locate> } | null {
    const card = activeCards[cursor.row]
    // A collapsed column hides its cards (specs/040), so there's nothing to act on there.
    if (cursor.onHeader || columnCollapsed(cursor.column) || !card) {
      return null
    }
    if (card.subtaskCount) {
      return { key: card.task.key, parent: null }
    }
    const parentKey = card.isSubtask ? card.task.parentKey : undefined
    const parent = parentKey ? locate(lanes, parentKey) : null
    return parent && parentKey ? { key: parentKey, parent } : null
  }

  /**
   * Fold the sub-tasks of the card under the cursor (specs/042). With no foldable card
   * — a lane header, an empty cell, a childless card — it falls back to the lane fold,
   * which is all `z a/o/c` did before.
   */
  function foldSubtasks(mode: "toggle" | "open" | "close") {
    const target = foldTarget()
    if (!target) {
      foldLane(mode)
      return
    }
    const willFold = mode === "close" || (mode === "toggle" && !foldedSubtasks.has(target.key))
    setFoldedSubtasks((prev) => {
      const next = new Set(prev)
      if (willFold) {
        next.add(target.key)
      } else {
        next.delete(target.key)
      }
      return next
    })
    // Folding from a sub-task hides the card under the cursor. A parent always precedes
    // its children within a cell, so its pre-fold position is still where it lands.
    if (willFold && target.parent) {
      setCursor({ ...target.parent, onHeader: false })
    }
  }

  /** `z ⇧R` / `z ⇧M` — vim's fold-everything keys, so they take both axes at once. */
  function foldAll(open: boolean) {
    setCollapsed(open ? new Set() : new Set(lanes.flatMap((l) => (l.header ? [l.key] : []))))
    setFoldedSubtasks(
      open
        ? new Set()
        : new Set(
            lanes.flatMap((l) =>
              l.columns.flat().flatMap((c) => (c.subtaskCount ? [c.task.key] : [])),
            ),
          ),
    )
    if (!open && !cursor.onHeader && lanes[cursor.lane]?.header) {
      setCursor((c) => ({ ...c, onHeader: true }))
    } else if (!open) {
      // Sitting on a sub-task that is about to be folded away — ride up to its parent.
      const target = foldTarget()
      if (target?.parent) {
        setCursor({ ...target.parent, onHeader: false })
      }
    }
  }

  /** Toggle the collapse of the column under the cursor (specs/040). */
  function collapseColumn() {
    const id = columns[cursor.column]?.id
    if (id === undefined) {
      return
    }
    setCollapsedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    // The collapsed cell is a single row-0 stop, so drop the cursor onto it.
    setCursor((c) => ({ ...c, row: 0 }))
  }

  function expandAllColumns() {
    setCollapsedColumns(new Set())
  }

  return {
    cursor,
    setCursor,
    collapsed,
    setCollapsed,
    collapsedColumns,
    activeCards,
    focusedKey,
    laneHeader,
    moveCursorColumn,
    moveCursorRow,
    moveCursorRowBy,
    jumpEdge,
    foldLane,
    foldAll,
    foldSubtasks,
    collapseColumn,
    expandAllColumns,
    // The header sits at the lane top, so scrolling reveals it; when the cursor can
    // go no further up/down its column, the scroll snaps to that end.
    atLaneTop: cursor.onHeader || cursor.row === 0,
    atContentTop: cursorIndex <= 0,
    atContentBottom: cursorIndex === columnPositions(cursor.column).length - 1,
  }
}
