import { useState, type Dispatch, type SetStateAction } from "react"
import { locate, type Lane, type ListRow } from "./grouping"
import { jumpLabels } from "./utils/jump"
import type { Cursor } from "./useBoardCursor"
import type { TabMode } from "./tabs"

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
    input: string
    labels: Map<string, string>
    laneKeys: Set<string>
  } | null>(null)

  /**
   * Start a flash-style jump: label every visible target — lane headers and cards
   * in the board, or rows in the list — and wait for the label to be typed.
   */
  function startJump() {
    const targets: { key: string; lane: boolean }[] = []
    if (detail) {
      for (const link of detail.links) {
        targets.push({ key: link.key, lane: false })
      }
    } else if (view !== "board") {
      for (const row of rows) {
        targets.push({ key: row.task.key, lane: false })
      }
    } else {
      for (const lane of lanes) {
        if (lane.header) {
          targets.push({ key: lane.key, lane: true })
        }
        for (const column of lane.columns) {
          for (const card of column) {
            targets.push({ key: card.task.key, lane: false })
          }
        }
      }
    }
    if (targets.length === 0) {
      return
    }
    const codes = jumpLabels(targets.length)
    const labels = new Map<string, string>()
    const laneKeys = new Set<string>()
    targets.forEach((t, i) => {
      labels.set(t.key, codes[i]!)
      if (t.lane) {
        laneKeys.add(t.key)
      }
    })
    setJump({ input: "", labels, laneKeys })
  }

  /** Land the cursor on a jumped-to target, then leave jump mode. */
  function executeJump(key: string) {
    if (detail) {
      const link = detail.links.find((l) => l.key === key)
      if (link) {
        detail.setFocus(link.index)
      }
      setJump(null)
      return
    }
    if (view !== "board") {
      const idx = rows.findIndex((r) => r.task.key === key)
      if (idx >= 0) {
        setListIndex(idx)
      }
    } else if (jump?.laneKeys.has(key)) {
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
    setJump(null)
  }

  /** Feed a typed key into an active jump: match a label, narrow, or bail. */
  function handleJumpKey(name: string) {
    if (name === "escape") {
      setJump(null)
      return
    }
    if (name.length !== 1 || !/[a-z]/.test(name) || !jump) {
      return
    }
    const next = jump.input + name
    let matched: string | undefined
    let anyPrefix = false
    for (const [key, label] of jump.labels) {
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
      setJump({ ...jump, input: next })
    } else {
      setJump(null)
    }
  }

  return { jump, startJump, handleJumpKey }
}
