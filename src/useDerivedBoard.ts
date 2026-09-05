import { useMemo } from "react"
import { assigneeCandidates } from "./assign"
import { applyFilter, parseQuery, suggestions, type SubtaskScope } from "./filter"
import {
  backlogRows,
  backlogTabTasks,
  buildLanes,
  listRows,
  splitBacklog,
  type Grouping,
  type LaneOptions,
} from "./grouping"
import { columnColor, epicColor } from "./utils/glyphs"
import { theme } from "./theme"
import type { LabelChoice } from "./labels"
import type { PickItem } from "./components/Picker"
import type { TabMode } from "./tabs"
import type { Board as BoardModel } from "./types"

/**
 * Everything the board view is derived from: the filtered task set, the grouped
 * lanes and list rows, and the candidate lists the dialogs draw from. Filtering is
 * a view concern — narrow the tasks first, then group, so lane and column counts
 * reflect the matches (specs/020). The board data itself is untouched.
 */
export function useDerivedBoard(args: {
  board: BoardModel
  query: string
  /** The active tab's mode — decides whether rows come from the board or its backlog. */
  mode: TabMode
  grouping: Grouping
  laneOptions: LaneOptions
  expanded: Set<string>
  filtering: boolean
  suggestIndex: number
  currentUser?: string
  /** Whether a matching issue drags its sub-tasks along (specs/043). */
  subtaskScope?: SubtaskScope
}) {
  const {
    board,
    query,
    mode,
    grouping,
    laneOptions,
    expanded,
    filtering,
    suggestIndex,
    currentUser,
    subtaskScope,
  } = args

  // Backlog statuses are columns too (specs/044), so `status:` filtering and its
  // suggestions must see them — a backlog tab is otherwise unfilterable by status.
  const filterCtx = useMemo(
    () => ({
      columns: [...board.columns, ...(board.backlog ?? [])],
      currentUser,
      subtaskScope,
    }),
    [board.columns, board.backlog, currentUser, subtaskScope],
  )
  const parsedQuery = useMemo(() => parseQuery(query), [query])
  const visibleTasks = useMemo(
    () => applyFilter(board, parsedQuery, filterCtx),
    [board, parsedQuery, filterCtx],
  )
  // The board and its backlog are two halves of one filtered set (specs/044): the
  // board views render one, the backlog tab the other.
  const split = useMemo(
    () => splitBacklog(visibleTasks, board.backlog),
    [visibleTasks, board.backlog],
  )
  const filteredBoard = useMemo<BoardModel>(
    () => ({ columns: board.columns, tasks: split.board, backlog: board.backlog }),
    [board.columns, board.backlog, split.board],
  )

  const lanes = useMemo(
    () => buildLanes(filteredBoard, grouping, laneOptions),
    [filteredBoard, grouping, laneOptions],
  )
  const rows = useMemo(
    () =>
      mode === "backlog"
        ? backlogRows(visibleTasks, board, expanded)
        : listRows(split.board, expanded),
    [mode, visibleTasks, board, split.board, expanded],
  )
  // The backlog tab spans both its segments — the board's first column *and* the
  // backlog statuses — so it counts more than the backlog half of the split.
  const visibleCount =
    mode === "backlog" ? backlogTabTasks(visibleTasks, board).length : split.board.length
  // The filter bar's denominator is this tab's half of the board, not the whole
  // fetched set — "3 / 40" on a 4-issue backlog would be nonsense.
  const totalSplit = useMemo(
    () => splitBacklog(board.tasks, board.backlog),
    [board.tasks, board.backlog],
  )
  const totalCount =
    mode === "backlog" ? backlogTabTasks(board.tasks, board).length : totalSplit.board.length

  const suggestList = useMemo(
    () => (filtering ? suggestions(query, board, filterCtx) : []),
    [filtering, query, board, filterCtx],
  )
  const activeSuggestion = Math.min(suggestIndex, Math.max(0, suggestList.length - 1))

  // Assignee candidates come from the whole board (all known people), not the
  // filtered view, so you can always reassign to anyone already on the board.
  const assignCandidates = useMemo(
    () => assigneeCandidates(board, currentUser),
    [board, currentUser],
  )

  // Known labels across the whole board (not the filtered view), with counts, for
  // the label editor's toggle list (specs/028).
  const knownLabels = useMemo<LabelChoice[]>(() => {
    const counts = new Map<string, number>()
    for (const task of board.tasks) {
      for (const label of task.labels ?? []) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return [...counts].map(([value, count]) => ({ value, count }))
  }, [board])

  // Epics referenced by the board's issues (key + name), for the change-epic picker
  // (specs/038). Deduped by key; the picker prepends a "(no epic)" detach option. The
  // loaded set is the candidate source for now — an epic-source query is a P2 follow-up.
  const epicCandidates = useMemo<PickItem[]>(() => {
    const byKey = new Map<string, string>()
    for (const t of board.tasks) {
      if (t.epicKey && !byKey.has(t.epicKey)) {
        byKey.set(t.epicKey, t.epicName ?? t.epicKey)
      }
    }
    return [...byKey].map(([value, label]) => ({ value, label, color: epicColor(value) }))
  }, [board])

  // Backlog columns join the map so a backlog row shows its status name, not the
  // raw column id (specs/044). They are muted: not being on the board is the point.
  const columnMeta = useMemo(() => {
    const meta = new Map<string, { title: string; color: string }>()
    board.columns.forEach((c, i) =>
      meta.set(c.id, { title: c.title, color: columnColor(i, board.columns.length, c.title) }),
    )
    for (const c of board.backlog ?? []) {
      meta.set(c.id, { title: c.title, color: theme.textDim })
    }
    return meta
  }, [board.columns, board.backlog])

  const doneColumnId = board.columns[board.columns.length - 1]?.id ?? ""

  return {
    filterCtx,
    parsedQuery,
    visibleTasks,
    visibleCount,
    totalCount,
    filteredBoard,
    lanes,
    rows,
    suggestList,
    activeSuggestion,
    assignCandidates,
    knownLabels,
    epicCandidates,
    columnMeta,
    doneColumnId,
  }
}
