/**
 * The epics the change-epic picker offers (specs/038), shared by the bottom-bar
 * editor and the palette's submenu.
 */

import type { PickItem } from "./components/Picker"
import type { Task } from "./types"
import { epicColor } from "./utils/glyphs"

/**
 * Every epic the board knows: the epics among its own issues, plus the ones its issues
 * link to — an epic board (specs/034) holds the first kind, an ordinary board mostly the
 * second, and an epic just created holds only the first until something links to it.
 * Deduped by key, an epic's own summary preferred over the name a child reports.
 */
export function epicChoices(tasks: Task[]): PickItem[] {
  const byKey = new Map<string, string>()
  for (const task of tasks) {
    if (task.type === "epic") {
      byKey.set(task.key, task.summary)
    }
  }
  for (const task of tasks) {
    if (task.epicKey && !byKey.has(task.epicKey)) {
      byKey.set(task.epicKey, task.epicName ?? task.epicKey)
    }
  }
  return [...byKey].map(([value, label]) => ({ value, label, color: epicColor(value) }))
}
