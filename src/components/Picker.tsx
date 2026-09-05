import { useMemo } from "react"
import { useKeyboard } from "@opentui/react"
import { theme } from "../theme"
import { usePickList } from "../usePickList"
import { fuzzyMatches } from "../utils/fuzzy"

export interface PickItem {
  /** Passed to `onSelect` when chosen. `null` is a valid choice (e.g. "unassign"). */
  value: string | null
  label: string
  /** Small right-aligned annotation (e.g. a count). */
  detail?: string
  color?: string
}

interface PickerProps<T extends PickItem> {
  /** Prompt label, e.g. "assign SHOP-1". */
  title: string
  /** Full candidate list; the picker fuzzy-narrows it by the typed query. */
  items: T[]
  /**
   * The field's value today, matched against `item.value` — marked `◉` and where the
   * highlight starts, so the picker opens on what is set rather than on the top of the
   * list. `undefined` means "no current value to mark"; `null` marks a `null` item
   * (Unassigned, "(no epic)").
   */
  current?: string | null
  /**
   * The chosen candidate, or `null` with the free-typed text when nothing matches.
   * The caller decides what a free-typed value means (the mock assigns it verbatim;
   * Jira refuses it — specs/027).
   */
  onSelect: (chosen: T | null, typed: string) => void
  onCancel: () => void
  placeholder?: string
}

/**
 * A bottom pick-one overlay (specs/027): a fuzzy list over a query field. It owns
 * its query + highlight and its own keyboard (↑/↓, Enter, Esc), so typing only
 * re-renders the picker — not the whole board. A query that matches no candidate is
 * handed back as free text for the caller to accept or reject.
 * Reused across field pickers (assignee, epic, status), which pass `current` so the
 * field's present value is marked and highlighted first.
 */
export function Picker<T extends PickItem>({
  title,
  items,
  current,
  onSelect,
  onCancel,
  placeholder,
}: PickerProps<T>) {
  const marked = current !== undefined && items.some((i) => i.value === current)
  const list = usePickList(
    Math.max(
      0,
      items.findIndex((i) => i.value === current),
    ),
  )
  const { query, setQuery } = list
  const filtered = useMemo(
    () => (query.trim() ? items.filter((i) => fuzzyMatches(query, i.label)) : items),
    [items, query],
  )
  const { active, navigate } = list.rows(filtered.length)

  function submit() {
    const chosen = filtered[active]
    if (chosen) {
      onSelect(chosen, chosen.label)
    } else if (query.trim()) {
      onSelect(null, query.trim())
    } else {
      onCancel()
    }
  }

  // The board's global handler bows out while a picker is open (App returns early
  // on `assigning`), so this owns navigation; typing falls through to the input.
  useKeyboard((key) => {
    const name = key.name?.toLowerCase() ?? ""
    if (navigate(name, !!key.ctrl)) {
      key.preventDefault()
    } else if (name === "escape") {
      onCancel()
      key.preventDefault()
    }
  })

  return (
    <box flexDirection="column" flexShrink={0}>
      {filtered.length > 0 && (
        <box flexDirection="column" backgroundColor={theme.columnBg} paddingX={1}>
          {filtered.map((item, i) => {
            const on = i === active
            return (
              <box
                key={`${item.value ?? "∅"}:${item.label}`}
                flexDirection="row"
                backgroundColor={on ? theme.cardBgFocused : undefined}
              >
                {marked && <text fg={theme.success}>{item.value === current ? "◉ " : "  "}</text>}
                <text fg={item.color ?? (on ? theme.text : theme.textDim)}>{item.label}</text>
                <box flexGrow={1} />
                {item.detail && <text fg={theme.textMuted}> {item.detail}</text>}
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
            placeholder={placeholder}
            onInput={setQuery}
            onSubmit={submit}
          />
        </box>
        <text fg={theme.textMuted}> ↑↓ · enter · esc</text>
      </box>
    </box>
  )
}
