import { theme } from "../theme"
import type { SubtaskScope, Suggestion } from "../filter"

interface FilterBarProps {
  query: string
  onQueryChange: (value: string) => void
  suggestions: Suggestion[]
  /** Index of the highlighted suggestion (Tab/Enter accepts it). */
  activeSuggestion: number
  visible: number
  total: number
  /** Editing (input focused, suggestions shown) vs just displaying the applied filter. */
  active: boolean
  /** `inherit` keeps a match's sub-tasks; flagged in the bar so the count adds up (specs/043). */
  subtaskScope?: SubtaskScope
}

/**
 * Bottom filter bar (specs/020): a live query field with a completion list
 * stacked above it. It stays visible while a filter is applied; when not being
 * edited it's a read-only readout. Navigation (↑/↓, Ctrl-P/N, Tab, Esc) is driven
 * by App's keyboard owner, which runs ahead of this focused input.
 */
export function FilterBar({
  query,
  onQueryChange,
  suggestions,
  activeSuggestion,
  visible,
  total,
  active,
  subtaskScope,
}: FilterBarProps) {
  const narrowed = visible !== total
  const hint = active ? "↑↓ ^y/tab · esc" : "/ edit · ⌫ clear"

  return (
    // Never let the scrollbox above squeeze the bar — it must keep its full
    // height (suggestions + input), so the board shrinks instead.
    <box flexDirection="column" flexShrink={0}>
      {active && suggestions.length > 0 && (
        <box flexDirection="column" backgroundColor={theme.columnBg} paddingX={1}>
          {suggestions.map((s, i) => {
            const on = i === activeSuggestion
            return (
              <box
                key={s.insert}
                flexDirection="row"
                backgroundColor={on ? theme.cardBgFocused : undefined}
              >
                <text fg={s.color ?? (on ? theme.text : theme.textDim)}>{s.label}</text>
                <box flexGrow={1} />
                {s.detail && <text fg={theme.textMuted}>{s.detail}</text>}
              </box>
            )
          })}
        </box>
      )}

      <box flexDirection="row" backgroundColor={theme.headerBg} paddingX={1}>
        <text fg={active ? theme.warning : theme.textDim}>/ </text>
        <box flexGrow={1}>
          <input
            width="100%"
            focused={active}
            value={query}
            placeholder="type:bug @me is:review  text…"
            onInput={onQueryChange}
          />
        </box>
        {subtaskScope === "inherit" && <text fg={theme.secondary}> ↳ subs</text>}
        <text fg={narrowed ? theme.warning : theme.textMuted}>
          {" "}
          {narrowed ? `${total} → ${visible}` : `${total}`}
          <span fg={theme.textMuted}>{`  ${hint}`}</span>
        </text>
      </box>
    </box>
  )
}
