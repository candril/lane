/**
 * Restore-where-you-left-off session state (specs/033). A small JSON file records the
 * active tab and each tab's projection (mode, filter, grouping, tag visibility —
 * specs/045), so relaunching `lane` drops you back in the same place. The
 * cursor is deliberately not restored — board contents shift between sessions, so it
 * starts at the top.
 *
 * Written debounced on change (not on exit — a crash still keeps the last state),
 * validated with a fallback to defaults on load. Every read/write is best-effort.
 */

import { homedir } from "os"
import { join } from "path"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import type { Projection } from "./tabs"
import type { SubtaskScope } from "./filter"

export interface SessionState {
  /** Id of the active tab (specs/016) — an id, not an index, since tabs come and go. */
  activeTabId: string
  /**
   * Each tab's last projection, by tab id (specs/045) — mode, filter, grouping and tag
   * visibility. Unknown ids are ignored on load.
   */
  projections: Record<string, Projection>
  /** How the filter treats sub-tasks (specs/043). */
  subtaskScope: SubtaskScope
}

function stateFile(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache")
  return join(base, "lane", "state.json")
}

/** The persisted session, or null when absent/unreadable. Fields are validated by the caller. */
export function readSession(): Partial<SessionState> | null {
  try {
    if (!existsSync(stateFile())) {
      return null
    }
    return JSON.parse(readFileSync(stateFile(), "utf8")) as Partial<SessionState>
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Persist the session, debounced ~500 ms so rapid changes coalesce into one write. */
export function saveSession(state: SessionState): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const dir = join(stateFile(), "..")
      mkdirSync(dir, { recursive: true })
      writeFileSync(stateFile(), JSON.stringify(state, null, 2))
    } catch {
      // Non-fatal: losing session state only means next launch starts at defaults.
    }
  }, 500)
}
