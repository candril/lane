import { useRef, type Dispatch, type SetStateAction } from "react"
import { useKeyboard } from "@opentui/react"
import { copyToClipboard, openIssueInWindow, openUrl } from "./actions"
import type { ListRow } from "./grouping"
import type { Draft } from "./useCreateDraft"
import type { Editing } from "./useDialogs"
import type { Board as BoardModel } from "./types"
import type { ChildVisibility, SubtaskLayout } from "./config/types"
import type { BoardProvider } from "./providers/provider"
import type { TabMode } from "./tabs"

/**
 * Everything the keyboard dispatcher touches. Modal flags are plain booleans (the
 * handler only checks whether an overlay is open); everything else is a value it
 * reads or an action it fires. Assembled once by App and handed straight to the
 * handler, which keeps the ~300-line dispatch table out of the component body.
 */
export interface BoardKeymapContext {
  view: TabMode
  query: string
  currentKey: string | null
  onHeader: boolean
  activeIndex: number
  tabsLength: number
  filters?: Record<string, string>
  rows: ListRow[]
  listFocus: number
  expanded: Set<string>
  suggestCount: number
  showEpics: boolean
  showLabels: boolean
  provider: BoardProvider
  // Modal overlays that own the keyboard while open.
  showHelp: boolean
  /** The command palette (specs/010) — it owns every key while open, submenus included. */
  palette: boolean
  creating: boolean
  editing: boolean
  assigning: boolean
  labeling: boolean
  epicing: boolean
  statusing: boolean
  resolving: boolean
  jump: boolean
  /** The tab-name prompt is open (specs/045) — it owns the keyboard like any editor. */
  namingTab: boolean
  /** The detail view is open (specs/007). Unlike the prompts it does *not* own every
   * key: the field editors still work through it, so it only claims the scroll keys. */
  detailOpen: boolean
  filtering: boolean
  // Actions.
  setShowHelp: (open: boolean) => void
  openPalette: () => void
  setCreating: Dispatch<SetStateAction<Draft | null>>
  cycleCreateType: () => void
  setEditing: Dispatch<SetStateAction<Editing | null>>
  setFiltering: (open: boolean) => void
  setSuggestIndex: Dispatch<SetStateAction<number>>
  acceptSuggestion: () => void
  foldLane: (mode: "toggle" | "open" | "close") => void
  foldAll: (open: boolean) => void
  foldSubtasks: (mode: "toggle" | "open" | "close") => void
  /** Expand/collapse every row of a list or backlog view (specs/044). */
  foldRows: (open: boolean) => void
  /** Move an issue between the backlog tab's segments — onto the board or off it. */
  crossSegment: (key: string, to: "board" | "backlog") => void
  /** Keep the cursor on this issue once the row set has been rebuilt. */
  anchorRow: (key: string) => void
  /** Global search (specs/046). */
  searching: boolean
  /** The highlighted result's key, for the actions that need nothing but a key. */
  searchResultKey: string | null
  startSearch: () => void
  cancelSearch: () => void
  moveSearchCursor: (direction: -1 | 1) => void
  submitSearch: () => void
  /** ^V in the search prompt: show the highlighted result in the viewer (specs/057). */
  viewSearchResult: () => void
  toggleSearchScope: () => void
  /** Keep the running search as a query-backed tab (specs/047). */
  keepSearchAsTab: () => void
  /** Completions offered for the search prompt's open field token (specs/048). */
  searchSuggestCount: number
  moveSearchSuggestion: (direction: -1 | 1) => void
  acceptSearchSuggestion: () => void
  collapseColumn: () => void
  expandAllColumns: () => void
  toggleSubtaskScope: () => void
  setQuery: Dispatch<SetStateAction<string>>
  setView: Dispatch<SetStateAction<TabMode>>
  setShowEpics: Dispatch<SetStateAction<boolean>>
  setShowLabels: Dispatch<SetStateAction<boolean>>
  setSubtaskLayout: (layout: SubtaskLayout) => void
  setChildVisibility: (visibility: ChildVisibility) => void
  jumpEdge: (edge: "top" | "bottom") => void
  selectGrouping: (letter: string) => void
  onExit: () => void
  switchTab: (index: number) => void
  cloneTab: () => void
  renameTab: () => void
  closeTab: () => void
  cancelTabName: () => void
  showToast: (message: string) => void
  doRefresh: () => void
  startJump: () => void
  /** Multi-select (specs/055): marks plus an active visual range, as issue keys. */
  selectionCount: number
  markedCount: number
  visualActive: boolean
  /** Mark/unmark the focused issue (space). */
  toggleMark: () => void
  /** ^A: mark the ring around the cursor; again widens it (specs/055). */
  expandSelection: () => void
  /** ⇧V in a row view: anchor a visual range at the cursor, or drop an active one. */
  toggleVisual: () => void
  exitVisual: () => void
  clearMarks: () => void
  /** Copy the whole selection, newline-separated. */
  copySelection: (kind: "key" | "url" | "title") => void
  /** Copy the focused issue's description as Markdown (specs/054). */
  copyDescription: () => void
  copyTitle: () => void
  /** Open the detail view on the focused issue, or close it if it already shows it. */
  toggleDetail: () => void
  closeDetail: () => void
  /** Scroll the open detail view: a line delta, a page, or to an end (specs/007). */
  scrollDetail: (by: number | "page-up" | "page-down" | "top" | "bottom") => void
  /** ^D/^U in a view: half a screen of cursor stops, as in nvim (specs/003). */
  movePage: (direction: -1 | 1) => void
  /** gg/⇧G in the viewer: its first or last stop (specs/057). */
  jumpDetailEdge: (edge: "top" | "bottom") => void
  /** Walk the viewer's items — the issue, then the ones it links to (specs/057). */
  moveDetailFocus: (direction: -1 | 1) => void
  /** ↵ in the viewer: follow the selected link, or close on the issue itself. */
  openDetailItem: () => void
  /** ⌫ in the viewer: back up the trail drilled in, closing at the root. */
  backDetail: () => void
  /** ⇧J/⇧K in the viewer: rank the selected child against its siblings. */
  rankDetailChild: (direction: -1 | 1) => void
  /** `z a/o/c`, `l`/`h` in the viewer: fold the section under its cursor (specs/057). */
  foldDetailSection: (mode: "toggle" | "open" | "close") => void
  /** `z h` in the viewer: fold its history section (specs/058). */
  foldDetailHistory: (mode: "toggle" | "open" | "close") => void
  /** A history edit is open as a diff over the description (specs/058). */
  diffOpen: boolean
  closeDetailDiff: () => void
  startCreate: (topLevel: boolean) => void
  startEpic: () => void
  startStatus: () => void
  startResolution: () => void
  startEdit: () => void
  /** Hand the focused issue's summary and description to `$EDITOR` (specs/049). */
  editInEditor: () => void
  startAssign: () => void
  startLabels: () => void
  handleJumpKey: (name: string) => void
  transition: (key: string, direction: -1 | 1, onApplied?: (next: BoardModel) => void) => void
  applyRank: (
    key: string,
    neighborKey: string,
    direction: -1 | 1,
    onApplied?: (next: BoardModel) => void,
  ) => void
  setListIndex: Dispatch<SetStateAction<number>>
  toggleExpand: () => void
  setRowExpanded: (open: boolean) => void
  moveFocusedCard: (direction: -1 | 1) => void
  rankFocusedCard: (direction: -1 | 1) => void
  moveCursorColumn: (direction: -1 | 1) => void
  moveCursorRow: (direction: -1 | 1) => void
}

/**
 * Sub-task layouts on the `v` chord (specs/051): `v o` own-column, `v u` under-parent,
 * `v c` checklist, `v g` grouped into parent baskets. Direct letters rather than one
 * cycling key — the point is switching *back and forth* between two of them.
 */
const SUBTASK_LAYOUT_KEYS: Record<string, SubtaskLayout | undefined> = {
  o: "own-column",
  u: "under-parent",
  c: "checklist",
  g: "basket",
}

/**
 * Child visibility on the same chord (specs/052): `v a` all, `v d` all but the done
 * ones, `v n` none. A second axis over the layouts above — *which* children show,
 * not where they sit — so the two compose rather than multiply into eight modes.
 */
const CHILD_VISIBILITY_KEYS: Record<string, ChildVisibility | undefined> = {
  a: "all",
  d: "hide-done",
  n: "none",
}

/**
 * The whole keyboard dispatch table. Overlay precedence comes first (help → create →
 * edit → the pickers → jump → filter), then the two-key chords (`z`/`f`/`v`/`t`/`g`),
 * then the global and per-view keys. The chord-pending flags live here since nothing
 * else needs them.
 */
export function useBoardKeymap(ctx: BoardKeymapContext) {
  // Two-key `z…` fold chord: true once `z` is pressed, awaiting a/o/c/R/M.
  const zPendingRef = useRef(false)
  // Two-key `f…` quick-filter chord: true once `f` is pressed, awaiting a letter (specs/036).
  const fPendingRef = useRef(false)
  // Two-key `v…` view chord: true once `v` is pressed, awaiting b/l (specs/017).
  const vPendingRef = useRef(false)
  // Two-key `t…` tag-visibility chord: true once `t` is pressed, awaiting e/l/a (specs/039).
  const tPendingRef = useRef(false)
  // Two-key `g…` chord: true once `g` is pressed, awaiting `g` (top) or a grouping letter.
  const gPendingRef = useRef(false)
  // Two-key `⇧T…` tab chord: true once ⇧T is pressed, awaiting c/r/x (specs/045).
  const tabPendingRef = useRef(false)

  useKeyboard((key) => {
    // Normalize: some terminals send an uppercase name (e.g. "H") with the shift
    // flag unset instead of shift + lowercase; fold both into name + shift.
    const name = key.name?.toLowerCase() ?? ""
    const implicitShift = key.name?.length === 1 && key.name !== name && !key.shift
    const shift = !!key.shift || implicitShift

    // The shortcut dialog (specs/011) captures the keyboard while open: esc/?/q close
    // it, everything else is swallowed.
    if (ctx.showHelp) {
      if (name === "escape" || name === "?" || name === "q") {
        ctx.setShowHelp(false)
      }
      return
    }

    // The palette owns every key while open, including its submenus — it runs its own
    // list, query and Esc-to-back (specs/010).
    if (ctx.palette) {
      return
    }

    // The quick-add line owns the keyboard while open: Esc dismisses, Ctrl-T
    // cycles the type, everything else falls through to the focused input. This
    // handler runs ahead of the input (OpenTUI's global-first key priority), so
    // preventDefault is what stops those two from also being typed.
    if (ctx.creating) {
      if (name === "escape") {
        ctx.setCreating(null)
        key.preventDefault()
      } else if (key.ctrl && name === "t") {
        ctx.cycleCreateType()
        key.preventDefault()
      }
      return
    }

    // The rename line owns the keyboard while open: Esc cancels, everything else
    // (incl. Enter → submit) falls through to the focused input.
    if (ctx.editing) {
      if (name === "escape") {
        ctx.setEditing(null)
        key.preventDefault()
      }
      return
    }

    // The search prompt owns the keyboard while open (specs/046): it navigates and
    // submits its own list, and everything else falls through to its input.
    if (ctx.searching) {
      // A completion list is up (specs/048): it borrows the list keys while it shows,
      // the same ones it has in the filter bar, and hands them back once accepted.
      if (ctx.searchSuggestCount > 0 && name !== "escape") {
        if (name === "up" || (key.ctrl && name === "p")) {
          ctx.moveSearchSuggestion(-1)
          key.preventDefault()
        } else if (name === "down" || (key.ctrl && name === "n")) {
          ctx.moveSearchSuggestion(1)
          key.preventDefault()
        } else if (
          name === "tab" ||
          name === "return" ||
          name === "enter" ||
          (key.ctrl && name === "y")
        ) {
          ctx.acceptSearchSuggestion()
          key.preventDefault()
        }
        return
      }
      if (name === "escape") {
        ctx.cancelSearch()
        key.preventDefault()
      } else if (name === "up" || (key.ctrl && name === "p")) {
        ctx.moveSearchCursor(-1)
        key.preventDefault()
      } else if (name === "down" || (key.ctrl && name === "n")) {
        ctx.moveSearchCursor(1)
        key.preventDefault()
      } else if (name === "return" || name === "enter") {
        ctx.submitSearch()
        key.preventDefault()
      } else if (key.ctrl && name === "a") {
        ctx.toggleSearchScope()
        key.preventDefault()
      } else if (key.ctrl && name === "t") {
        // Keep the results as a tab (specs/047) — from there every action works,
        // because the results are a board like any other.
        ctx.keepSearchAsTab()
        key.preventDefault()
      } else if (key.ctrl && name === "v" && ctx.searchResultKey) {
        // ^V shows the result in the viewer (specs/057). ↵ only does that when the
        // result isn't loaded — on a loaded one it jumps to the card instead.
        ctx.viewSearchResult()
        key.preventDefault()
      } else if (key.ctrl && "oyu".includes(name) && ctx.searchResultKey) {
        // The actions that need only a key work on a result that is on no board;
        // the rest act through the board and wait for specs/046's result tab.
        // Plain letters would be typed into the query, so these are ctrl-keyed.
        const issue = ctx.searchResultKey
        const url = ctx.provider.issueUrl?.(issue)
        if (name === "y") {
          copyToClipboard(issue)
          ctx.showToast(`${issue} copied`)
        } else if (url && name === "u") {
          copyToClipboard(url)
          ctx.showToast(`${issue} URL copied`)
        } else if (url) {
          openUrl(url)
          ctx.showToast(`${issue} opened`)
        }
        key.preventDefault()
      }
      return
    }

    // Same for the tab-name line (specs/045).
    if (ctx.namingTab) {
      if (name === "escape") {
        ctx.cancelTabName()
        key.preventDefault()
      }
      return
    }

    // The assignee picker owns the keyboard while open (its own useKeyboard handles
    // navigation; typing goes to its input). App bows out without consuming keys.
    if (ctx.assigning) {
      return
    }

    // The label editor owns the keyboard while open (its own useKeyboard handles
    // navigation/toggle/commit; typing goes to its input).
    if (ctx.labeling) {
      return
    }

    // The epic picker owns the keyboard while open (its own useKeyboard handles
    // navigation; typing goes to its input).
    if (ctx.epicing) {
      return
    }

    // The status picker owns the keyboard while open (its own useKeyboard handles
    // navigation; typing goes to its input).
    if (ctx.statusing) {
      return
    }

    // As does the reason picker (specs/053).
    if (ctx.resolving) {
      return
    }

    // Jump mode owns the keyboard: every key is a label char (or Esc) — specs/037.
    if (ctx.jump) {
      ctx.handleJumpKey(name)
      return
    }

    // While the filter bar is open it owns the keyboard: navigate and accept
    // completions, dismiss with Esc/Enter; typing falls through to the input.
    if (ctx.filtering) {
      if (name === "escape" || name === "return" || name === "enter") {
        ctx.setFiltering(false)
        key.preventDefault()
      } else if (name === "up" || (key.ctrl && name === "p")) {
        ctx.setSuggestIndex((i) => Math.max(0, i - 1))
        key.preventDefault()
      } else if (name === "down" || (key.ctrl && name === "n")) {
        ctx.setSuggestIndex((i) => Math.min(ctx.suggestCount - 1, i + 1))
        key.preventDefault()
      } else if (name === "tab" || (key.ctrl && name === "y")) {
        // Ctrl-Y (as in monq) or Tab fills the highlighted suggestion.
        ctx.acceptSuggestion()
        key.preventDefault()
      }
      return
    }

    // Resolve a pending `z…` fold chord before anything else consumes the key.
    if (zPendingRef.current) {
      zPendingRef.current = false
      // Under the viewer the fold is the section its cursor is in (specs/057): what
      // you can see, rather than the lane or row behind the overlay.
      if (ctx.detailOpen) {
        if (name === "a") {
          ctx.foldDetailSection("toggle")
        } else if (name === "o") {
          ctx.foldDetailSection("open")
        } else if (name === "c") {
          ctx.foldDetailSection("close")
        } else if (name === "h") {
          ctx.foldDetailHistory("toggle")
        }
        return
      }
      if (ctx.view === "board") {
        // a/o/c act on the card's sub-tasks (specs/042); with no foldable card under the
        // cursor `foldSubtasks` falls back to the lane fold, so the old behaviour stands.
        if (name === "a") {
          ctx.foldSubtasks("toggle")
        } else if (name === "o") {
          ctx.foldSubtasks("open")
        } else if (name === "c") {
          ctx.foldSubtasks("close")
        } else if (name === "r" && shift) {
          ctx.foldAll(true)
        } else if (name === "m" && shift) {
          ctx.foldAll(false)
        }
      } else {
        // The row views fold the same way, on the expand/collapse set instead of the
        // lane/sub-task fold state: a/o/c act on the row under the cursor, ⇧R/⇧M on
        // every row (specs/044).
        if (name === "a") {
          ctx.toggleExpand()
        } else if (name === "o") {
          ctx.setRowExpanded(true)
        } else if (name === "c") {
          ctx.setRowExpanded(false)
        } else if (name === "r" && shift) {
          ctx.foldRows(true)
        } else if (name === "m" && shift) {
          ctx.foldRows(false)
        }
      }
      return
    }

    // Resolve a pending `f…` quick-filter chord (specs/036): the letter selects a
    // configured filter. Pressing the same one again toggles it off.
    if (fPendingRef.current) {
      fPendingRef.current = false
      const q = ctx.filters?.[name]
      if (q !== undefined) {
        ctx.setQuery((cur) => (cur === q ? "" : q))
      }
      return
    }

    // Resolve a pending `v…` view chord (specs/017): `b` board, `l` list, `k` backlog
    // (specs/044). Any other key cancels — bare `v` no longer toggles, so switching
    // view is always explicit.
    if (vPendingRef.current) {
      vPendingRef.current = false
      if (name === "b") {
        ctx.setView("board")
      } else if (name === "l") {
        ctx.setView("list")
      } else if (name === "k") {
        ctx.setView("backlog")
      } else if (SUBTASK_LAYOUT_KEYS[name]) {
        ctx.setSubtaskLayout(SUBTASK_LAYOUT_KEYS[name]!)
      } else if (CHILD_VISIBILITY_KEYS[name]) {
        ctx.setChildVisibility(CHILD_VISIBILITY_KEYS[name]!)
      }
      return
    }

    // Resolve a pending `⇧T…` tab chord (specs/045): `c` clone, `r` rename, `x` close.
    if (tabPendingRef.current) {
      tabPendingRef.current = false
      if (name === "c") {
        ctx.cloneTab()
      } else if (name === "r") {
        ctx.renameTab()
      } else if (name === "x") {
        ctx.closeTab()
      }
      return
    }

    // Resolve a pending `t…` tag-visibility chord (specs/039): `e` epic tags, `l`
    // labels, `a` both (off if either is on, else on). Any other key cancels.
    if (tPendingRef.current) {
      tPendingRef.current = false
      if (name === "e") {
        ctx.setShowEpics((s) => !s)
      } else if (name === "l") {
        ctx.setShowLabels((s) => !s)
      } else if (name === "a") {
        const on = !(ctx.showEpics || ctx.showLabels)
        ctx.setShowEpics(on)
        ctx.setShowLabels(on)
      }
      return
    }

    // Resolve a pending `g…` chord: `gg` jumps to the top; `g`+letter selects a board
    // grouping (`gn`/`gp`/`gt`/`gs`) — the vim "go" idiom, replacing the old bare-`g`
    // cycle so `g` can also lead the motion. No grouping key is `g`, so no clash.
    if (gPendingRef.current) {
      gPendingRef.current = false
      if (ctx.detailOpen) {
        // The viewer's cursor, not its scroll: `gg`/`⇧G` are motions everywhere else,
        // and ^D/^U/^F/^B still page the description.
        if (name === "g") {
          ctx.jumpDetailEdge("top")
        }
      } else if (name === "g") {
        ctx.jumpEdge("top")
      } else if (ctx.view === "board") {
        ctx.selectGrouping(name)
      }
      return
    }

    // The detail view (specs/007) claims only the keys that read it — scrolling, and
    // the two ways out. Everything else falls through on purpose: `⇧S`, `a`, `#`, `⇧E`
    // and `e` act on the issue it is showing, since App resolves `currentKey` to it,
    // and their pickers open over the top. The per-view movement keys are suppressed
    // at the bottom of this handler instead, where the board would otherwise scroll
    // under an overlay you cannot see it through.
    if (ctx.detailOpen) {
      // A diff is a page over the viewer (specs/058): it takes the leave keys and the
      // scroll keys, and swallows the rest so the cursor beneath can't move unseen.
      if (ctx.diffOpen) {
        if (name === "escape" || name === "backspace" || name === "q") {
          ctx.closeDetailDiff()
        } else if (key.ctrl && (name === "d" || name === "f")) {
          ctx.scrollDetail("page-down")
        } else if (key.ctrl && (name === "u" || name === "b")) {
          ctx.scrollDetail("page-up")
        } else if (name === "j" || name === "down") {
          ctx.scrollDetail(1)
        } else if (name === "k" || name === "up") {
          ctx.scrollDetail(-1)
        }
        return
      }
      // Esc drops an active visual range before it closes anything, as it does on
      // the board (specs/055); the marks themselves outlive the viewer.
      if (name === "escape" && ctx.visualActive) {
        ctx.exitVisual()
        return
      }
      // The viewer's own filter (`/`, specs/057) clears before the viewer closes —
      // the board's esc order. `ctx.query` is that filter while the viewer is up.
      if (name === "escape" && ctx.query !== "") {
        ctx.setQuery("")
        return
      }
      if (name === "escape" || name === "q") {
        ctx.closeDetail()
        return
      }
      // Backspace reads as "back": up the trail of links drilled through (specs/057),
      // and out of the viewer at the root. It never reaches the filter clear below —
      // leaving the issue is the nearer meaning while it is the thing on screen.
      if (name === "backspace") {
        ctx.backDetail()
        return
      }
      // ↵ follows the selected link, so the viewer walks the tree instead of being a
      // dead end; on the issue itself there is nothing to follow, so it closes.
      if (name === "return" || name === "enter") {
        ctx.openDetailItem()
        return
      }
      // l/h open and close the section under the cursor — the list view's tree
      // disclosure (specs/057); `h` from inside a section lands on its heading.
      if (name === "l" || name === "right") {
        ctx.foldDetailSection("open")
        return
      }
      if (name === "h" || name === "left") {
        ctx.foldDetailSection("close")
        return
      }
      // Space marks the selected item (specs/055 in the viewer, specs/057) — the same
      // set the board's marks live in, so it shows there too.
      if (name === "space") {
        ctx.toggleMark()
        return
      }
      // ^N/^P walk the items too, as they do in every prompt's list. That shadows the
      // palette's ^P while the viewer is up, which is why ⇧P opens it as well.
      if (key.ctrl && (name === "n" || name === "p")) {
        ctx.moveDetailFocus(name === "n" ? 1 : -1)
        return
      }
      // j/k walk the issue and its links — the description scrolls on the ctrl keys
      // below, which is where a long read reaches for it anyway.
      if (shift && (name === "j" || name === "k" || name === "down" || name === "up")) {
        ctx.rankDetailChild(name === "j" || name === "down" ? 1 : -1)
        return
      }
      if (name === "j" || name === "down") {
        ctx.moveDetailFocus(1)
        return
      }
      if (name === "k" || name === "up") {
        ctx.moveDetailFocus(-1)
        return
      }
      if (key.ctrl && (name === "d" || name === "f")) {
        ctx.scrollDetail("page-down")
        return
      }
      if (key.ctrl && (name === "u" || name === "b")) {
        ctx.scrollDetail("page-up")
        return
      }
      if (name === "g" && shift) {
        ctx.jumpDetailEdge("bottom")
        return
      }
      if (name === "g") {
        gPendingRef.current = true
        return
      }
      // Switching tabs closes the viewer rather than leaving it on an issue the new
      // tab may not even hold — asking for another board is asking to leave this
      // issue. Deliberately falls through, so the tab switch itself still happens.
      if (name === "[" || name === "]" || (/^[1-9]$/.test(name) && !shift)) {
        ctx.closeDetail()
      }
    }

    // ^P opens the command palette (specs/010) — every action, and the field editors
    // as submenus, without needing to know the direct key. ⇧P is its alias for the
    // one place ^P means something else: the viewer, where it walks the items.
    if ((key.ctrl && name === "p") || (name === "p" && shift)) {
      ctx.openPalette()
      return
    }
    // ^A marks the ring around the cursor — siblings, then the cell, the lane, the
    // board — one ring per press (specs/055). Global, so it works in the viewer too.
    if (key.ctrl && name === "a") {
      ctx.expandSelection()
      return
    }
    if (name === "q" || (key.ctrl && name === "c")) {
      ctx.onExit()
      return
    }
    if (name === "?" || (name === "/" && shift)) {
      ctx.setShowHelp(true)
      return
    }
    // `:` opens the global search (specs/046) — words, an issue key, or JQL.
    if (name === ":" || (name === ";" && shift)) {
      ctx.startSearch()
      return
    }

    if (name === "/") {
      ctx.setSuggestIndex(0)
      ctx.setFiltering(true)
      return
    }
    // Esc backs out in layers (specs/055): an active visual range first, then the
    // marks, then the filter. Backspace only ever clears the filter.
    if (name === "escape" && ctx.visualActive) {
      ctx.exitVisual()
      return
    }
    if (name === "escape" && ctx.markedCount > 0) {
      ctx.clearMarks()
      return
    }
    // The bar stays visible while a filter is applied (but unfocused); Esc or
    // Backspace on the board clears it.
    if ((name === "escape" || name === "backspace") && ctx.query !== "") {
      ctx.setQuery("")
      return
    }
    // Board tabs: 1–9 jump directly, [ / ] cycle (specs/016). Bare digits only —
    // a shifted digit is a symbol (e.g. shift+3 = #), handled below.
    if (/^[1-9]$/.test(name) && !shift) {
      ctx.switchTab(Number(name) - 1)
      return
    }
    if (name === "[") {
      ctx.switchTab((ctx.activeIndex - 1 + ctx.tabsLength) % ctx.tabsLength)
      return
    }
    if (name === "]") {
      ctx.switchTab((ctx.activeIndex + 1) % ctx.tabsLength)
      return
    }
    // ⇧R sets the reason a close carries (specs/053) — closing the issue if it is not
    // closed yet; bare `r` refreshes. Both arrive as "r", so the shifted form goes first.
    // The field editors act on the focused issue, or on the whole multi-select when
    // one exists (specs/056) — hence the selection alternative in each guard below.
    if (name === "r" && shift && (ctx.currentKey || ctx.selectionCount > 0)) {
      ctx.startResolution()
      return
    }
    if (name === "r" && !shift) {
      ctx.showToast("refreshing…")
      ctx.doRefresh()
      return
    }
    // ⇧V anchors a visual range over the rows (specs/055) — nvim's V — or over the
    // viewer's items while it is up (specs/057). The board grid has no linear order to
    // extend along, so it acts nowhere else. Checked before the chord, since both
    // arrive as "v". (Opening the viewer moved to ↵ with specs/055.)
    if (name === "v" && shift) {
      if (ctx.detailOpen || ctx.view !== "board") {
        ctx.toggleVisual()
      }
      return
    }
    // `v` arms the view chord (specs/017): `v b` board, `v l` list, `v k` backlog,
    // plus the sub-task layouts (specs/051) and child visibility (specs/052).
    if (name === "v") {
      vPendingRef.current = true
      return
    }
    // `⇧T` arms the tab chord (specs/045): `c` clone, `r` rename, `x` close.
    if (name === "t" && shift) {
      tabPendingRef.current = true
      return
    }
    // `t` arms the tag-visibility chord (specs/039): `t e` epic, `t l` labels, `t a` all.
    if (name === "t") {
      tPendingRef.current = true
      return
    }
    // ⇧S opens the status picker; bare `s` starts a flash-style jump (specs/037).
    // Check the shifted form first (both arrive as name "s"). Sub-tasks are hidden
    // with a `-type:subtask` filter (via `/` or an `f`-chord quick filter — specs/036).
    if (name === "s" && shift && (ctx.currentKey || ctx.selectionCount > 0)) {
      ctx.startStatus()
      return
    }
    if (name === "s") {
      ctx.startJump()
      return
    }
    // `⇧G` jumps to the bottom; bare `g` arms the g-chord (`gg` top, `gc` grouping).
    if (name === "g" && shift) {
      ctx.jumpEdge("bottom")
      return
    }
    if (name === "g") {
      gPendingRef.current = true
      return
    }
    if (name === "z") {
      zPendingRef.current = true
      return
    }
    // `c` folds the column under the cursor to a strip; `⇧C` expands all (specs/040).
    if (name === "c" && ctx.view === "board") {
      if (shift) {
        ctx.expandAllColumns()
      } else {
        ctx.collapseColumn()
      }
      return
    }
    // ⇧F flips the filter's sub-task scope (specs/043); bare `f` starts the quick-filter
    // chord (specs/036) — only when any are configured.
    if (name === "f" && shift) {
      ctx.toggleSubtaskScope()
      return
    }
    if (name === "f" && ctx.filters && Object.keys(ctx.filters).length > 0) {
      fPendingRef.current = true
      return
    }
    if (name === "n") {
      // N (shift) forces a top-level issue; n creates in-context (child).
      ctx.startCreate(shift)
      return
    }
    // ⇧E sets/detaches the epic; bare `e` renames. Check the shifted form first.
    if (name === "e" && shift && (ctx.currentKey || ctx.selectionCount > 0)) {
      ctx.startEpic()
      return
    }
    if (name === "e" && ctx.currentKey) {
      ctx.startEdit()
      return
    }
    if (name === "a" && (ctx.currentKey || ctx.selectionCount > 0)) {
      ctx.startAssign()
      return
    }
    // `i` edits summary + description in $EDITOR (specs/049) — from the viewer, a card,
    // or a list row; `e` stays the one-line rename.
    if (name === "i" && ctx.currentKey) {
      ctx.editInEditor()
      return
    }
    // `#` opens the label editor. Terminals disagree on how they report it: some
    // send name "#", others send the base key "3" with the shift flag.
    if ((name === "#" || (name === "3" && shift)) && (ctx.currentKey || ctx.selectionCount > 0)) {
      ctx.startLabels()
      return
    }
    // Issue actions on the focused card (specs/014), in either view.
    if (name === "o" && ctx.currentKey) {
      if (shift) {
        openIssueInWindow(ctx.currentKey) // O → `lane view` in a new tmux window
        ctx.showToast(`${ctx.currentKey} → new window`)
      } else {
        const url = ctx.provider.issueUrl?.(ctx.currentKey) // o → open in the browser
        if (url) {
          openUrl(url)
          ctx.showToast(`opened ${ctx.currentKey}`)
        }
      }
      return
    }
    // With a selection, y/⇧Y/⇧U copy every selected issue instead of the focused
    // one (specs/055), newline-separated.
    if (name === "y" && ctx.selectionCount > 0) {
      ctx.copySelection(shift ? "url" : "key")
      return
    }
    if (name === "y" && ctx.currentKey) {
      if (shift) {
        const url = ctx.provider.issueUrl?.(ctx.currentKey) // Y → copy the URL
        if (url) {
          copyToClipboard(url)
          ctx.showToast(`${ctx.currentKey} URL copied`)
        }
      } else {
        copyToClipboard(ctx.currentKey) // y → copy the key
        ctx.showToast(`${ctx.currentKey} copied`)
      }
      return
    }
    // ⇧D copies the description as the Markdown the provider converted (specs/054) —
    // from the viewer, a card, or a row.
    if (name === "d" && shift && ctx.currentKey) {
      ctx.copyDescription()
      return
    }
    // ⇧U copies the title (specs/054); with a selection, one title per line.
    if (name === "u" && shift) {
      if (ctx.selectionCount > 0) {
        ctx.copySelection("title")
      } else if (ctx.currentKey) {
        ctx.copyTitle()
      }
      return
    }

    // Past here the keys move a cursor or fold a lane, neither of which is visible
    // behind the detail overlay — so it swallows them (specs/007).
    if (ctx.detailOpen) {
      return
    }

    // ^D/^U move the cursor half a screen of stops in every view, as in nvim
    // (specs/003) — in the viewer above, the same keys page the description instead.
    if (key.ctrl && (name === "d" || name === "u")) {
      ctx.movePage(name === "d" ? 1 : -1)
      return
    }

    if (ctx.view !== "board") {
      if (shift && (name === "j" || name === "k" || name === "down" || name === "up")) {
        const dir = name === "j" || name === "down" ? 1 : -1
        const focused = ctx.rows[ctx.listFocus]
        // Anchor on the nearest row at the same level, both ways: a root skips nested
        // sub-task rows so it reorders against the adjacent parent, and a sub-task
        // skips anything that isn't a sibling — ranking it against the next parent
        // would drop it wherever that parent sits in the global order, which among
        // its siblings is arbitrary. Running out of siblings means it is already
        // first or last, and the row stays where it is.
        let j = ctx.listFocus + dir
        if (focused && focused.depth === 0) {
          while (ctx.rows[j] && ctx.rows[j]!.depth > 0) {
            j += dir
          }
        } else if (focused) {
          while (ctx.rows[j] && ctx.rows[j]!.task.parentKey !== focused.task.parentKey) {
            j += dir
          }
        }
        const neighbor = ctx.rows[j]
        // Ranking past the end of a backlog segment moves the issue *across* the
        // divider instead — onto the board or off it (specs/044), which is what
        // dragging an issue over it does in Jira. The direction decides, not the
        // neighbouring row: with an empty first column there is no row to compare
        // against, and promoting into it has to keep working. Only whole issues
        // cross; a sub-task ranks among its siblings.
        if (focused && focused.depth === 0 && focused.segment) {
          const leaving = neighbor?.segment !== focused.segment
          const to = dir < 0 ? "board" : "backlog"
          // Only a *status* backlog's divider is crossable by ranking. On a sprint
          // backlog (specs/050) the divider is sprint membership, which no status
          // transition can change — so ranking stops at it rather than silently
          // moving the issue through a workflow it was never asked to enter.
          const crossable = focused.segment === "board" || focused.segment === "backlog"
          if (leaving && crossable && to !== focused.segment) {
            ctx.crossSegment(focused.task.key, to)
            return
          }
          if (leaving) {
            return
          }
        }
        if (focused && neighbor && ctx.provider.rankTask) {
          // Ride along with the issue: rebuilding the rows here would have to know how
          // this view builds them (the backlog's are segmented, specs/044), and getting
          // that wrong strands the cursor rows away — so name the issue and let App put
          // the cursor back once the new rows exist.
          ctx.anchorRow(focused.task.key)
          ctx.applyRank(focused.task.key, neighbor.task.key, dir)
        }
      } else if (shift && (name === "l" || name === "h")) {
        const row = ctx.rows[ctx.listFocus]
        if (row) {
          ctx.anchorRow(row.task.key)
          ctx.transition(row.task.key, name === "l" ? 1 : -1)
        }
      } else if (name === "j" || name === "down") {
        ctx.setListIndex((i) => Math.min(ctx.rows.length - 1, i + 1))
      } else if (name === "k" || name === "up") {
        ctx.setListIndex((i) => Math.max(0, i - 1))
      } else if (name === "return" || name === "enter") {
        // ↵ opens the issue (specs/055); the tree disclosure stays on h/l.
        ctx.toggleDetail()
      } else if (name === "space") {
        ctx.toggleMark()
      } else if (name === "l" || name === "right") {
        ctx.setRowExpanded(true)
      } else if (name === "h" || name === "left") {
        ctx.setRowExpanded(false)
      }
      return
    }

    // Board view. On a lane header, left/right/Enter drive its fold — the natural
    // gesture — mirroring the list-view tree disclosure.
    if (ctx.onHeader && (name === "return" || name === "enter" || name === "space")) {
      ctx.foldLane("toggle")
    } else if (ctx.onHeader && !shift && (name === "l" || name === "right")) {
      ctx.foldLane("open")
    } else if (ctx.onHeader && !shift && (name === "h" || name === "left")) {
      ctx.foldLane("close")
    } else if (name === "return" || name === "enter") {
      // ↵ on a card opens the viewer (specs/055); on an empty cell it's a no-op.
      if (ctx.currentKey) {
        ctx.toggleDetail()
      }
    } else if (name === "space") {
      ctx.toggleMark()
    } else if (shift && (name === "h" || name === "left")) {
      ctx.moveFocusedCard(-1)
    } else if (shift && (name === "l" || name === "right")) {
      ctx.moveFocusedCard(1)
    } else if (shift && (name === "k" || name === "up")) {
      ctx.rankFocusedCard(-1)
    } else if (shift && (name === "j" || name === "down")) {
      ctx.rankFocusedCard(1)
    } else if (name === "h" || name === "left") {
      ctx.moveCursorColumn(-1)
    } else if (name === "l" || name === "right") {
      ctx.moveCursorColumn(1)
    } else if (name === "j" || name === "down") {
      ctx.moveCursorRow(1)
    } else if (name === "k" || name === "up") {
      ctx.moveCursorRow(-1)
    }
  })
}
