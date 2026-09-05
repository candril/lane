import { useState } from "react"

/** Which issue the summary rename is open for, plus its in-flight submit state (specs/012). */
export interface Editing {
  key: string
  current: string
  submitting: boolean
  error?: string
}

/**
 * The modal overlays that own the keyboard while open. App holds only which issue
 * each is targeting; the pickers/editors own their own query and highlight state so
 * typing in them doesn't re-render the board. The mutation hook reads and clears
 * these handles on submit.
 */
export function useDialogs() {
  // The field pickers carry every issue they will write (specs/056): one key from the
  // cursor, or the whole multi-select. The picker UI is identical either way.
  const [editing, setEditing] = useState<Editing | null>(null)
  const [assigning, setAssigning] = useState<{ keys: string[] } | null>(null)
  const [labeling, setLabeling] = useState<{ keys: string[] } | null>(null)
  const [epicing, setEpicing] = useState<{ keys: string[] } | null>(null)
  const [statusing, setStatusing] = useState<{ keys: string[] } | null>(null)
  // Picking the reason a close carries (specs/053) — `closing` says whether choosing
  // will also transition (any of) the issues, so the prompt can name what it does.
  const [resolving, setResolving] = useState<{ keys: string[]; closing: boolean } | null>(null)
  // Naming a tab — a fresh clone or a rename (specs/045).
  const [namingTab, setNamingTab] = useState<{ id: string; current: string } | null>(null)
  const [filtering, setFiltering] = useState(false)
  // The keyboard-shortcut dialog (specs/011), toggled with `?`.
  const [showHelp, setShowHelp] = useState(false)

  return {
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
  }
}
