import { useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { theme } from "../theme"
import { usePickList } from "../usePickList"
import { labelRows, type LabelChoice } from "../labels"
import { labelColor } from "../utils/glyphs"

interface LabelEditorProps {
  /** Prompt label, e.g. "labels SHOP-1". */
  title: string
  /** The issue's current labels — the initial checked set. */
  current: string[]
  /** All labels seen on the board, with usage counts, offered as toggles. */
  known: LabelChoice[]
  /** Commit the final label set. */
  onSubmit: (labels: string[]) => void
  onCancel: () => void
}

/**
 * Multi-toggle label editor (specs/028): check/uncheck known labels and add new
 * ones in one session, committing on Enter. Owns its working set, query, and
 * keyboard (↑/↓ move, Space toggles / adds the typed label, Enter commits, Esc
 * cancels) so typing only re-renders the editor. App bows out while it's open.
 */
export function LabelEditor({ title, current, known, onSubmit, onCancel }: LabelEditorProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(current))
  const list = usePickList()
  const { query, setQuery } = list

  const rows = useMemo(
    () => labelRows(known, current, selected, query),
    [known, current, selected, query],
  )
  const { active, navigate } = list.rows(rows.length)

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }

  function activate() {
    const row = rows[active]
    if (!row) {
      return
    }
    if (row.add) {
      setSelected((prev) => new Set(prev).add(row.value))
      setQuery("")
    } else {
      toggle(row.value)
    }
  }

  useKeyboard((key) => {
    const name = key.name?.toLowerCase() ?? ""
    if (navigate(name, !!key.ctrl)) {
      key.preventDefault()
    } else if (name === "space") {
      // Labels never contain spaces, so Space is free to mean "toggle".
      activate()
      key.preventDefault()
    } else if (name === "return" || name === "enter") {
      // Committing straight from the typed "add" row folds that new label in, so
      // `type a label + Enter` creates it without a separate Space to toggle first.
      const row = rows[active]
      const final = new Set(selected)
      if (row?.add) {
        final.add(row.value)
      }
      onSubmit([...final])
      key.preventDefault()
    } else if (name === "escape") {
      onCancel()
      key.preventDefault()
    }
  })

  return (
    <box flexDirection="column" flexShrink={0}>
      {rows.length > 0 && (
        <box flexDirection="column" backgroundColor={theme.columnBg} paddingX={1}>
          {rows.map((row, i) => {
            const on = i === active
            const checked = row.add ? false : selected.has(row.value)
            return (
              <box
                key={`${row.add ? "+" : ""}${row.value}`}
                flexDirection="row"
                backgroundColor={on ? theme.cardBgFocused : undefined}
              >
                <text fg={checked ? theme.success : theme.textMuted}>
                  {row.add ? "＋ " : checked ? "◉ " : "○ "}
                </text>
                <text fg={row.add ? theme.warning : labelColor(row.value)}>
                  {row.add ? `add "${row.value}"` : row.value}
                </text>
                <box flexGrow={1} />
                {!row.add && row.count! > 0 && <text fg={theme.textMuted}> {row.count}</text>}
              </box>
            )
          })}
        </box>
      )}

      <box flexDirection="row" backgroundColor={theme.headerBg} paddingX={1}>
        <text fg={theme.warning}>{title} ▸ </text>
        <box flexGrow={1}>
          <input
            width="100%"
            focused
            value={query}
            placeholder="filter or add a label…"
            onInput={setQuery}
          />
        </box>
        <text fg={theme.textMuted}> ↑↓ · space toggle · enter save · esc</text>
      </box>
    </box>
  )
}
