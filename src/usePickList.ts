import { useState } from "react"

/**
 * Query + highlight state for a filtered list overlay — the assignee/epic/status
 * picker, the label editor, and the command palette all run on this (specs/010).
 *
 * It deliberately does *not* own the rows: each surface builds its own (the label
 * editor interleaves an "add" row, the palette interleaves category headers), and a
 * hook that tried to own both would end up parameterised into uselessness. What was
 * duplicated three times — clamping the highlight to a list that shrinks as you type,
 * resetting to the top on every keystroke, and the ↑/↓ + ctrl-p/n bindings — lives
 * here. The row count reaches it through {@link PickList.rows}, since the caller can
 * only filter once it has the query this hook owns.
 */
export function usePickList(initialIndex = 0) {
  const [query, setQueryRaw] = useState("")
  const [index, setIndex] = useState(initialIndex)

  function setQuery(value: string) {
    // A no-op edit must not move the highlight: the input echoes its value back when
    // it is reset programmatically, which would otherwise undo a caller that positions
    // the highlight (the palette opens a submenu on the field's current value).
    if (value === query) {
      return
    }
    setQueryRaw(value)
    setIndex(0)
  }

  /** Highlight + navigation over `count` rows, whatever the caller filtered down to. */
  function rows(count: number) {
    const active = Math.min(index, Math.max(0, count - 1))
    return {
      active,
      /** Move the highlight if `name` is a navigation key; report whether it was one. */
      navigate(name: string, ctrl: boolean): boolean {
        if (name === "up" || (ctrl && name === "p")) {
          setIndex(Math.max(0, active - 1))
          return true
        }
        if (name === "down" || (ctrl && name === "n")) {
          setIndex(Math.min(count - 1, active + 1))
          return true
        }
        return false
      },
    }
  }

  return { query, setQuery, setIndex, rows }
}

export type PickList = ReturnType<typeof usePickList>
