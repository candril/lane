/**
 * Candidates for the assignee picker (specs/027). Suggestions come from the people
 * already on the board — instant and offline — plus `me` and `Unassigned`. Anyone
 * not listed can still be assigned by typing their exact display name / email (the
 * picker submits free text verbatim).
 */

import type { Board, Task } from "./types"
import { fuzzyMatches } from "./utils/fuzzy"
import { avatarColor } from "./utils/glyphs"

export interface AssignCandidate {
  /**
   * Passed to the provider to assign — an exact identifier (email/accountId), or
   * the display name when no id is known (the mock), or `null` to unassign.
   */
  value: string | null
  /** Display name, shown in the list and used for the optimistic card update. */
  label: string
  /** Small right-aligned annotation, e.g. how many cards this person holds. */
  detail?: string
  color?: string
  /**
   * A loaded issue this person currently holds, used to resolve their exact
   * `accountId` at assign time and re-check it hasn't gone stale (specs/027).
   * Absent for `me` and `Unassigned`.
   */
  sampleKey?: string
}

/** `me` and `Unassigned` first, then board assignees by descending card count. */
export function assigneeCandidates(board: Board, currentUser?: string): AssignCandidate[] {
  // Track each person by display name, remembering their assign id, card count, and
  // one issue they hold (to resolve their accountId lazily — specs/027).
  const people = new Map<string, { id?: string; count: number; sampleKey: string }>()
  for (const task of board.tasks) {
    if (!task.assignee) {
      continue
    }
    const entry = people.get(task.assignee) ?? {
      id: task.assigneeId,
      count: 0,
      sampleKey: task.key,
    }
    entry.count++
    entry.id ??= task.assigneeId
    people.set(task.assignee, entry)
  }
  const out: AssignCandidate[] = []
  if (currentUser) {
    const id = people.get(currentUser)?.id ?? currentUser
    out.push({ value: id, label: `me (${currentUser})`, color: avatarColor(currentUser) })
  }
  out.push({ value: null, label: "Unassigned" })
  for (const [name, { id, count, sampleKey }] of [...people].sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    if (name === currentUser) {
      continue
    }
    out.push({
      value: id ?? name,
      label: name,
      detail: String(count),
      color: avatarColor(name),
      sampleKey,
    })
  }
  return out
}

/**
 * The candidate `value` standing for an issue's present assignee, for the picker's
 * `current` marker: the accountId when the board knows one, else the display name —
 * the same pair {@link assigneeCandidates} keys on. `null` is Unassigned; `undefined`
 * is "no issue", which marks nothing.
 */
export function currentAssignee(task: Task | undefined): string | null | undefined {
  if (!task) {
    return undefined
  }
  return task.assigneeId ?? task.assignee ?? null
}

/** Fuzzy-narrow the candidates by the typed query (empty query → all). */
export function filterAssignees(candidates: AssignCandidate[], query: string): AssignCandidate[] {
  const q = query.trim()
  return q ? candidates.filter((c) => fuzzyMatches(q, c.label)) : candidates
}
