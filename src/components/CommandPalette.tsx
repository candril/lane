import { useEffect, useMemo, useRef } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { theme } from "../theme"
import { usePickList } from "../usePickList"
import { labelRows, type LabelChoice } from "../labels"
import { fuzzyMatches } from "../utils/fuzzy"
import { labelColor } from "../utils/glyphs"
import {
  CATEGORY_ORDER,
  type Command,
  type CommandCategory,
  type SubmenuKind,
} from "../commands/types"
import type { PickItem } from "./Picker"

/**
 * What the palette shows instead of the command list once a field command is chosen
 * (specs/010). The pick kinds render the same candidates as the bottom-bar
 * {@link Picker}; `labels` renders the same rows as the bottom-bar editor, with a
 * working set that lives above this component so Esc can discard it.
 */
export type SubmenuView =
  | {
      kind: Exclude<SubmenuKind, "labels">
      title: string
      items: PickItem[]
      /** The field's value today — marked `◉` and highlighted first. */
      current?: string | null
    }
  | {
      kind: "labels"
      title: string
      known: LabelChoice[]
      /** The issue's labels as stored, for the row universe. */
      current: string[]
      /** The working set, toggled with Space and committed with Enter. */
      selected: Set<string>
    }

interface CommandPaletteProps {
  commands: Command[]
  /** Null in command mode; a field's candidates once a submenu is open. */
  submenu: SubmenuView | null
  /** A command with no submenu was chosen — run it and close. */
  onRun: (command: Command) => void
  /** A command with a submenu was chosen — descend, keeping the palette open. */
  onDescend: (kind: SubmenuKind) => void
  onPick: (item: PickItem) => void
  onToggleLabel: (value: string) => void
  onCommitLabels: (labels: string[]) => void
  /** Esc in a submenu: back to the command list. */
  onBack: () => void
  /** Esc in the command list: close. */
  onClose: () => void
}

/** Where the highlight sits on open: a field's present value, else the top. */
function startIndex(submenu: SubmenuView | null): number {
  if (!submenu || submenu.kind === "labels") {
    return 0
  }
  return Math.max(
    0,
    submenu.items.findIndex((i) => i.value === submenu.current),
  )
}

/** One selectable line, plus the headers and blank lines between sections. */
type Row =
  | { kind: "header"; text: string }
  | { kind: "spacer" }
  | { kind: "command"; at: number; command: Command }
  | { kind: "pick"; at: number; item: PickItem; marked: boolean }
  | { kind: "label"; at: number; value: string; add: boolean; count?: number; checked: boolean }

const CATEGORY_LABEL: Record<CommandCategory, string> = {
  issue: "Issue",
  view: "View",
  board: "Board",
  tabs: "Tabs",
  app: "General",
}

/** Group the commands into sections in {@link CATEGORY_ORDER}, numbering the selectable rows. */
function commandRows(commands: Command[]): { rows: Row[]; count: number } {
  const groups = new Map<CommandCategory, Command[]>()
  for (const command of commands) {
    groups.set(command.category, [...(groups.get(command.category) ?? []), command])
  }
  const rows: Row[] = []
  let at = 0
  for (const category of CATEGORY_ORDER) {
    const group = groups.get(category)
    if (!group?.length) {
      continue
    }
    if (rows.length > 0) {
      rows.push({ kind: "spacer" })
    }
    rows.push({ kind: "header", text: CATEGORY_LABEL[category] })
    for (const command of group) {
      rows.push({ kind: "command", at: at++, command })
    }
  }
  return { rows, count: at }
}

function submenuRows(view: SubmenuView, query: string): { rows: Row[]; count: number } {
  if (view.kind === "labels") {
    const rows = labelRows(view.known, view.current, view.selected, query).map((row, at) => ({
      kind: "label" as const,
      at,
      value: row.value,
      add: row.add,
      count: row.count,
      checked: !row.add && view.selected.has(row.value),
    }))
    return { rows, count: rows.length }
  }
  const items = query.trim() ? view.items.filter((i) => fuzzyMatches(query, i.label)) : view.items
  const rows = items.map((item, at) => ({
    kind: "pick" as const,
    at,
    item,
    marked: view.current !== undefined && item.value === view.current,
  }))
  return { rows, count: rows.length }
}

/**
 * The `Ctrl+P` command palette (specs/010): a centered overlay listing every action
 * valid right now, with its direct key alongside. Choosing a field command descends
 * into a submenu *in place* — the palette stays open and Esc backs out one level —
 * so "set status" is two keystrokes rather than a hunt for the binding.
 *
 * It owns its query, highlight and keyboard, like the other overlays, so typing here
 * doesn't re-render the board.
 */
export function CommandPalette({
  commands,
  submenu,
  onRun,
  onDescend,
  onPick,
  onToggleLabel,
  onCommitLabels,
  onBack,
  onClose,
}: CommandPaletteProps) {
  // Mounted fresh per mode (the caller keys it), so the highlight starts on the field's
  // present value and the query starts empty — no reset effect racing the input.
  const list = usePickList(startIndex(submenu))
  const { query, setQuery } = list
  const { height: terminalHeight } = useTerminalDimensions()
  const scrollRef = useRef<ScrollBoxRenderable>(null)

  // Fixed rows: title (1) + input (1) + the container's vertical padding (2).
  const modalHeight = Math.max(8, Math.floor(terminalHeight * 0.6))
  const listHeight = modalHeight - 4

  const { rows, count } = useMemo(
    () =>
      submenu
        ? submenuRows(submenu, query)
        : commandRows(
            query.trim() ? commands.filter((c) => fuzzyMatches(query, c.label)) : commands,
          ),
    [submenu, commands, query],
  )
  const { active, navigate } = list.rows(count)

  // Rows are one line each, so the visual row *is* the index into `rows`.
  useEffect(() => {
    const box = scrollRef.current
    if (!box) {
      return
    }
    const visual = rows.findIndex((r) => "at" in r && r.at === active)
    if (visual < 0) {
      return
    }
    const viewport = box.viewport?.height ?? listHeight
    const top = box.scrollTop
    if (visual < top) {
      box.scrollTo(visual)
    } else if (visual >= top + viewport) {
      box.scrollTo(Math.min(visual - viewport + 1, Math.max(0, rows.length - viewport)))
    }
  }, [active, rows, listHeight])

  function activate() {
    const row = rows.find((r) => "at" in r && r.at === active)
    if (!row) {
      // Enter on an empty label filter still creates what you typed.
      if (submenu?.kind === "labels") {
        onCommitLabels([...submenu.selected])
      }
      return
    }
    if (row.kind === "command") {
      return row.command.submenu ? onDescend(row.command.submenu) : onRun(row.command)
    }
    if (row.kind === "pick") {
      return onPick(row.item)
    }
    if (row.kind === "label" && submenu?.kind === "labels") {
      // Enter straight from the "add" row folds the new label into the commit, the
      // same shortcut the bottom-bar editor allows.
      const final = new Set(submenu.selected)
      if (row.add) {
        final.add(row.value)
      }
      onCommitLabels([...final])
    }
  }

  useKeyboard((key) => {
    const name = key.name?.toLowerCase() ?? ""
    if (navigate(name, !!key.ctrl)) {
      key.preventDefault()
      return
    }
    if (name === "escape") {
      if (submenu) {
        onBack()
      } else {
        onClose()
      }
      key.preventDefault()
      return
    }
    if (name === "return" || name === "enter") {
      activate()
      key.preventDefault()
      return
    }
    // Space toggles only where a label can't contain one; elsewhere it is typing.
    if (name === "space" && submenu?.kind === "labels") {
      const row = rows.find((r) => "at" in r && r.at === active)
      if (row?.kind === "label") {
        onToggleLabel(row.value)
        if (row.add) {
          setQuery("")
        }
      }
      key.preventDefault()
      return
    }
    // Ctrl+P again closes, so the key that opens it also dismisses it.
    if (key.ctrl && name === "p" && !submenu) {
      onClose()
      key.preventDefault()
    }
  })

  const hint = submenu
    ? submenu.kind === "labels"
      ? "space toggle · enter save · esc back"
      : "enter · esc back"
    : "enter · esc"

  return (
    <box position="absolute" width="100%" height="100%" alignItems="center" zIndex={100}>
      <box
        marginTop={2}
        width="60%"
        height={modalHeight}
        flexDirection="column"
        backgroundColor={theme.modalBg}
        paddingX={2}
        paddingY={1}
      >
        <box flexDirection="row">
          <text fg={theme.primary}>{submenu ? submenu.title : "Commands"}</text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>{hint}</text>
        </box>
        <input
          width="100%"
          focused
          value={query}
          placeholder={submenu ? "filter…" : "run a command…"}
          onInput={setQuery}
        />
        {count === 0 ? (
          <text fg={theme.textMuted}>no matches</text>
        ) : (
          <scrollbox ref={scrollRef} height={listHeight}>
            {rows.map((row, i) => (
              <PaletteRow
                key={rowKey(row, i)}
                row={row}
                selected={"at" in row && row.at === active}
              />
            ))}
          </scrollbox>
        )}
      </box>
    </box>
  )
}

function rowKey(row: Row, i: number): string {
  switch (row.kind) {
    case "command":
      return row.command.id
    case "pick":
      return `${row.item.value ?? "∅"}:${row.item.label}`
    case "label":
      return `${row.add ? "+" : ""}${row.value}`
    default:
      return `${row.kind}-${i}`
  }
}

function PaletteRow({ row, selected }: { row: Row; selected: boolean }) {
  if (row.kind === "spacer") {
    return <box height={1} />
  }
  if (row.kind === "header") {
    return <text fg={theme.secondary}>{row.text}</text>
  }
  const bg = selected ? theme.cardBgFocused : undefined
  if (row.kind === "command") {
    return (
      <box flexDirection="row" backgroundColor={bg} paddingLeft={1}>
        <text fg={selected ? theme.text : theme.textDim}>{row.command.label}</text>
        <box flexGrow={1} />
        {row.command.shortcut && <text fg={theme.textMuted}>{row.command.shortcut}</text>}
      </box>
    )
  }
  if (row.kind === "pick") {
    return (
      <box flexDirection="row" backgroundColor={bg} paddingLeft={1}>
        <text fg={theme.success}>{row.marked ? "◉ " : "  "}</text>
        <text fg={row.item.color ?? (selected ? theme.text : theme.textDim)}>{row.item.label}</text>
        <box flexGrow={1} />
        {row.item.detail && <text fg={theme.textMuted}>{row.item.detail}</text>}
      </box>
    )
  }
  return (
    <box flexDirection="row" backgroundColor={bg} paddingLeft={1}>
      <text fg={row.checked ? theme.success : theme.textMuted}>
        {row.add ? "＋ " : row.checked ? "◉ " : "○ "}
      </text>
      <text fg={row.add ? theme.warning : labelColor(row.value)}>
        {row.add ? `add "${row.value}"` : row.value}
      </text>
      <box flexGrow={1} />
      {!row.add && !!row.count && <text fg={theme.textMuted}>{row.count}</text>}
    </box>
  )
}
