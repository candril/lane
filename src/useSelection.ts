import { useEffect, useMemo, useRef, useState } from "react"
import type { Lane, ListRow } from "./grouping"
import type { SelectionScope } from "./selectionScopes"
import type { TabMode } from "./tabs"
import type { Task } from "./types"

interface SelectionArgs {
  view: TabMode
  rows: ListRow[]
  listFocus: number
  tasks: Task[]
  lanes: Lane[]
  /** A tab switch or a filter edit reshuffles the rows, so the visual anchor (a row
   * index) drops; the marks themselves are session-wide and stay. */
  tabId: string
  query: string
  /**
   * The open viewer's items by cursor index — the issue itself at 0, then its links
   * (specs/057) — and where its cursor is. While it is up, marks and the visual range
   * work over these rows instead of the board behind it; the set is the same one.
   */
  detail?: { keys: string[]; focus: number } | null
}

/**
 * Multi-select for the copy actions (specs/055): a persistent set of marked issues
 * (space) plus an optional visual range (⇧V + movement) in the row views. Both are
 * sets of issue keys, not positions — a key survives a refresh, a re-grouping, and
 * a board↔list switch, where an index would land on a different issue.
 *
 * The marks are one set for the whole session: a key marked on one tab is marked on
 * every tab that holds it, and `selection` is simply the marks the current board (or
 * the open viewer) can show. Marks on keys it can't show wait, unseen, for a tab that
 * can — so a copy never carries an issue the current tab doesn't hold.
 */
export function useSelection({
  view,
  rows,
  listFocus,
  tasks,
  lanes,
  tabId,
  query,
  detail,
}: SelectionArgs) {
  const [marked, setMarked] = useState<Set<string>>(new Set())
  // The visual anchor is an index — a row's, or a viewer item's while the viewer is
  // up: the range is whatever sits between it and the cursor *now*, so it tracks j/k
  // without any per-move bookkeeping.
  const [anchor, setAnchor] = useState<number | null>(null)

  // A new tab or an edited filter reshuffles the rows under a row-index anchor.
  useEffect(() => {
    setAnchor(null)
  }, [tabId, query])
  // A row index means nothing on the board grid.
  useEffect(() => {
    if (view === "board") {
      setAnchor(null)
    }
  }, [view])
  // Nor does a viewer index once the viewer shows another issue, or closes.
  const viewerKey = detail?.keys[0] ?? null
  useEffect(() => {
    setAnchor(null)
  }, [viewerKey])

  const selection = useMemo(() => {
    // The viewer can show children the board never loaded (specs/057); a mark on one
    // of those is as real as any other.
    // A viewer stop that is no issue (a section heading) has an empty key.
    const present = new Set([...tasks.map((t) => t.key), ...(detail?.keys ?? []).filter(Boolean)])
    const keys = new Set<string>()
    for (const key of marked) {
      if (present.has(key)) {
        keys.add(key)
      }
    }
    if (anchor != null && detail) {
      const from = Math.min(anchor, detail.focus)
      const to = Math.max(anchor, detail.focus)
      for (let i = from; i <= to && i < detail.keys.length; i++) {
        if (detail.keys[i]) {
          keys.add(detail.keys[i]!)
        }
      }
    } else if (anchor != null && view !== "board") {
      const from = Math.min(anchor, listFocus)
      const to = Math.max(anchor, listFocus)
      for (let i = from; i <= to && i < rows.length; i++) {
        keys.add(rows[i]!.task.key)
      }
    }
    return keys
  }, [marked, anchor, view, rows, listFocus, tasks, detail])

  const toggleMark = (key: string | null) => {
    if (!key) {
      return
    }
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // `selectScope` has to decide against the marks as they are *now*, in the keypress,
  // not inside a state updater — the caller wants to know which ring it took.
  const markedRef = useRef(marked)
  markedRef.current = marked

  /**
   * `^A`: mark the innermost ring around the cursor that isn't fully marked yet, so
   * repeating it widens the selection one ring at a time (specs/055). Returns the
   * ring taken, or null once the outermost is already whole.
   */
  const selectScope = (scopes: SelectionScope[]): SelectionScope | null => {
    const scope =
      scopes.find((s) => s.keys.length > 0 && s.keys.some((key) => !markedRef.current.has(key))) ??
      null
    if (scope) {
      setMarked((prev) => new Set([...prev, ...scope.keys]))
    }
    return scope
  }

  const toggleVisual = () => setAnchor((a) => (a == null ? (detail?.focus ?? listFocus) : null))
  const exitVisual = () => setAnchor(null)
  const clearMarks = () => setMarked(new Set())

  /**
   * The selected keys in display order — a copied list should read like the view
   * does, not like the order the marks happened to be made in. Keys the current
   * view doesn't show (marked in another view, then folded away) trail at the end
   * rather than being dropped: they are still selected.
   */
  const orderedSelection = (): string[] => {
    const ordered: string[] = []
    const push = (key: string) => {
      if (selection.has(key) && !ordered.includes(key)) {
        ordered.push(key)
      }
    }
    // The viewer's rows read top to bottom like any list; marks made elsewhere follow.
    for (const key of detail?.keys ?? []) {
      push(key)
    }
    if (view === "board") {
      for (const lane of lanes) {
        for (const cell of lane.columns) {
          for (const card of cell) {
            push(card.task.key)
          }
        }
      }
    } else {
      for (const row of rows) {
        push(row.task.key)
      }
    }
    for (const key of selection) {
      push(key)
    }
    return ordered
  }

  return {
    selection,
    markedCount: marked.size,
    visualActive: anchor != null,
    toggleMark,
    selectScope,
    toggleVisual,
    exitVisual,
    clearMarks,
    orderedSelection,
  }
}
