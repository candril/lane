/**
 * Main board view.
 *
 * Owns the board snapshot and all view state (grouping, board vs list, cursor).
 * Card moves go through the async provider: apply optimistically, follow the
 * card with the cursor, and revert if the provider rejects — the same path the
 * real Jira transition will take.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useRenderer, useTerminalDimensions } from "@opentui/react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { Shell } from "./components/Shell"
import { Header } from "./components/Header"
import { Board } from "./components/Board"
import { ListView } from "./components/ListView"
import { CreatePrompt } from "./components/CreatePrompt"
import { EditPrompt } from "./components/EditPrompt"
import { Picker } from "./components/Picker"
import { LabelEditor } from "./components/LabelEditor"
import { CommandPalette, type SubmenuView } from "./components/CommandPalette"
import { ShortcutHelp } from "./components/ShortcutHelp"
import { IssueDetail, type DetailLink } from "./components/IssueDetail"
import { TagVisibilityProvider } from "./components/TagVisibility"
import { saveSession, type SessionState } from "./session"
import { FilterBar } from "./components/FilterBar"
import { SearchPrompt, type SearchState } from "./components/SearchPrompt"
import { buildSearchQuery } from "./search"
import { copyToClipboard, openIssueInWindow, openUrl } from "./actions"
import { openIssueEditor } from "./utils/editor"
import {
  buildLanes,
  locate,
  nextStatus,
  type Grouping,
  type HiddenChildren,
  type LaneOptions,
} from "./grouping"
import { rankPlan } from "./rank"
import { columnColor, statusGlyph } from "./utils/glyphs"
import { theme } from "./theme"
import type { PickItem } from "./components/Picker"
import type { ChildVisibility, SubtaskLayout } from "./config/types"
import { currentAssignee, type AssignCandidate } from "./assign"
import {
  applyFilter,
  openField,
  parseQuery,
  replaceLastToken,
  suggestions,
  type SubtaskScope,
} from "./filter"
import { useToast } from "./useToast"
import { useScrollIntoView } from "./useScrollIntoView"
import { useDerivedBoard } from "./useDerivedBoard"
import { useBoardCursor } from "./useBoardCursor"
import { useBoardData } from "./useBoardData"
import { useCreateDraft } from "./useCreateDraft"
import { useJump } from "./useJump"
import { useDialogs } from "./useDialogs"
import { usePalette } from "./usePalette"
import { buildCommands } from "./commands/builder"
import { runCommand, type CommandActions } from "./commands/run"
import type { Command, SubmenuKind } from "./commands/types"
import { useBoardMutations } from "./useBoardMutations"
import { useBoardKeymap } from "./useBoardKeymap"
import { useIssueDetail } from "./useIssueDetail"
import { useSelection } from "./useSelection"
import { historyRows, type DetailHistoryRow } from "./history"
import { boardScopes, rowScopes } from "./selectionScopes"
import { unifiedDiff } from "./utils/unifiedDiff"
import {
  boardTabId,
  cloneOf,
  defaultProjection,
  findSource,
  insertBySource,
  querySource,
  querySourceId,
  readAdHocTabs,
  restoreQuerySources,
  saveAdHocTabs,
  reconcile,
  type BoardSource,
  type Projection,
  type QuerySpec,
  type Tab,
  type TabMode,
} from "./tabs"
import type { Board as BoardModel, Task } from "./types"

interface AppProps {
  /** Every configured board as a source, in tab order (specs/016, specs/044). */
  sources: BoardSource[]
  /** The source active at startup, and its already-loaded board. */
  initialSourceId: string
  initialBoard: BoardModel
  /** True when the initial board is an empty placeholder awaiting the first fetch. */
  initialLoading: boolean
  /** Restored view/filter/grouping session state (specs/033). */
  session?: Partial<SessionState> | null
  /** Background refresh interval in seconds; 0 disables (specs/033). */
  refreshInterval: number
  /** Register a terminal focus-change listener; returns an unregister fn (specs/033). */
  registerFocus?: (cb: (focused: boolean) => void) => () => void
  /** Display name behind `assignee:me` filters, if known. */
  currentUser?: string
  /** Sub-task layout for the flat/type/query views (specs/008); defaults to own-column. */
  subtaskLayout?: SubtaskLayout
  /** Which children the board draws (specs/052); defaults to all. */
  childVisibility?: ChildVisibility
  /** Quick filters: letter → filter query, applied via the `f`+letter chord (specs/036). */
  filters?: Record<string, string>
  /** Initial card-tag visibility from `[display]` (specs/039); default shown. */
  displayEpics?: boolean
  displayLabels?: boolean
  onExit: () => void
}

const BASE_GROUPINGS: Grouping[] = ["none", "parent", "type"]

/** Results per search, and how long a keystroke waits before becoming a query. */
const SEARCH_LIMIT = 12
const SEARCH_DEBOUNCE = 180

// `g`+letter grouping selects (specs/009): `gn` none, `gp` parent, `gt` type, `gs`
// swimlanes, `gr` sprint. Only keys whose grouping is available on the active board
// apply. (`ge` for epic grouping arrives with 034.) Sprint takes `r` because query
// swimlanes already hold `s` — sprint lanes are the scrum board's swimlanes (specs/050),
// but they are a separate grouping, so they need a key of their own.
const GROUPING_KEYS: Record<string, Grouping> = {
  n: "none",
  p: "parent",
  t: "type",
  s: "swimlanes",
  r: "sprint",
}

/**
 * The tabs a config produces: one per board. A backlog is a *mode* any tab can take
 * (`v k`, specs/044), so a permanent backlog view is a saved tab you make yourself
 * (specs/045) rather than one lane invents per board.
 */
function initialTabs(
  sources: BoardSource[],
  saved: Tab[],
  session?: Partial<SessionState> | null,
): Tab[] {
  const configTabs = sources
    .filter((source) => !source.query)
    .map((source) => {
      const id = boardTabId(source.id)
      const restored = session?.projections?.[id]
      return {
        id,
        name: source.name,
        sourceId: source.id,
        projection: restored ? reconcile(restored, source) : defaultProjection(source),
      }
    })
  // Saved tabs (specs/045) carry their own projection, so they don't consult the
  // session. One whose board has left the config is dropped rather than errored — a
  // renamed board shouldn't cost you a launch. A query tab (specs/047) whose origin
  // board is gone drops the same way, since its source could not be rebuilt.
  return saved.reduce((tabs, tab) => {
    const source = sources.find((s) => s.id === tab.sourceId)
    return source
      ? insertBySource(tabs, { ...tab, projection: reconcile(tab.projection, source) })
      : tabs
  }, configTabs)
}

export function App({
  sources: configSources,
  initialSourceId,
  initialBoard,
  initialLoading,
  session,
  refreshInterval,
  registerFocus,
  currentUser,
  subtaskLayout,
  childVisibility,
  filters,
  displayEpics,
  displayLabels,
  onExit,
}: AppProps) {
  const renderer = useRenderer()
  const { toast, showToast } = useToast(renderer)
  // For `^D`/`^U`: half a screen of cursor stops, as in nvim (specs/003).
  const { height: termHeight } = useTerminalDimensions()

  // Lazy, not `useRef(readAdHocTabs())`: a ref's argument is evaluated on every render,
  // and this is a disk read on the render path (nfr/001).
  const [savedTabs] = useState(readAdHocTabs)
  // The config's boards, plus the sources behind any restored query tabs (specs/047).
  // `useBoardData` owns the list from here: a source can be added and switched to in one
  // tick, which only works if the add is visible to the switch immediately.
  const [initialSources] = useState<BoardSource[]>(() => [
    ...configSources,
    ...restoreQuerySources(savedTabs, configSources),
  ])

  // A fetched board can order everything differently, and both cursors are numeric —
  // left alone, a landing refresh puts the cursor on whatever slid into its slot,
  // which is exactly what breaks a ⇧J·⇧J·⇧J reorder run when a background refresh
  // interleaves. So a refresh arms these anchors with the issue under the cursor,
  // and the effects below put the cursor back once the new rows/lanes exist.
  const rowAnchor = useRef<string | null>(null)
  const boardAnchor = useRef<string | null>(null)
  const cursorKeyRef = useRef<string | null>(null)

  const {
    board,
    setBoard,
    sources,
    addSource,
    dropSource,
    activeSourceId,
    source,
    provider,
    refreshing,
    lastRefresh,
    doRefresh,
    settleMutation,
    pendingMutations,
    switchSource,
  } = useBoardData({
    initialSources,
    initialSourceId,
    initialBoard,
    initialLoading,
    refreshInterval,
    registerFocus,
    showToast,
    onFreshBoard: () => {
      const key = cursorKeyRef.current
      if (key) {
        rowAnchor.current = key
        boardAnchor.current = key
      }
    },
  })

  // Tabs and their projections (specs/045): the tab list is App state because tabs
  // outnumber sources — one source can back a board tab, its backlog tab, and any
  // number of clones.
  const [tabs, setTabs] = useState<Tab[]>(() => initialTabs(initialSources, savedTabs, session))
  const [activeTabId, setActiveTabId] = useState<string>(
    () =>
      tabs.find((t) => t.id === session?.activeTabId)?.id ??
      tabs.find((t) => t.sourceId === initialSourceId)!.id,
  )
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!
  const activeIndex = tabs.indexOf(activeTab)
  // Ad-hoc tab ids are a counter, not a timestamp: it only has to be unique among
  // the tabs that exist, and restored ids are already in the list.
  const nextTabId = useRef(tabs.filter((t) => t.adHoc).length + 1)

  const swimlanes = source.swimlanes
  // Sprint lanes are offered by the *data*, not by config (specs/050): a board is scrum
  // exactly when its issues carry sprints, so there is no board type to declare.
  const hasSprints = useMemo(() => board.tasks.some((t) => t.sprint), [board.tasks])
  // `g` cycles the base groupings, plus query-swimlanes when the board defines them and
  // sprint lanes when its issues have sprints.
  const groupings = useMemo<Grouping[]>(
    () => [
      ...BASE_GROUPINGS,
      ...(swimlanes && swimlanes.length > 0 ? (["swimlanes"] as const) : []),
      ...(hasSprints ? (["sprint"] as const) : []),
    ],
    [swimlanes, hasSprints],
  )
  // Sub-task folds (specs/042) live here rather than in the cursor hook: they are an
  // input to `buildLanes`, which runs before the cursor exists.
  const [foldedSubtasks, setFoldedSubtasks] = useState<Set<string>>(new Set())
  // The sub-task layout is the tab's, like the tag toggles (specs/051): one tab can read
  // a query by basket while a clone of it stays a checklist. Unset → the `[display]`
  // default. Read here rather than beside its setter, since `buildLanes` needs it and
  // that runs before the projection helpers exist.
  const subtasks = activeTab.projection.subtasks ?? subtaskLayout ?? "own-column"
  const children = activeTab.projection.children ?? childVisibility ?? "all"
  const laneOptions = useMemo<LaneOptions>(
    () => ({ swimlanes, currentUser, subtaskLayout: subtasks, children, foldedSubtasks }),
    [swimlanes, currentUser, subtasks, children, foldedSubtasks],
  )
  // The active tab's projection *is* the view state: mode, filter and grouping live
  // per tab (specs/045), so switching tabs swaps all three and switching back
  // restores them. The setters keep their plain useState signatures so the hooks and
  // the keymap below need not know a tab is involved.
  const { mode: view, query, grouping } = activeTab.projection
  const updateProjection = useCallback(
    (patch: (previous: Projection) => Partial<Projection>) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, projection: { ...tab.projection, ...patch(tab.projection) } }
            : tab,
        ),
      )
    },
    [activeTabId],
  )
  const setGrouping = useCallback<Dispatch<SetStateAction<Grouping>>>(
    (value) =>
      updateProjection((p) => ({
        grouping: typeof value === "function" ? value(p.grouping) : value,
      })),
    [updateProjection],
  )
  // A sprint board's backlog needs no `backlog_statuses`: its sections are the sprints
  // and the work none of them claimed (specs/050), which the loaded issues already say.
  const hasBacklog = !!source.hasBacklog || hasSprints
  const setView = useCallback<Dispatch<SetStateAction<TabMode>>>(
    (value) => {
      updateProjection((p) => {
        const mode = typeof value === "function" ? value(p.mode) : value
        // Backlog mode on a board with no backlog statuses would render an empty
        // tab with no hint why, so it simply doesn't apply (specs/044).
        return mode === "backlog" && !hasBacklog ? {} : { mode }
      })
    },
    [updateProjection, hasBacklog],
  )
  const setQuery = useCallback<Dispatch<SetStateAction<string>>>(
    (value) =>
      updateProjection((p) => ({ query: typeof value === "function" ? value(p.query) : value })),
    [updateProjection],
  )
  const [listIndex, setListIndex] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // The instance's resolutions (specs/053), fetched on first use and kept for the
  // session — workflow configuration, not board data, so a refresh doesn't touch it.
  const [resolutions, setResolutions] = useState<string[]>([])
  const {
    editing,
    setEditing,
    assigning,
    setAssigning,
    labeling,
    setLabeling,
    epicing,
    setEpicing,
    statusing,
    setStatusing,
    resolving,
    setResolving,
    namingTab,
    setNamingTab,
    filtering,
    setFiltering,
    showHelp,
    setShowHelp,
  } = useDialogs()
  // Card-tag visibility (specs/039) belongs to the tab (specs/045): a backlog read down
  // the epic wants the column a board doesn't. Unset on a tab → the `[display]` default.
  const showEpics = activeTab.projection.epics ?? displayEpics ?? true
  const showLabels = activeTab.projection.labels ?? displayLabels ?? true
  const setShowEpics = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) =>
      updateProjection((p) => ({
        epics: typeof value === "function" ? value(p.epics ?? displayEpics ?? true) : value,
      })),
    [updateProjection, displayEpics],
  )
  const setShowLabels = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) =>
      updateProjection((p) => ({
        labels: typeof value === "function" ? value(p.labels ?? displayLabels ?? true) : value,
      })),
    [updateProjection, displayLabels],
  )
  const setSubtaskLayout = useCallback(
    (next: SubtaskLayout) => updateProjection(() => ({ subtasks: next })),
    [updateProjection],
  )
  const setChildVisibility = useCallback(
    (next: ChildVisibility) => updateProjection(() => ({ children: next })),
    [updateProjection],
  )
  // How the filter treats sub-tasks (specs/043), flipped with ⇧F.
  const [subtaskScope, setSubtaskScope] = useState<SubtaskScope>(
    session?.subtaskScope === "inherit" ? "inherit" : "strict",
  )
  const tagVisibility = useMemo(
    () => ({ epics: showEpics, labels: showLabels }),
    [showEpics, showLabels],
  )
  const [suggestIndex, setSuggestIndex] = useState(0)

  // Persist session state (debounced) so the next launch restores where you left off
  // (specs/033). Cursor is intentionally omitted — it starts at the top.
  useEffect(() => {
    saveSession({
      activeTabId,
      projections: Object.fromEntries(tabs.map((t) => [t.id, t.projection])),
      subtaskScope,
    })
  }, [activeTabId, tabs, subtaskScope])

  const {
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
  } = useDerivedBoard({
    board,
    query,
    mode: view,
    grouping,
    laneOptions,
    expanded,
    filtering,
    suggestIndex,
    currentUser,
    subtaskScope,
  })

  const {
    cursor,
    setCursor,
    collapsed,
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
    atLaneTop,
    atContentTop,
    atContentBottom,
  } = useBoardCursor({
    lanes,
    columns: board.columns,
    rows,
    view,
    query,
    setListIndex,
    foldedSubtasks,
    setFoldedSubtasks,
  })

  const { focusedRef, laneRef: activeLaneRef } = useScrollIntoView({
    renderer,
    view,
    atLaneTop,
    atContentTop,
    atContentBottom,
    deps: [
      cursor,
      view,
      grouping,
      board,
      expanded,
      collapsed,
      collapsedColumns,
      foldedSubtasks,
      renderer,
    ],
  })

  const listFocus = Math.min(listIndex, Math.max(0, rows.length - 1))
  // `rowAnchor` is set by a fold, a rank, or a refresh that changes the row set; this
  // effect puts the cursor back on that issue once the new rows exist.
  const anchorRow = (key: string) => {
    rowAnchor.current = key
  }
  useEffect(() => {
    const key = rowAnchor.current
    if (!key) {
      return
    }
    rowAnchor.current = null
    const at = rows.findIndex((r) => r.task.key === key)
    if (at >= 0) {
      setListIndex(at)
    }
  }, [rows])
  // The board-grid counterpart, armed by a refresh (onFreshBoard above).
  useEffect(() => {
    const key = boardAnchor.current
    if (!key) {
      return
    }
    boardAnchor.current = null
    const loc = locate(lanes, key)
    if (loc) {
      setCursor({ ...loc, onHeader: false })
    }
  }, [lanes])
  const {
    detail,
    focus: detailFocus,
    setFocus: setDetailFocus,
    children: fetchedChildren,
    loadChildren,
    close: closeDetail,
    toggle: toggleDetail,
    open: openDetail,
    push: pushDetail,
    back: backDetail,
    load: loadDetail,
    patch: patchDetail,
    refresh: refreshDetail,
  } = useIssueDetail(provider)
  // The viewer's children section folded away (`z a`, specs/057) — per issue, like
  // the history: every issue opens with its children in view, unless the tab is set to
  // draw no children at all (`v n`, specs/052), which starts them folded.
  const [detailChildrenFolded, setDetailChildrenFolded] = useState(children === "none")
  // The history section (specs/058) starts folded on every issue: it is a peek, not
  // a layout preference — one look shouldn't turn every next issue into a changelog.
  const [detailHistoryFolded, setDetailHistoryFolded] = useState(true)
  // Past the cap, the rest of the changelog is one stop away (`… N more`); once
  // revealed it stays revealed — the fold above is how the section gets small again.
  const [detailHistoryAll, setDetailHistoryAll] = useState(false)
  // A text edit from the history, opened as a diff in place of the description.
  const [detailDiff, setDetailDiff] = useState<{ title: string; text: string } | null>(null)
  // The viewer's own filter (`/`, specs/057): it narrows the children and nothing
  // else — the tab's filter stays as it was, so closing the viewer changes nothing
  // behind it. Per issue, like the history fold.
  const [detailQuery, setDetailQuery] = useState("")
  // `v n` folds the section wherever it is set — on the board before the issue is
  // opened, or on the issue itself, where it would otherwise read as a dead key.
  useEffect(() => {
    setDetailChildrenFolded(children === "none")
  }, [detail?.key, children])
  useEffect(() => {
    setDetailHistoryFolded(true)
    setDetailHistoryAll(false)
    setDetailDiff(null)
    setDetailQuery("")
  }, [detail?.key])

  // What the viewer renders around the description: the issue as the board holds it
  // (so a field edit shows up here the moment it lands), falling back to the fetched
  // copy for an issue the board never loaded — an epic, typically (specs/057) — plus
  // the issues it links to.
  const detailTask = detail
    ? (board.tasks.find((t) => t.key === detail.key) ?? detail.task)
    : undefined
  /**
   * The linked issues, in the order the viewer draws them — epic, parent, then the
   * children — each carrying the cursor index that selects it (specs/057). Children
   * are whatever hangs off this issue by *either* link, which is what makes an epic
   * list its stories the same way a story lists its sub-tasks: the same rule
   * `linkOf` uses to build the board's lanes.
   */
  const {
    links: detailLinks,
    childCount: detailChildCount,
    familyCount: detailFamilyCount,
    childKeys: detailChildKeys,
    history: detailHistory,
    historyCount: detailHistoryCount,
    sections: detailSections,
    itemKeys: detailItemKeys,
    hiddenChildren: detailHiddenChildren,
  } = useMemo(() => {
    if (!detailTask) {
      return {
        links: [] as DetailLink[],
        childCount: 0,
        familyCount: 0,
        childKeys: [] as string[],
        history: [] as DetailHistoryRow[],
        historyCount: 0,
        sections: {} as { children?: number; history?: number; more?: number },
        itemKeys: [] as string[],
        hiddenChildren: undefined as HiddenChildren | undefined,
      }
    }
    const of = (
      task: Task | undefined,
      kind: DetailLink["kind"],
      key?: string,
      name?: string,
    ): Omit<DetailLink, "index">[] => {
      const linkKey = task?.key ?? key
      if (!linkKey) {
        return []
      }
      return [
        {
          key: linkKey,
          kind,
          summary: task?.summary ?? name ?? "",
          type: task?.type,
          status: task ? (columnMeta.get(task.columnId)?.title ?? task.status ?? "—") : undefined,
          statusColor: task ? (columnMeta.get(task.columnId)?.color ?? theme.textDim) : undefined,
          statusGlyph: task ? statusGlyph(task.columnId, board.columns) : undefined,
          done: task?.columnId === doneColumnId,
        },
      ]
    }
    const parent = detailTask.parentKey
      ? board.tasks.find((t) => t.key === detailTask.parentKey)
      : undefined
    const epic = detailTask.epicKey
      ? board.tasks.find((t) => t.key === detailTask.epicKey)
      : undefined
    const fromBoard = board.tasks.filter(
      (t) => t.parentKey === detailTask.key || t.epicKey === detailTask.key,
    )
    // The board only holds the children its query matched; the fetched set (the effect
    // below asks for it) fills in the rest, board order first.
    const fetched = fetchedChildren?.key === detailTask.key ? fetchedChildren.tasks : []
    const seen = new Set(fromBoard.map((t) => t.key))
    const family = [...fromBoard, ...fetched.filter((t) => !seen.has(t.key))]
    // The tab's child visibility (specs/052) rules here too: `hide-done` keeps finished
    // children out of the list, and what it withheld is said under it rather than
    // silently missing. `none` folds the section instead of emptying it — the viewer is
    // where you go to walk the children, so a fold you can open beats a dead list.
    const listed =
      children === "hide-done" ? family.filter((t) => t.columnId !== doneColumnId) : family
    // `/` narrows the children in the board's filter language (specs/020) but with
    // the viewer's own query, run over the family alone — so children the board never
    // loaded are judged on their own merits, and the board behind stays as it was.
    const shown = detailQuery
      ? new Set(
          applyFilter({ ...board, tasks: listed }, parseQuery(detailQuery), {
            columns: [...board.columns, ...(board.backlog ?? [])],
            currentUser,
            subtaskScope,
          }).map((t) => t.key),
        )
      : null
    const shownChildren = shown ? listed.filter((t) => shown.has(t.key)) : listed
    // The cursor's path, in drawing order (specs/057): the issue, the links up the
    // tree, then each section's heading and — unfolded — its rows. A heading is a stop
    // of its own, so a folded section can be reached and opened from the keyboard like
    // a collapsed row in the list; folded rows leave the path. `itemKeys` mirrors the
    // path with each stop's issue key ("" where a stop is no issue), which is what the
    // marks and ranges index by.
    const links: DetailLink[] = []
    const itemKeys: string[] = [detailTask.key]
    const sections: { children?: number; history?: number; more?: number } = {}
    const pushLink = (link: Omit<DetailLink, "index">) => {
      links.push({ ...link, index: itemKeys.length })
      itemKeys.push(link.key)
    }
    of(epic, "epic", detailTask.epicKey, detailTask.epicName).forEach(pushLink)
    of(parent, "parent").forEach(pushLink)
    if (family.length > 0) {
      sections.children = itemKeys.length
      itemKeys.push("")
      if (!detailChildrenFolded) {
        shownChildren.flatMap((child) => of(child, "child")).forEach(pushLink)
      }
    }
    const entries = detail?.history ?? []
    let history: DetailHistoryRow[] = []
    if (entries.length > 0) {
      sections.history = itemKeys.length
      itemKeys.push("")
      if (!detailHistoryFolded) {
        history = historyRows(entries, itemKeys.length, detailHistoryAll ? Infinity : undefined)
        history.forEach(() => itemKeys.push(""))
        // The rest is a stop of its own, so it can be reached and opened like a heading.
        if (history.length < entries.length) {
          sections.more = itemKeys.length
          itemKeys.push("")
        }
      }
    }
    return {
      links,
      childCount: shownChildren.length,
      familyCount: family.length,
      childKeys: shownChildren.map((t) => t.key),
      hiddenChildren:
        family.length > shownChildren.length && !detailQuery
          ? { count: family.length - shownChildren.length, done: children === "hide-done" }
          : undefined,
      history,
      historyCount: entries.length,
      sections,
      itemKeys,
    }
  }, [
    detailTask,
    detail?.history,
    fetchedChildren,
    detailChildrenFolded,
    detailHistoryFolded,
    detailHistoryAll,
    board,
    columnMeta,
    doneColumnId,
    children,
    detailQuery,
    currentUser,
    subtaskScope,
  ])

  // The board holds a story's sub-tasks whenever it holds the story (the load follows
  // them up), but not the children of an issue reached from an all-of-Jira search,
  // nor all of an epic's stories — a board query selects by sprint or team, and an
  // epic's stories straddle both. Those two cases fetch (specs/057), cached per issue
  // by the hook; a story the board holds needs nothing.
  const detailKey = detail?.key
  const onBoard = !!detailKey && board.tasks.some((t) => t.key === detailKey)
  // Read at settle time, not through a render's closure: the write that lands may have
  // been fired several renders ago.
  const offBoardDetail = useRef<string | null>(null)
  offBoardDetail.current = detailKey && !onBoard ? detailKey : null
  const fetchChildren = !!detailKey && (!onBoard || detailTask?.type === "epic")
  useEffect(() => {
    if (detailKey && fetchChildren) {
      loadChildren(detailKey)
    }
  }, [detailKey, fetchChildren, loadChildren])

  // The viewer's cursor can outrun its list when a refresh drops a child.
  // Completions for the viewer's filter — board-wide, since a label or a person is
  // worth offering whether or not one of *these* children carries it yet.
  const detailSuggestList = useMemo(
    () =>
      detail && filtering
        ? suggestions(detailQuery, board, {
            columns: [...board.columns, ...(board.backlog ?? [])],
            currentUser,
            subtaskScope,
          })
        : [],
    [detail, filtering, detailQuery, board, currentUser, subtaskScope],
  )
  const detailActiveSuggestion = Math.min(suggestIndex, Math.max(0, detailSuggestList.length - 1))

  const detailItemCount = Math.max(1, detailItemKeys.length)
  const detailIndex = Math.min(detailFocus, detailItemCount - 1)
  const detailSelected = detailLinks.find((link) => link.index === detailIndex) ?? null
  const detailSelectedEntry = detailHistory.find((row) => row.index === detailIndex) ?? null
  const detailSelectedSection =
    detailSections.children === detailIndex
      ? "children"
      : detailSections.history === detailIndex
        ? "history"
        : detailSections.more === detailIndex
          ? "more"
          : null

  // The issue under the cursor, target of every issue action (o/O, y/Y, e, a, #, ⇧E,
  // ⇧S): the focused row in a row view, else a focused card or a focused swimlane
  // header (its parent issue).
  const cursorKey =
    view !== "board"
      ? (rows[listFocus]?.task.key ?? null)
      : cursor.onHeader
        ? laneHeader?.kind === "issue"
          ? laneHeader.task.key
          : null
        : focusedKey
  // While the detail view is open it *is* the selection (specs/007) — and its own
  // cursor decides which issue that is (specs/057): the one on screen, or a linked
  // one picked out below it. Every action keyed off `currentKey` — the field editors
  // above all — targets that without knowing the viewer exists.
  const currentKey = detail ? (detailSelected?.key ?? detail.key) : cursorKey
  useEffect(() => {
    cursorKeyRef.current = cursorKey
  })

  // Multi-select for the copy actions (specs/055): space marks the focused issue,
  // ⇧V anchors a row range, y/⇧Y/⇧U then copy the lot.
  const {
    selection,
    markedCount,
    visualActive,
    toggleMark,
    selectScope,
    toggleVisual,
    exitVisual,
    clearMarks,
    orderedSelection,
  } = useSelection({
    view,
    rows,
    listFocus,
    tasks: board.tasks,
    lanes,
    tabId: activeTabId,
    query,
    detail: detail ? { keys: detailItemKeys, focus: detailIndex } : null,
  })

  const detailScroll = useRef<ScrollBoxRenderable | null>(null)
  /**
   * Scroll the open viewer by lines, by a page, or to an end. A page keeps two lines
   * of overlap so a paragraph split across the fold stays readable; `requestRender`
   * is needed because a scroll is an imperative mutation React does not see.
   */
  function scrollDetail(by: number | "page-up" | "page-down" | "top" | "bottom") {
    const box = detailScroll.current
    if (!box) {
      return
    }
    const page = Math.max(1, box.viewport.height - 2)
    if (by === "top") {
      box.scrollTop = 0
    } else if (by === "bottom") {
      box.scrollTop = box.scrollHeight
    } else {
      box.scrollBy(by === "page-up" ? -page : by === "page-down" ? page : by)
    }
    renderer.requestRender()
  }

  // Persist the user's own tabs whenever they change (specs/045). Config tabs are the
  // config's; only the ad-hoc ones are ours to save.
  useEffect(() => {
    saveAdHocTabs(tabs.filter((t) => t.adHoc))
  }, [tabs])

  // Startup picks the boot source from the config alone, so a restored *query* tab
  // (specs/047) lands with someone else's board under it. Adopt its source once.
  useEffect(() => {
    if (activeTab.sourceId !== activeSourceId) {
      switchSource(activeTab.sourceId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Global search (specs/046). The results come from the network, so App owns the
  // state: a request counter drops a slow early answer that lands after a fast late
  // one, and the debounce keeps a keystroke from becoming a query.
  const [search, setSearch] = useState<SearchState | null>(null)
  const searchRun = useRef(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scopeLabel = source.searchScope ? source.name : undefined
  // What the grammar resolves values against (specs/048): statuses through the board's
  // columns, people through the accountIds its issues carry, epics through their names.
  const translateContext = { board, currentUser, epicField: source.epicField }
  /**
   * Completions for the search prompt — the same ones `/` offers (specs/048), but only
   * once a field token is open. A bare word must not replace the result list just because
   * it happens to fuzzy match a field name; free text is the common case here.
   */
  const searchSuggestions = useMemo(
    () =>
      search && openField(search.query)
        ? suggestions(search.query, board, { columns: board.columns, currentUser })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search?.query, board, currentUser],
  )

  function runSearch(query: string, scoped: boolean, immediate = false) {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current)
    }
    const built = buildSearchQuery(query, {
      scope: scoped && source.searchScope ? { jql: source.searchScope, label: source.name } : null,
      project: source.project,
      ...translateContext,
    })
    if (!built || built.jql === "" || !provider.searchIssues) {
      setSearch((s) =>
        s
          ? {
              ...s,
              results: [],
              index: 0,
              loading: false,
              error: undefined,
              unresolved: built?.unresolved,
            }
          : s,
      )
      return
    }
    // Half-typed JQL is a syntax error, so running it on every keystroke would show
    // nothing but complaints about the query you are still writing (specs/046). Words
    // and keys stay live; JQL waits for ↵.
    if (built.kind === "jql" && !immediate) {
      setSearch((s) =>
        s ? { ...s, results: [], loading: false, error: undefined, pending: true } : s,
      )
      return
    }
    const run = ++searchRun.current
    setSearch((s) =>
      s
        ? {
            ...s,
            loading: true,
            error: undefined,
            pending: false,
            unresolved: built.unresolved,
          }
        : s,
    )
    searchTimer.current = setTimeout(
      () => {
        void (async () => {
          try {
            const results = await provider.searchIssues!(built.jql, SEARCH_LIMIT)
            if (run === searchRun.current) {
              setSearch((s) => (s ? { ...s, results, index: 0, loading: false } : s))
            }
          } catch (err) {
            if (run === searchRun.current) {
              const message = err instanceof Error ? err.message : String(err)
              setSearch((s) => (s ? { ...s, results: [], loading: false, error: message } : s))
            }
          }
        })()
      },
      immediate ? 0 : SEARCH_DEBOUNCE,
    )
  }

  function startSearch() {
    setSearch({ query: "", results: [], index: 0, scoped: true, loading: false })
  }

  function setSearchQuery(query: string) {
    setSearch((s) => (s ? { ...s, query, suggestIndex: 0 } : s))
    runSearch(query, search?.scoped ?? true)
  }

  function moveSearchSuggestion(direction: -1 | 1) {
    setSearch((s) =>
      s
        ? {
            ...s,
            suggestIndex: Math.max(
              0,
              Math.min(searchSuggestions.length - 1, (s.suggestIndex ?? 0) + direction),
            ),
          }
        : s,
    )
  }

  /** Fill the highlighted completion into the prompt, as `/`'s Tab does (specs/048). */
  function acceptSearchSuggestion() {
    const chosen = searchSuggestions[search?.suggestIndex ?? 0]
    if (!search || !chosen) {
      return
    }
    setSearchQuery(`${replaceLastToken(search.query, chosen.insert)} `)
  }

  /**
   * Keep the running search as a tab (specs/047). The stored JQL is the one that
   * produced the results on screen — scope included — so the tab holds exactly what you
   * were looking at. A query source is shared by hash, so keeping the same search twice
   * adds a tab, not a second fetch.
   */
  function keepSearchAsTab() {
    const built = search
      ? buildSearchQuery(search.query, {
          scope:
            search.scoped && source.searchScope
              ? { jql: source.searchScope, label: source.name }
              : null,
          project: source.project,
          ...translateContext,
        })
      : null
    if (!search || !built) {
      return
    }
    // Searching from a query tab must still root the new source in a *config* board:
    // that is the id restore can resolve next launch, and the credentials underneath.
    const originId = activeTab.source?.originSourceId ?? activeTab.sourceId
    const origin = findSource(sources, originId) ?? source
    const name = search.query.trim() || built.jql
    const spec: QuerySpec = {
      kind: "query",
      jql: built.jql,
      originSourceId: origin.id,
      columnOrder: board.columns.map((c) => c.title),
    }
    const target = findSource(sources, querySourceId(built.jql)) ?? querySource(origin, spec, name)
    addSource(target)
    const id = `adhoc:${nextTabId.current++}:${target.id}`
    setSearch(null)
    setTabs((prev) =>
      insertBySource(prev, {
        id,
        name,
        sourceId: target.id,
        projection: defaultProjection(target),
        adHoc: true,
        source: spec,
      }),
    )
    setActiveTabId(id)
    setCursor({ lane: 0, column: 0, row: 0, onHeader: true })
    setListIndex(0)
    switchSource(target.id)
    setNamingTab({ id, current: name })
  }

  /** Flip between the board's configured scope and the whole instance (specs/046). */
  function toggleSearchScope() {
    if (!search) {
      return
    }
    const scoped = !search.scoped
    setSearch({ ...search, scoped })
    runSearch(search.query, scoped)
  }

  function moveSearchCursor(direction: -1 | 1) {
    setSearch((s) =>
      s ? { ...s, index: Math.max(0, Math.min(s.results.length - 1, s.index + direction)) } : s,
    )
  }

  /**
   * Open the highlighted result in the viewer (specs/046) — always, whether or not this
   * tab holds the issue: you searched for it to read it, and a search that sometimes
   * answers with a moved cursor and sometimes with the issue is a coin toss. Where the
   * tab does hold it the cursor follows too, so closing the viewer lands on its card
   * rather than back where the search started. Off-board issues are fetched first
   * (specs/057); the browser stays one keystroke away as ^O.
   */
  function submitSearch() {
    // ↵ on a query waiting to run (JQL) runs it; ↵ on a result opens it.
    if (search?.pending) {
      runSearch(search.query, search.scoped, true)
      return
    }
    const chosen = search?.results[search.index]
    setSearch(null)
    if (!chosen) {
      return
    }
    const at = rows.findIndex((r) => r.task.key === chosen.key)
    if (at >= 0) {
      setListIndex(at)
    }
    const loc = locate(lanes, chosen.key)
    if (loc) {
      setCursor({ ...loc, onHeader: false })
    }
    whenLoaded(chosen.key, () => openDetail(chosen.key))
  }

  /**
   * Clone the active tab into a new one beside it, seeded with its projection — the
   * current filter included, since narrowing the board and then keeping it is the
   * whole point (specs/045). Opens the name prompt straight away, defaulted to the
   * filter query so the common case is one Enter.
   */
  function cloneTab() {
    // The id ends in the source id so startup can tell which board to warm the cache
    // for from the restored active tab alone, before the tab list is built.
    const id = `adhoc:${nextTabId.current++}:${activeTab.sourceId}`
    const suggested = activeTab.projection.query.trim() || `${activeTab.name} copy`
    setTabs((prev) => insertBySource(prev, cloneOf(activeTab, suggested, id)))
    setActiveTabId(id)
    setNamingTab({ id, current: suggested })
  }

  /** Rename an ad-hoc tab; config tabs are named by the config. */
  function renameTab() {
    if (!activeTab.adHoc) {
      return
    }
    setNamingTab({ id: activeTab.id, current: activeTab.name })
  }

  function submitTabName(name: string) {
    const target = namingTab?.id
    setNamingTab(null)
    const trimmed = name.trim()
    if (!target || trimmed === "") {
      return
    }
    setTabs((prev) => prev.map((t) => (t.id === target ? { ...t, name: trimmed } : t)))
  }

  /** Close an ad-hoc tab, falling back to its neighbour. Config tabs stay. */
  function closeTab() {
    if (!activeTab.adHoc) {
      return
    }
    const index = tabs.indexOf(activeTab)
    const neighbor = tabs[index - 1] ?? tabs[index + 1]
    const remaining = tabs.filter((t) => t.id !== activeTab.id)
    setTabs(remaining)
    // A query source exists only for its tabs (specs/047), unlike a config board, which
    // exists because the file says so — so drop it once the last tab over it is gone.
    if (source.query && !remaining.some((t) => t.sourceId === activeTab.sourceId)) {
      dropSource(activeTab.sourceId)
    }
    if (neighbor) {
      setActiveTabId(neighbor.id)
      setCursor({ lane: 0, column: 0, row: 0, onHeader: true })
      setListIndex(0)
      if (neighbor.sourceId !== activeSourceId) {
        switchSource(neighbor.sourceId)
      }
    }
    showToast(`closed ${activeTab.name}`)
  }

  /**
   * Switch tabs: adopt the target tab's projection (it carries its own mode, filter
   * and grouping) and reset the cursor, since lane/column layout differs per tab.
   * Tabs sharing a source keep the loaded board — only a different source refetches.
   */
  function switchTab(index: number) {
    const tab = tabs[index]
    if (!tab || tab.id === activeTabId) {
      return
    }
    setActiveTabId(tab.id)
    setCursor({ lane: 0, column: 0, row: 0, onHeader: true })
    setListIndex(0)
    if (tab.sourceId !== activeSourceId) {
      switchSource(tab.sourceId)
    }
  }

  const {
    moveTo,
    setStatusByName,
    submitResolution,
    transition,
    applyRank,
    submitEpic,
    submitLabels,
    submitAssign,
    submitEdit,
    submitIssueEdit,
    bulkMoveTo,
    bulkResolution,
    bulkAssign,
    bulkSetEpic,
    bulkSetLabels,
  } = useBoardMutations({
    board,
    setBoard,
    provider,
    pendingMutations,
    settleMutation: settleWrite,
    showToast,
    editing,
    setEditing,
  })

  /**
   * Every write settles through here so a field edit against an issue the board does
   * not hold still shows (specs/057): its optimistic update ran over board state,
   * which has no copy of that issue, leaving the viewer on the values it was fetched
   * with. Re-reading it also picks up what the server did beyond the field written —
   * a resolution the workflow attached, the new changelog entry.
   */
  function settleWrite() {
    settleMutation()
    const key = offBoardDetail.current
    if (key) {
      refreshDetail(key)
    }
  }

  function moveFocusedCard(direction: -1 | 1) {
    if (!focusedKey) {
      return
    }
    void transition(focusedKey, direction, (next) => {
      const loc = locate(buildLanes(next, grouping, laneOptions), focusedKey)
      if (loc) {
        setCursor({ ...loc, onHeader: false })
      }
    })
  }

  /**
   * Reorder the focused board card — or the marked block (specs/056) — within its
   * column, against the adjacent card.
   *
   * The anchor is the nearest card at the same hierarchy level that is not itself
   * moving. A parent nests its sub-tasks beneath it (checklist/under-parent layout),
   * so the adjacent cell is often another parent's sub-task; a sub-task's neighbour
   * past the end of its family is the next parent card, or — in `own-column` — any
   * unrelated issue sharing that status. Ranking against either moves the issue to
   * wherever *that* one sits in the global order, which among siblings is arbitrary:
   * ⇧J on the last sub-task used to fling it back up the list.
   */
  function rankFocusedCard(direction: -1 | 1) {
    const focused = activeCards[cursor.row]
    if (!focused || !focusedKey || !provider.rankTask) {
      return
    }
    const plan = rankPlan(activeCards, cursor.row, direction, {
      key: (card) => card.task.key,
      sibling: (card, cursorCard) =>
        cursorCard.isSubtask
          ? card.isSubtask && card.task.parentKey === cursorCard.task.parentKey
          : !card.isSubtask,
      marked: (card) => selection.has(card.task.key),
    })
    if (!plan) {
      return
    }
    // Rank is a column's order, so a mark in another column or at another level has no
    // place in this move — say so rather than leaving it looking half-applied.
    if (selection.size > plan.keys.length) {
      showToast(`${plan.keys.length} ranked · ${selection.size - plan.keys.length} elsewhere`)
    }
    // Follow the moved card by locating where it actually lands (like the column
    // move) — `row + direction` is wrong once buildLanes regroups, so the cursor
    // would strand on a sibling and the next reorder would grab the wrong card.
    void applyRank(plan.keys, plan.neighbor.task.key, direction, (next) => {
      const loc = locate(buildLanes(next, grouping, laneOptions), focusedKey)
      if (loc) {
        setCursor({ ...loc, onHeader: false })
      }
    })
  }

  const {
    creating,
    setCreating,
    startCreate: beginCreate,
    cycleCreateType,
    submitCreate,
  } = useCreateDraft({
    board,
    view,
    focusedKey,
    laneHeader,
    rows,
    listFocus,
    provider,
    setBoard,
    pendingMutations,
    settleMutation,
  })

  /**
   * Creating in a query tab is refused (specs/047): the issue would be filed into the
   * origin board's project and then vanish on the next refresh, since a new issue rarely
   * matches the query that made the tab. A card that disappears is worse than a key that
   * says no.
   */
  function startCreate(topLevel: boolean) {
    if (source.query) {
      showToast("can't create an issue in a search tab")
      return
    }
    beginCreate(topLevel)
  }

  const { jump, startJump, handleJumpKey } = useJump({
    view,
    lanes,
    rows,
    cursorColumn: cursor.column,
    setCursor,
    setListIndex,
    detail: detail ? { links: detailLinks, setFocus: setDetailFocus } : null,
  })

  /**
   * The issues a field edit targets (specs/056): the whole multi-select when one
   * exists, else the focused issue — the same precedence the copy actions use.
   */
  function editTargets(): string[] {
    if (selection.size > 0) {
      return orderedSelection()
    }
    return currentKey ? [currentKey] : []
  }

  /** `status SHOP-1` for one issue, `status 3 issues` for a bulk edit (specs/056). */
  function editTitle(verb: string, keys: string[], suffix = ""): string {
    const subject = keys.length === 1 ? keys[0]! : `${keys.length} issues`
    return `${verb} ${subject}${suffix}`
  }

  /**
   * The issue behind a key: the board's copy, else the copy the viewer fetched — an
   * issue opened from search, or a child the board's query never matched, is on no
   * board, and the field editors still have to read it to open on its current value
   * (specs/057).
   */
  function taskFor(key: string): Task | undefined {
    return (
      board.tasks.find((t) => t.key === key) ??
      (detail?.task?.key === key ? detail.task : undefined) ??
      fetchedChildren?.tasks.find((t) => t.key === key)
    )
  }

  /** The field value all targeted issues share — a mixed set pre-selects nothing. */
  function sharedCurrent<T>(keys: string[], pick: (task: Task) => T): T | undefined {
    const values = keys.map((key) => {
      const task = taskFor(key)
      return task ? pick(task) : undefined
    })
    return values.every((v) => v === values[0]) ? values[0] : undefined
  }

  /** Labels every targeted issue carries — what a bulk label edit shows and diffs against. */
  function commonLabels(keys: string[]): string[] {
    const [first, ...rest] = keys.map((key) => taskFor(key)?.labels ?? [])
    return (first ?? []).filter((label) => rest.every((labels) => labels.includes(label)))
  }

  /** Open the assignee picker for the focused issue or the selection. */
  function startAssign() {
    const keys = editTargets()
    if (keys.length > 0) {
      setAssigning({ keys })
    }
  }

  /** Open the label editor for the focused issue or the selection (specs/028). */
  function startLabels() {
    const keys = editTargets()
    if (keys.length > 0) {
      setLabeling({ keys })
    }
  }

  /** Open the change-epic picker for the focused issue or the selection (specs/038). */
  function startEpic() {
    const keys = editTargets()
    if (keys.length > 0) {
      setEpicing({ keys })
    }
  }

  /** Open the status picker for the focused issue or the selection (specs/041). */
  function startStatus() {
    const keys = editTargets()
    if (keys.length > 0) {
      setStatusing({ keys })
    }
  }

  /**
   * The reasons a close can carry (specs/053), fetching them the first time they are
   * needed. Both surfaces go through this: an empty list would read as "no reasons
   * exist" rather than "not fetched yet", so neither opens until it resolves.
   */
  async function withResolutions(open: () => void) {
    if (!provider.listResolutions) {
      return
    }
    if (resolutions.length > 0) {
      open()
      return
    }
    try {
      setResolutions(await provider.listResolutions())
      open()
    } catch (err) {
      showToast(`reasons unavailable: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** Open the reason picker for the focused issue or the selection (specs/053). */
  function startResolution() {
    const keys = editTargets()
    if (keys.length === 0) {
      return
    }
    const closing = keys.some(
      (key) => board.tasks.find((t) => t.key === key)?.columnId !== doneColumnId,
    )
    void withResolutions(() => setResolving({ keys, closing }))
  }

  /**
   * Commit the picked reason (specs/053). On an issue that is not yet done this is a
   * close — transition *and* resolution in one write, cursor following the card as any
   * status change does; on one already done it rewrites the reason alone. A bulk pick
   * (specs/056) splits the same way per issue: the open ones close, the done ones are
   * amended.
   */
  function submitReason(keys: string[], chosen: PickItem | null, closing: boolean) {
    if (!chosen?.value) {
      return
    }
    const reason = chosen.value
    if (keys.length > 1) {
      const isDone = (key: string) =>
        board.tasks.find((t) => t.key === key)?.columnId === doneColumnId
      const toClose = keys.filter((key) => !isDone(key))
      const toAmend = keys.filter(isDone)
      if (toClose.length > 0) {
        void bulkMoveTo(toClose, doneColumnId, reason)
      }
      if (toAmend.length > 0) {
        bulkResolution(toAmend, reason)
      }
      return
    }
    const key = keys[0]!
    if (!closing) {
      submitResolution(key, reason)
      return
    }
    void moveTo(
      key,
      doneColumnId,
      (next) => {
        const loc = locate(buildLanes(next, grouping, laneOptions), key)
        if (loc) {
          setCursor({ ...loc, onHeader: false })
        }
      },
      reason,
    )
    showToast(`${key} closed as ${reason}`)
  }

  // Candidates for the status and epic fields, built once and rendered by both
  // surfaces — the bottom-bar picker and the palette's submenu (specs/010).
  const statusItems = useMemo<PickItem[]>(
    () =>
      [...board.columns, ...(board.backlog ?? [])].map((c, i) => ({
        value: c.id,
        label: c.title,
        // Backlog statuses sit past the board's columns, so they fall outside the
        // ramp and read muted — which is what they are (specs/044).
        color: columnColor(i, board.columns.length, c.title),
      })),
    [board.columns, board.backlog],
  )
  const resolutionItems = useMemo<PickItem[]>(
    () => resolutions.map((name) => ({ value: name, label: name })),
    [resolutions],
  )
  const epicItems = useMemo<PickItem[]>(
    () => [{ value: null, label: "(no epic)" }, ...epicCandidates],
    [epicCandidates],
  )

  const palette = usePalette()

  const paletteCommands = useMemo(
    () =>
      buildCommands({
        issueKey: currentKey,
        view,
        grouping,
        hasSwimlanes: groupings.includes("swimlanes"),
        hasSprints: groupings.includes("sprint"),
        showEpics,
        showLabels,
        subtasks,
        children,
        filtered: query !== "",
        subtaskScope,
        canCreate: !source.query,
        canResolve: !!provider.listResolutions,
        issueDone: board.tasks.find((t) => t.key === currentKey)?.columnId === doneColumnId,
        tabCount: tabs.length,
        ownTab: !!activeTab.adHoc,
        selectionCount: selection.size,
      }),
    [
      currentKey,
      selection,
      view,
      grouping,
      groupings,
      showEpics,
      showLabels,
      subtasks,
      children,
      query,
      subtaskScope,
      source.query,
      provider,
      board.tasks,
      doneColumnId,
      tabs.length,
      activeTab.adHoc,
    ],
  )

  /** What a palette command does — every one of these is an existing direct-key action. */
  const commandActions: CommandActions = {
    startStatus,
    startResolution,
    startAssign,
    startLabels,
    startEpic,
    toggleDetail: () => toggleDetail(currentKey),
    startEdit,
    editInEditor,
    openIssue: () => {
      const url = currentKey ? provider.issueUrl?.(currentKey) : undefined
      if (url) {
        openUrl(url)
        showToast(`opened ${currentKey}`)
      }
    },
    openIssueWindow: () => {
      if (currentKey) {
        openIssueInWindow(currentKey)
        showToast(`${currentKey} → new window`)
      }
    },
    copyKey: () => {
      if (selection.size > 0) {
        copySelection("key")
      } else if (currentKey) {
        copyToClipboard(currentKey)
        showToast(`${currentKey} copied`)
      }
    },
    copyUrl: () => {
      if (selection.size > 0) {
        copySelection("url")
        return
      }
      const url = currentKey ? provider.issueUrl?.(currentKey) : undefined
      if (url) {
        copyToClipboard(url)
        showToast(`${currentKey} URL copied`)
      }
    },
    copyTitle: () => (selection.size > 0 ? copySelection("title") : copyTitle()),
    copyDescription,
    startCreate,
    setView,
    setGrouping: (next) => {
      setGrouping(next)
      setCursor({ lane: 0, column: 0, row: 0, onHeader: false })
    },
    toggleEpicTags: () => setShowEpics((on) => !on),
    toggleLabelTags: () => setShowLabels((on) => !on),
    setSubtaskLayout,
    setChildVisibility,
    startFilter: () => setFiltering(true),
    clearFilter: () => setQuery(""),
    toggleSubtaskScope,
    foldAll,
    doRefresh,
    startSearch,
    cloneTab,
    renameTab,
    closeTab,
    stepTab: (direction) => switchTab((activeIndex + direction + tabs.length) % tabs.length),
    showHelp: () => setShowHelp(true),
    quit: onExit,
  }

  /** The candidates behind the open submenu, in the shape the palette renders. */
  const submenuView = useMemo<SubmenuView | null>(() => {
    const sub = palette.submenu
    if (!sub) {
      return null
    }
    switch (sub.kind) {
      case "status":
        return {
          kind: "status",
          title: editTitle("status", sub.keys),
          items: statusItems,
          current: sharedCurrent(sub.keys, (t) => t.columnId),
        }
      case "assign":
        return {
          kind: "assign",
          title: editTitle("assign", sub.keys),
          items: assignCandidates,
          current: sharedCurrent(sub.keys, (t) => currentAssignee(t)),
        }
      case "resolution": {
        const anyOpen = sub.keys.some(
          (key) => board.tasks.find((t) => t.key === key)?.columnId !== doneColumnId,
        )
        return {
          kind: "resolution",
          title: anyOpen ? editTitle("close", sub.keys, " as") : editTitle("reason", sub.keys),
          items: resolutionItems,
          current: sharedCurrent(sub.keys, (t) => t.resolution),
        }
      }
      case "epic":
        return {
          kind: "epic",
          title: editTitle("epic", sub.keys),
          items: epicItems,
          current: sharedCurrent(sub.keys, (t) => t.epicKey) ?? null,
        }
      case "labels":
        return {
          kind: "labels",
          title: editTitle("labels", sub.keys),
          known: knownLabels,
          current: commonLabels(sub.keys),
          selected: sub.selected,
        }
    }
  }, [
    palette.submenu,
    board.tasks,
    statusItems,
    assignCandidates,
    epicItems,
    resolutionItems,
    doneColumnId,
    knownLabels,
  ])

  /** Descend into a field editor inside the palette rather than running an action. */
  function descend(kind: SubmenuKind) {
    const keys = editTargets()
    if (keys.length === 0) {
      return
    }
    const enter = () => palette.descend(kind, keys, kind === "labels" ? commonLabels(keys) : [])
    // The reasons are fetched, not derived from the board, so this descent waits on
    // them where the others can open immediately.
    if (kind === "resolution") {
      void withResolutions(enter)
      return
    }
    enter()
  }

  function runPaletteCommand(command: Command) {
    palette.close()
    runCommand(command.id, commandActions)
  }

  /** Commit a submenu pick through the same write the bottom-bar editor uses. */
  function pickInSubmenu(item: PickItem) {
    const sub = palette.submenu
    if (!sub) {
      return
    }
    palette.close()
    if (sub.kind === "status") {
      submitStatus(sub.keys, item)
    } else if (sub.kind === "resolution") {
      submitReason(
        sub.keys,
        item,
        sub.keys.some((key) => board.tasks.find((t) => t.key === key)?.columnId !== doneColumnId),
      )
    } else if (sub.kind === "epic") {
      submitEpicFor(sub.keys, item)
    } else if (sub.kind === "assign") {
      // The palette hands back the row it rendered; recover the candidate so the
      // accountId resolution (specs/027) still has its sample issue.
      submitAssignFor(
        sub.keys,
        assignCandidates.find((c) => c.value === item.value) ?? null,
        item.label,
      )
    }
  }

  function commitLabelsFromPalette(labels: string[]) {
    const sub = palette.submenu
    if (sub?.kind !== "labels") {
      return
    }
    palette.close()
    submitLabelsFor(sub.keys, labels)
  }

  /**
   * Move the targeted issue(s) directly to the picked status (column), optimistically —
   * the same transition path as ⇧H/⇧L but to any column, not just an adjacent one.
   * A single issue is followed with the cursor in board view (list re-slots by index);
   * a bulk move (specs/056) leaves the cursor where it is.
   */
  function submitStatus(keys: string[], chosen: PickItem | null) {
    if (chosen?.value == null) {
      return
    }
    if (keys.length > 1) {
      void bulkMoveTo(keys, chosen.value)
      return
    }
    const key = keys[0]!
    // An issue the board doesn't hold has no card to move, and its status may not even
    // be one of these columns — transition it by name instead (specs/057).
    if (!board.tasks.some((t) => t.key === key)) {
      void setStatusByName(key, chosen.label)
      return
    }
    void moveTo(key, chosen.value, (next) => {
      const loc = locate(buildLanes(next, grouping, laneOptions), key)
      if (loc) {
        setCursor({ ...loc, onHeader: false })
      }
    })
  }

  /** Route an assign pick to the single or bulk write (specs/056). */
  function submitAssignFor(keys: string[], chosen: AssignCandidate | null, typed: string) {
    if (keys.length > 1) {
      bulkAssign(keys, chosen, typed)
    } else if (keys[0]) {
      submitAssign(keys[0], chosen, typed)
    }
  }

  /** Route an epic pick to the single or bulk write (specs/056). */
  function submitEpicFor(keys: string[], chosen: PickItem | null) {
    if (keys.length > 1) {
      bulkSetEpic(keys, chosen)
    } else if (keys[0]) {
      submitEpic(keys[0], chosen)
    }
  }

  /**
   * Commit an edited label set (specs/056). A single issue takes the set verbatim; a
   * bulk edit only ever saw the labels the issues share, so the submitted set is
   * turned into a diff against that base — what was added and what was struck — and
   * each issue keeps the rest of its own labels.
   */
  function submitLabelsFor(keys: string[], labels: string[]) {
    if (keys.length === 1) {
      submitLabels(keys[0]!, labels)
      return
    }
    const base = commonLabels(keys)
    const add = labels.filter((l) => !base.includes(l))
    const remove = base.filter((l) => !labels.includes(l))
    bulkSetLabels(keys, add, remove)
  }

  /**
   * Hand the focused issue's summary and description to `$EDITOR` (specs/049). The
   * description is fetched first — `i` works from a card, where nothing has been loaded
   * — and a description that cannot survive the ADF round trip is shown as context
   * rather than offered for editing, so a save can't flatten it.
   */
  function editInEditor() {
    const key = currentKey
    const task = key ? board.tasks.find((t) => t.key === key) : undefined
    if (!key || !task) {
      return
    }
    void (async () => {
      const loaded = await loadDetail(key).catch((err: unknown) => {
        showToast(`${key} not loaded: ${err instanceof Error ? err.message : String(err)}`)
        return null
      })
      const description = loaded?.description ?? ""
      const readOnly = !!loaded?.unsupported?.length
      const status = columnMeta.get(task.columnId)?.title ?? task.status ?? "—"
      const edited = await openIssueEditor(renderer, {
        summary: task.summary,
        description,
        descriptionReadOnly: readOnly || !provider.editDescription,
        context: [
          `${task.key} · ${task.type} · ${status} · ${task.assignee ?? "unassigned"}`,
          ...(task.labels?.length ? [`labels: ${task.labels.join(", ")}`] : []),
          ...(task.epicName || task.epicKey ? [`epic: ${task.epicName ?? task.epicKey}`] : []),
          ...(readOnly
            ? [
                "",
                `The description holds ${loaded!.unsupported!.join(", ")}, which lane cannot`,
                "write back without losing it — so it is shown here, not edited.",
                "",
                ...description.split("\n"),
              ]
            : []),
        ],
      })
      if (!edited) {
        return
      }
      const stored = await submitIssueEdit(key, edited, { summary: task.summary, description })
      if (stored !== null) {
        patchDetail(key, stored)
      }
    })()
  }

  /**
   * Copy the description as the Markdown the provider already converted (specs/054).
   * From a card nothing has been fetched yet, so it goes through the same cached
   * per-issue load as the `$EDITOR` hand-off; from the open viewer that is a cache hit.
   */
  function copyDescription() {
    const key = currentKey
    if (!key) {
      return
    }
    void (async () => {
      const loaded = await loadDetail(key).catch((err: unknown) => {
        showToast(`${key} not loaded: ${err instanceof Error ? err.message : String(err)}`)
        return null
      })
      const description = loaded?.description
      if (!description?.trim()) {
        if (loaded !== null) {
          showToast(`${key} has no description`)
        }
        return
      }
      copyToClipboard(description)
      showToast(`${key} description copied`)
    })()
  }

  /** Copy the focused issue's title as `KEY summary` (specs/054) — a pasteable reference. */
  function copyTitle() {
    const task = currentKey ? board.tasks.find((t) => t.key === currentKey) : undefined
    if (!task) {
      return
    }
    copyToClipboard(`${task.key} ${task.summary}`)
    showToast(`${task.key} title copied`)
  }

  /** Copy every selected issue's key, URL, or title as one newline-separated block (specs/055). */
  function copySelection(kind: "key" | "url" | "title") {
    const keys = orderedSelection()
    const values =
      kind === "key"
        ? keys
        : kind === "url"
          ? keys.map((k) => provider.issueUrl?.(k)).filter((u): u is string => !!u)
          : keys.flatMap((k) => {
              const task = board.tasks.find((t) => t.key === k)
              return task ? [`${task.key} ${task.summary}`] : []
            })
    if (values.length === 0) {
      return
    }
    copyToClipboard(values.join("\n"))
    const noun = kind === "key" ? "key" : kind === "url" ? "URL" : "title"
    showToast(`${values.length} ${noun}${values.length === 1 ? "" : "s"} copied`)
    // The copy is what the range was extended for; the marks may still feed another
    // copy (keys now, URLs next), so only the visual range ends here.
    exitVisual()
  }

  /**
   * `^A`: mark the ring around the cursor (specs/055) — the innermost not yet whole,
   * so each press widens: siblings, then the cell, the lane, the board; in a row view
   * siblings or roots, then every row; in the viewer the children, and no further —
   * the epic or parent above is a link up the tree, not a member of the family.
   */
  function expandSelection() {
    const scopes = detail
      ? [{ name: "children", keys: detailChildKeys }]
      : view !== "board"
        ? rowScopes(rows, listFocus)
        : boardScopes(lanes, cursor)
    const scope = selectScope(scopes)
    if (scope) {
      showToast(`${scope.name} · ${scope.keys.length} marked`)
    }
  }

  /** The section the viewer's cursor is in — its heading or a row of it; the children by default. */
  function detailSectionAt(index: number): "children" | "history" {
    const history = detailSections.history
    return history !== undefined && index >= history ? "history" : "children"
  }

  /**
   * `z a/o/c`, `l`/`h` and ↵ on a heading, in the viewer: fold the section under the
   * cursor (specs/057) — the list view's tree disclosure, one level up. Closing from
   * inside lands the cursor on the heading, since the rows leave the path.
   */
  function foldDetailSection(
    mode: "toggle" | "open" | "close",
    which: "children" | "history" = detailSectionAt(detailIndex),
  ) {
    // `l` on `… N more` opens what it hides, like `l` on a heading.
    if (mode !== "close" && detailSelectedSection === "more") {
      setDetailHistoryAll(true)
      return
    }
    const setFolded = which === "history" ? setDetailHistoryFolded : setDetailChildrenFolded
    setFolded((folded) => (mode === "toggle" ? !folded : mode === "close"))
    const heading = detailSections[which]
    if (mode !== "open" && heading !== undefined && detailIndex > heading) {
      setDetailFocus(heading)
    }
  }

  /** `z h` in the viewer: fold its history section from anywhere (specs/058). */
  function foldDetailHistory(mode: "toggle" | "open" | "close") {
    foldDetailSection(mode, "history")
  }

  /**
   * `^D`/`^U`: half a screen of cursor stops, as in nvim — rows in a row view, the
   * column's stops on the board. The screen height stands in for the list's: close
   * enough, and it is what a reader's eye measures a page by anyway.
   */
  function movePage(direction: -1 | 1) {
    const step = Math.max(1, Math.floor((termHeight - 4) / 2)) * direction
    if (view !== "board") {
      setListIndex((i) => Math.max(0, Math.min(rows.length - 1, i + step)))
    } else {
      moveCursorRowBy(step)
    }
  }

  /** `gg`/`⇧G` in the viewer: its first stop — the issue — or its last (specs/057). */
  function jumpDetailEdge(edge: "top" | "bottom") {
    setDetailFocus(edge === "top" ? 0 : detailItemCount - 1)
  }

  /** Walk the viewer's items: the issue itself, then each issue it links to (specs/057). */
  function moveDetailFocus(direction: -1 | 1) {
    setDetailFocus(Math.max(0, Math.min(detailItemCount - 1, detailIndex + direction)))
  }

  /**
   * ↵ in the viewer follows the selected link, so an epic walks down to its stories
   * and a story to its sub-tasks (specs/057). On the issue itself there is nothing to
   * follow, so it closes — the same key that opened it.
   */
  function openDetailItem() {
    // ↵ on `… N more` reveals the rest of the history (specs/058); the cursor stays
    // where it is, which is now the first row it revealed.
    if (detailSelectedSection === "more") {
      setDetailHistoryAll(true)
      return
    }
    // ↵ on a section heading folds it, like ↵ on a list row (specs/057).
    if (detailSelectedSection) {
      foldDetailSection("toggle", detailSelectedSection)
      return
    }
    // A history row opens its edit as a diff (specs/058); a row without one is
    // read-only, so ↵ does nothing there rather than closing the viewer underfoot.
    if (detailSelectedEntry) {
      const edit = detailSelectedEntry.diff
      if (edit) {
        setDetailDiff({
          title: `${edit.field} · ${detailSelectedEntry.when} · ${detailSelectedEntry.author}`,
          text: unifiedDiff(edit.from, edit.to, edit.field),
        })
      }
      return
    }
    if (!detailSelected) {
      closeDetail()
      return
    }
    const key = detailSelected.key
    whenLoaded(key, () => pushDetail(key))
  }

  /**
   * Run `then` once `key` can be shown in the viewer: at once for an issue the board
   * holds, else after fetching it (specs/057) — an epic above a story, typically,
   * since a board query selects stories. Fetching *first* keeps the viewer from
   * blinking out to the board while the request is in flight, because `show` then
   * renders from the cache on arrival.
   */
  function whenLoaded(key: string, then: () => void) {
    if (board.tasks.some((t) => t.key === key)) {
      then()
      return
    }
    if (!provider.loadIssue) {
      showToast(`${key} is not on this board, and this source can't fetch it`)
      return
    }
    void (async () => {
      const loaded = await loadDetail(key).catch((err: unknown) => {
        showToast(`${key} not loaded: ${err instanceof Error ? err.message : String(err)}`)
        return null
      })
      if (loaded) {
        then()
      }
    })()
  }

  /**
   * Reorder the selected child against its siblings (specs/057) — the viewer's ⇧J/⇧K,
   * mirroring the row views. Only children rank: an epic or parent link is a pointer
   * up the tree, where "next" means nothing.
   */
  function rankDetailChild(direction: -1 | 1) {
    if (detailSelected?.kind !== "child" || !provider.rankTask) {
      return
    }
    const children = detailLinks.filter((l) => l.kind === "child")
    const plan = rankPlan(
      children,
      children.findIndex((c) => c.key === detailSelected.key),
      direction,
      {
        key: (child) => child.key,
        // Every row in the section is a child of the open issue — all siblings.
        sibling: () => true,
        marked: (child) => selection.has(child.key),
      },
    )
    if (!plan) {
      return
    }
    // The list rebuilds from board order, so the moved child lands at the neighbour's
    // index — follow it, or the next ⇧J would grab whoever swapped into this slot.
    setDetailFocus(plan.neighbor.index)
    void applyRank(plan.keys, plan.neighbor.key, direction)
  }

  /** Open the rename line for the focused issue, seeded with its current summary. */
  function startEdit() {
    if (!currentKey) {
      return
    }
    const task = taskFor(currentKey)
    if (task) {
      setEditing({ key: currentKey, current: task.summary, submitting: false })
    }
  }

  /** Replace the in-progress token with the highlighted suggestion, ready for the next. */
  function acceptSuggestion() {
    // The bar edits the viewer's filter while the viewer is up (specs/057).
    const suggestion = detail
      ? detailSuggestList[detailActiveSuggestion]
      : suggestList[activeSuggestion]
    if (!suggestion) {
      return
    }
    // A field starter (`label:`) leaves the caret right after the colon so its
    // value completions fire immediately; a completed token gets a trailing space
    // to start the next one.
    const trailer = suggestion.insert.endsWith(":") ? "" : " "
    if (detail) {
      setDetailQuery(replaceLastToken(detailQuery, suggestion.insert) + trailer)
    } else {
      setQuery(replaceLastToken(query, suggestion.insert) + trailer)
    }
    setSuggestIndex(0)
  }

  /** Flip whether the filter matches sub-tasks individually or follows the parent (specs/043). */
  function toggleSubtaskScope() {
    const next: SubtaskScope = subtaskScope === "inherit" ? "strict" : "inherit"
    setSubtaskScope(next)
    showToast(next === "inherit" ? "sub-tasks follow parent" : "sub-tasks filtered")
  }

  /** Select a grouping by its `g`-chord letter, if it's available on this board. */
  function selectGrouping(letter: string) {
    const next = GROUPING_KEYS[letter]
    if (!next || !groupings.includes(next)) {
      return
    }
    setGrouping(next)
    setCursor({ lane: 0, column: 0, row: 0, onHeader: false })
  }

  function toggleExpand() {
    const row = rows[listFocus]
    if (!row || !row.hasChildren) {
      return
    }
    setExpanded((prev) => {
      const nextSet = new Set(prev)
      if (nextSet.has(row.task.key)) {
        nextSet.delete(row.task.key)
      } else {
        nextSet.add(row.task.key)
      }
      return nextSet
    })
  }

  /**
   * Expand or collapse every row (`z ⇧R` / `z ⇧M`). Indices shift as children come and
   * go, so the row under the cursor is re-found once the new set renders — collapsing
   * from a child rides up to its parent, which is the row that survives.
   */
  function foldRows(open: boolean) {
    const focused = rows[listFocus]
    rowAnchor.current = focused
      ? !open && focused.depth > 0
        ? (focused.task.parentKey ?? focused.task.key)
        : focused.task.key
      : null
    setExpanded(
      open ? new Set(rows.filter((r) => r.hasChildren).map((r) => r.task.key)) : new Set(),
    )
  }

  /**
   * Move an issue between the backlog tab's segments (specs/044): onto the board is
   * its first column, off the board is the backlog status nearest that column — the
   * one an issue would step through on its way back out.
   */
  function crossSegment(key: string, to: "board" | "backlog") {
    anchorRow(key)
    const first = board.columns[0]
    if (!first) {
      return
    }
    const target = to === "board" ? first : nextStatus(board, first.id, -1)
    if (!target) {
      return
    }
    showToast(`${key} → ${target.title}`)
    void moveTo(key, target.id)
  }

  function setRowExpanded(open: boolean) {
    const row = rows[listFocus]
    if (!row || !row.hasChildren) {
      return
    }
    setExpanded((prev) => {
      const nextSet = new Set(prev)
      if (open) {
        nextSet.add(row.task.key)
      } else {
        nextSet.delete(row.task.key)
      }
      return nextSet
    })
  }

  useBoardKeymap({
    view,
    // While the viewer is up, `/`, its completions and esc act on the viewer's own
    // filter (specs/057); the tab's is out of reach until it closes.
    query: detail ? detailQuery : query,
    currentKey,
    onHeader: cursor.onHeader,
    activeIndex,
    tabsLength: tabs.length,
    filters,
    rows,
    listFocus,
    expanded,
    suggestCount: (detail ? detailSuggestList : suggestList).length,
    showEpics,
    showLabels,
    provider,
    showHelp,
    palette: palette.open,
    openPalette: palette.openPalette,
    creating: !!creating,
    editing: !!editing,
    assigning: !!assigning,
    labeling: !!labeling,
    epicing: !!epicing,
    statusing: !!statusing,
    resolving: !!resolving,
    jump: !!jump,
    filtering,
    setShowHelp,
    setCreating,
    cycleCreateType,
    setEditing,
    setFiltering,
    setSuggestIndex,
    acceptSuggestion,
    foldLane,
    foldAll,
    foldSubtasks,
    foldRows,
    crossSegment,
    anchorRow,
    collapseColumn,
    expandAllColumns,
    toggleSubtaskScope,
    setQuery: detail ? setDetailQuery : setQuery,
    setView,
    setShowEpics,
    setShowLabels,
    setSubtaskLayout,
    setChildVisibility,
    jumpEdge,
    selectGrouping,
    onExit,
    switchTab,
    cloneTab,
    renameTab,
    closeTab,
    namingTab: !!namingTab,
    cancelTabName: () => setNamingTab(null),
    detailOpen: !!detail,
    toggleDetail: () => toggleDetail(currentKey),
    closeDetail,
    scrollDetail,
    movePage,
    jumpDetailEdge,
    moveDetailFocus,
    openDetailItem,
    backDetail,
    rankDetailChild,
    foldDetailSection,
    foldDetailHistory,
    diffOpen: !!detailDiff,
    closeDetailDiff: () => setDetailDiff(null),
    searching: !!search,
    searchResultKey: search?.results[search.index]?.key ?? null,
    startSearch,
    cancelSearch: () => setSearch(null),
    moveSearchCursor,
    submitSearch,
    toggleSearchScope,
    keepSearchAsTab,
    searchSuggestCount: searchSuggestions.length,
    moveSearchSuggestion,
    acceptSearchSuggestion,
    showToast,
    doRefresh,
    startJump,
    selectionCount: selection.size,
    marked: (key: string) => selection.has(key),
    markedCount,
    visualActive,
    // In the viewer the mark lands on its selected item (specs/057), not the card
    // behind it — which is what `currentKey` already resolves to.
    toggleMark: () => toggleMark(currentKey),
    expandSelection,
    toggleVisual,
    exitVisual,
    clearMarks,
    copySelection,
    copyDescription,
    copyTitle,
    startCreate,
    startEpic,
    startStatus,
    startResolution,
    startEdit,
    editInEditor,
    startAssign,
    startLabels,
    handleJumpKey,
    transition,
    applyRank,
    setListIndex,
    toggleExpand,
    setRowExpanded,
    moveFocusedCard,
    rankFocusedCard,
    moveCursorColumn,
    moveCursorRow,
  })

  return (
    <Shell>
      <Header
        boards={tabs.map((t) => ({ name: t.name, adHoc: t.adHoc }))}
        activeBoard={activeIndex}
        view={view}
        grouping={grouping}
        filter={{ visible: visibleCount, query }}
        refreshing={refreshing}
        lastRefresh={lastRefresh}
        stale={
          refreshInterval > 0 && lastRefresh != null
            ? Date.now() - lastRefresh > refreshInterval * 2 * 1000
            : false
        }
        toast={toast}
      />
      <TagVisibilityProvider value={tagVisibility}>
        {detail && detailTask ? (
          <IssueDetail
            ref={detailScroll}
            task={detailTask}
            detail={detail}
            status={columnMeta.get(detailTask.columnId)?.title ?? detailTask.status ?? "—"}
            statusColor={columnMeta.get(detailTask.columnId)?.color ?? theme.textDim}
            statusGlyph={statusGlyph(detailTask.columnId, board.columns)}
            done={detailTask.columnId === doneColumnId}
            links={detailLinks}
            focusIndex={detailIndex}
            jumpLabels={jump?.labels}
            childCount={detailChildCount}
            childrenFolded={detailChildrenFolded}
            hiddenChildren={detailHiddenChildren}
            selectedKeys={selection}
            history={detailHistory}
            historyCount={detailHistoryCount}
            historyFolded={detailHistoryFolded}
            sections={detailSections}
            diff={detailDiff}
          />
        ) : view !== "board" ? (
          <ListView
            rows={rows}
            focusedIndex={listFocus}
            doneColumnId={doneColumnId}
            columnMeta={columnMeta}
            jumpLabels={jump?.labels}
            selectedKeys={selection}
          />
        ) : (
          <Board
            board={filteredBoard}
            grouping={grouping}
            lanes={lanes}
            activeLane={cursor.lane}
            activeColumn={cursor.column}
            onHeader={cursor.onHeader}
            collapsed={collapsed}
            collapsedColumns={collapsedColumns}
            focusedKey={focusedKey}
            focusedRef={focusedRef}
            laneRef={activeLaneRef}
            columnMeta={columnMeta}
            subtaskLayout={subtasks}
            jumpLabels={jump?.labels}
            selectedKeys={selection}
          />
        )}
      </TagVisibilityProvider>
      {creating && (
        <CreatePrompt
          type={creating.type}
          parent={
            creating.contextParent &&
            (creating.contextParent.kind === "epic" || creating.type === "subtask")
              ? creating.contextParent
              : null
          }
          submitting={creating.submitting}
          error={creating.error}
          onSubmit={submitCreate}
        />
      )}
      {search && (
        <SearchPrompt
          state={search}
          scopeLabel={scopeLabel}
          suggestions={searchSuggestions}
          onQueryChange={setSearchQuery}
        />
      )}
      {namingTab && (
        <EditPrompt
          prefix="tab"
          subject="name"
          current={namingTab.current}
          submitting={false}
          onSubmit={submitTabName}
        />
      )}
      {editing && (
        <EditPrompt
          prefix="edit"
          subject={editing.key}
          current={editing.current}
          submitting={editing.submitting}
          error={editing.error}
          onSubmit={submitEdit}
        />
      )}
      {assigning && (
        <Picker
          title={editTitle("assign", assigning.keys)}
          items={assignCandidates}
          // Candidates carry the accountId where the board knows one and the display
          // name otherwise (specs/027), so match the current holder the same way.
          current={sharedCurrent(assigning.keys, (t) => currentAssignee(t))}
          onSelect={(chosen, typed) => {
            setAssigning(null)
            submitAssignFor(assigning.keys, chosen, typed)
          }}
          onCancel={() => setAssigning(null)}
          placeholder="name or email…"
        />
      )}
      {labeling && (
        <LabelEditor
          title={editTitle("labels", labeling.keys)}
          current={commonLabels(labeling.keys)}
          known={knownLabels}
          onSubmit={(labels) => {
            setLabeling(null)
            submitLabelsFor(labeling.keys, labels)
          }}
          onCancel={() => setLabeling(null)}
        />
      )}
      {epicing && (
        <Picker
          title={editTitle("epic", epicing.keys)}
          items={epicItems}
          current={sharedCurrent(epicing.keys, (t) => t.epicKey) ?? null}
          onSelect={(chosen) => {
            setEpicing(null)
            submitEpicFor(epicing.keys, chosen)
          }}
          onCancel={() => setEpicing(null)}
          placeholder="epic…"
        />
      )}
      {statusing && (
        <Picker
          title={editTitle("status", statusing.keys)}
          items={statusItems}
          current={sharedCurrent(statusing.keys, (t) => t.columnId)}
          onSelect={(chosen) => {
            setStatusing(null)
            submitStatus(statusing.keys, chosen)
          }}
          onCancel={() => setStatusing(null)}
          placeholder="status…"
        />
      )}
      {resolving && (
        <Picker
          // The title is the whole safeguard against a surprise: on an open issue this
          // picker closes it, so it says so rather than reading like a field edit.
          title={
            resolving.closing
              ? editTitle("close", resolving.keys, " as")
              : editTitle("reason", resolving.keys)
          }
          items={resolutionItems}
          current={sharedCurrent(resolving.keys, (t) => t.resolution)}
          onSelect={(chosen) => {
            setResolving(null)
            submitReason(resolving.keys, chosen, resolving.closing)
          }}
          onCancel={() => setResolving(null)}
          placeholder="reason…"
        />
      )}
      {detail
        ? (filtering || detailQuery !== "") && (
            // The same bar, bound to the viewer's filter: it counts the children it
            // shows out of the family, and never touches the tab's query.
            <FilterBar
              query={detailQuery}
              onQueryChange={setDetailQuery}
              suggestions={detailSuggestList}
              activeSuggestion={detailActiveSuggestion}
              visible={detailChildCount}
              total={detailFamilyCount}
              active={filtering}
              subtaskScope={subtaskScope}
            />
          )
        : (filtering || query !== "") && (
            <FilterBar
              query={query}
              onQueryChange={setQuery}
              suggestions={suggestList}
              activeSuggestion={activeSuggestion}
              visible={visibleCount}
              total={totalCount}
              active={filtering}
              subtaskScope={subtaskScope}
            />
          )}
      {palette.open && (
        <CommandPalette
          // Remount per mode: each descent is a new list with its own starting
          // highlight and an empty query.
          key={palette.submenu?.kind ?? "commands"}
          commands={paletteCommands}
          submenu={submenuView}
          onRun={runPaletteCommand}
          onDescend={descend}
          onPick={pickInSubmenu}
          onToggleLabel={palette.toggleLabel}
          onCommitLabels={commitLabelsFromPalette}
          onBack={palette.back}
          onClose={palette.close}
        />
      )}
      {showHelp && <ShortcutHelp />}
    </Shell>
  )
}
