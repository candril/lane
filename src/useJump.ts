import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { locate, type Lane, type ListRow } from "./grouping"
import {
  INSTANT_LABEL_LIMIT,
  jumpLabels,
  searchLabels,
  searchMatches,
  type JumpTarget,
} from "./utils/jump"
import type { Cursor } from "./useBoardCursor"
import type { TabMode } from "./tabs"

/** What a search narrows by: the key and the summary, as one haystack. */
function issueText(task: { key: string; summary: string }): string {
  return `${task.key} ${task.summary}`
}

function laneText(lane: Lane): string {
  const header = lane.header
  if (!header) {
    return lane.key
  }
  return header.kind === "label" ? header.text : issueText(header.task)
}

/**
 * Flash-style jump (specs/037): label every visible target — lane headers and cards
 * in the board, or rows in the list — then land the cursor on whichever label the
 * user types. `jump` owns the labels, the keys typed so far, and which target keys
 * are lanes (vs cards) so a pick lands on the right thing.
 */
export function useJump(args: {
  view: TabMode
  lanes: Lane[]
  rows: ListRow[]
  cursorColumn: number
  setCursor: Dispatch<SetStateAction<Cursor>>
  setListIndex: Dispatch<SetStateAction<number>>
  /**
   * The open viewer's linked issues (specs/057), while it is up: they are the jump
   * targets instead of the board behind it, and a pick moves the viewer's cursor.
   */
  detail?: { links: { key: string; index: number }[]; setFocus: (index: number) => void } | null
}) {
  const { view, lanes, rows, cursorColumn, setCursor, setListIndex, detail } = args
  const [jump, setJump] = useState<{
    /** The label prefix typed so far — only the label flavour uses it. */
    input: string
    /**
     * The search flavour (specs/037): what has been typed to narrow, and every target
     * it could still narrow to. Null on a board small enough to label outright.
     */
    search: { query: string; targets: JumpTarget[] } | null
    labels: Map<string, string>
    laneKeys: Set<string>
  } | null>(null)
  type JumpState = NonNullable<typeof jump>
  /**
   * Keystrokes arrive faster than React re-renders — a typed word is four events in one
   * tick — so the handler reads the jump from here rather than from the render it was
   * created in. Without it every key after the first narrows the *previous* query, and a
   * two-key label typed at speed misses its second key.
   */
  const live = useRef<JumpState | null>(null)

  function enterJump(next: JumpState | null) {
    live.current = next
    setJump(next)
  }

  /**
   * Start a flash-style jump: label every visible target — lane headers and cards
   * in the board, or rows in the list — and wait for the label to be typed.
   */
  function startJump() {
    const targets: JumpTarget[] = []
    if (detail) {
      for (const link of detail.links) {
        targets.push({ key: link.key, lane: false, text: link.key })
      }
    } else if (view !== "board") {
      for (const row of rows) {
        targets.push({ key: row.task.key, lane: false, text: issueText(row.task) })
      }
    } else {
      for (const lane of lanes) {
        if (lane.header) {
          targets.push({ key: lane.key, lane: true, text: laneText(lane) })
        }
        for (const column of lane.columns) {
          for (const card of column) {
            targets.push({ key: card.task.key, lane: false, text: issueText(card.task) })
          }
        }
      }
    }
    if (targets.length === 0) {
      return
    }
    const laneKeys = new Set(targets.filter((t) => t.lane).map((t) => t.key))
    // More targets than label keys: labelling them all would take two keys each, which
    // crowds the glyph slot it sits in — so narrow by typing first (specs/037).
    if (targets.length > INSTANT_LABEL_LIMIT) {
      enterJump({ input: "", search: { query: "", targets }, labels: new Map(), laneKeys })
      return
    }
    const codes = jumpLabels(targets.length)
    const labels = new Map(targets.map((t, i) => [t.key, codes[i]!]))
    enterJump({ input: "", search: null, labels, laneKeys })
  }

  /** Land the cursor on a jumped-to target, then leave jump mode. */
  function executeJump(key: string) {
    if (detail) {
      const link = detail.links.find((l) => l.key === key)
      if (link) {
        detail.setFocus(link.index)
      }
      enterJump(null)
      return
    }
    if (view !== "board") {
      const idx = rows.findIndex((r) => r.task.key === key)
      if (idx >= 0) {
        setListIndex(idx)
      }
    } else if (live.current?.laneKeys.has(key)) {
      const idx = lanes.findIndex((l) => l.key === key)
      if (idx >= 0) {
        setCursor({ lane: idx, column: cursorColumn, row: 0, onHeader: true })
      }
    } else {
      const loc = locate(lanes, key)
      if (loc) {
        setCursor({ ...loc, onHeader: false })
      }
    }
    enterJump(null)
  }

  /** Feed a typed key into an active jump: match a label, narrow, or bail. */
  function handleJumpKey(name: string) {
    if (name === "escape" || name === "return" || name === "enter") {
      enterJump(null)
      return
    }
    const current = live.current
    if (!current) {
      return
    }
    if (current.search) {
      handleSearchKey(current, current.search, name)
      return
    }
    if (name.length !== 1 || !/[a-z]/.test(name)) {
      return
    }
    const next = current.input + name
    let matched: string | undefined
    let anyPrefix = false
    for (const [key, label] of current.labels) {
      if (label === next) {
        matched = key
      }
      if (label.startsWith(next)) {
        anyPrefix = true
      }
    }
    if (matched) {
      executeJump(matched)
    } else if (anyPrefix) {
      enterJump({ ...current, input: next })
    } else {
      enterJump(null)
    }
  }

  /**
   * A key typed into a narrowing jump: a label lands, anything printable narrows, and
   * backspace takes a character back — off an empty query, it leaves.
   */
  function handleSearchKey(
    current: JumpState,
    search: { query: string; targets: JumpTarget[] },
    name: string,
  ) {
    if (name === "backspace") {
      if (search.query === "") {
        enterJump(null)
        return
      }
      narrow(current, search, search.query.slice(0, -1))
      return
    }
    const typed = name === "space" ? " " : name
    if (typed.length !== 1 || !/[a-z0-9 -]/i.test(typed)) {
      return
    }
    const landing = [...current.labels].find(([, label]) => label === typed)
    if (landing) {
      executeJump(landing[0])
      return
    }
    narrow(current, search, search.query + typed)
  }

  /** Apply a new query: the matches it leaves, and a fresh label on each. */
  function narrow(
    current: JumpState,
    search: { query: string; targets: JumpTarget[] },
    query: string,
  ) {
    enterJump({
      input: "",
      search: { ...search, query },
      labels: searchLabels(search.targets, query),
      laneKeys: current.laneKeys,
    })
  }

  // What the prompt says while a jump narrows (specs/037): nothing to show when the
  // board was small enough to label outright.
  const jumpSearch = jump?.search
    ? {
        query: jump.search.query,
        matches: searchMatches(jump.search.targets, jump.search.query).length,
      }
    : null

  return { jump, jumpSearch, startJump, handleJumpKey }
}
