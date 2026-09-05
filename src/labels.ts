/**
 * Rows for the label editor (specs/028), shared by the bottom-bar editor and the
 * command palette's labels submenu (specs/010) so both offer the same universe, the
 * same order, and the same "add what you typed" affordance.
 */

import { fuzzyMatches } from "./utils/fuzzy"

export interface LabelChoice {
  value: string
  count: number
}

export interface LabelRow {
  /** The "＋ add …" row for a label that doesn't exist yet; always sorts first. */
  add: boolean
  value: string
  count?: number
}

/** Jira labels can't contain whitespace; fold spaces to underscores. */
export function sanitize(raw: string): string {
  return raw.trim().replace(/\s+/g, "_")
}

/**
 * The togglable rows for an issue: every label the board knows, plus the ones the
 * issue already carries and any added this session — so a freshly-added or
 * already-set label stays visible and toggleable — narrowed by `query`, most-used
 * first, with an "add" row when the typed text matches nothing.
 */
export function labelRows(
  known: LabelChoice[],
  current: string[],
  selected: Set<string>,
  query: string,
): LabelRow[] {
  const counts = new Map(known.map((k) => [k.value, k.count]))
  const names = new Set<string>([...known.map((k) => k.value), ...current, ...selected])
  const universe = [...names]
    .map((value) => ({ value, count: counts.get(value) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  const filtered = query.trim() ? universe.filter((c) => fuzzyMatches(query, c.value)) : universe
  const typed = sanitize(query)
  const canAdd =
    typed.length > 0 && !universe.some((c) => c.value.toLowerCase() === typed.toLowerCase())

  return [
    ...(canAdd ? [{ add: true, value: typed }] : []),
    ...filtered.map((c) => ({ add: false, value: c.value, count: c.count })),
  ]
}
