import { useState } from "react"
import type { SubmenuKind } from "./commands/types"

/**
 * Which field the palette has descended into, and — for labels, the one multi-select
 * field — the working set being toggled. Held here rather than in the component so
 * backing out with Esc discards it, and so the commit path is the same
 * `submitLabels(key, labels)` the bottom-bar editor calls.
 */
export type PaletteSubmenu =
  | { kind: Exclude<SubmenuKind, "labels">; keys: string[] }
  | { kind: "labels"; keys: string[]; selected: Set<string> }

/** Palette open state and its one level of descent (specs/010). */
export function usePalette() {
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<PaletteSubmenu | null>(null)

  function close() {
    setOpen(false)
    setSubmenu(null)
  }

  return {
    open,
    submenu,
    openPalette: () => setOpen(true),
    close,
    /** Descend into a field over these issues (specs/056: one, or the whole selection).
     * `seed` is the current label set for the labels submenu. */
    descend(kind: SubmenuKind, keys: string[], seed: string[] = []) {
      setSubmenu(kind === "labels" ? { kind, keys, selected: new Set(seed) } : { kind, keys })
    },
    /** Esc out of a submenu, back to the command list, discarding any working set. */
    back: () => setSubmenu(null),
    toggleLabel(value: string) {
      setSubmenu((current) => {
        if (current?.kind !== "labels") {
          return current
        }
        const selected = new Set(current.selected)
        if (!selected.delete(value)) {
          selected.add(value)
        }
        return { ...current, selected }
      })
    },
  }
}
