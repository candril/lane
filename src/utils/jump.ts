/**
 * Label generation for the flash-style jump (specs/037): assign each visible
 * target a short, easy-to-type key sequence. Home-row keys first so the common
 * (few targets) case is a single comfortable keystroke.
 */

// Home-row and near-home keys first; `s` is omitted — it's the key that starts the
// jump, so reusing it as a label would be confusing.
const JUMP_KEYS = "fjdklaghrueiwotynbvmcxzpq"

/**
 * A jump target: what the cursor can land on, and the text a search narrows by
 * (specs/037) — an issue's key and summary, or a lane header's label.
 */
export interface JumpTarget {
  key: string
  lane: boolean
  text: string
}

/**
 * Up to this many targets, every one gets its own single-key label at once. Past it
 * the labels would all have to be two keys, which crowds the glyph slot they sit in
 * and reads as noise — so a dense board narrows by typing first (specs/037).
 */
export const INSTANT_LABEL_LIMIT = JUMP_KEYS.length

/**
 * The labels for a search-narrowed jump: the targets whose text contains `query`, each
 * given a single key.
 *
 * A key that could *continue* the query is never used as a label, so every keystroke is
 * unambiguously one or the other — type on to narrow, or press a label to land. Matches
 * past the alphabet stay unlabelled rather than growing a second character: narrowing
 * one more key is cheaper to read than a two-key label on everything.
 */
export function searchMatches(targets: JumpTarget[], query: string): JumpTarget[] {
  if (query === "") {
    return []
  }
  const needle = query.toLowerCase()
  return targets.filter((t) => t.text.toLowerCase().includes(needle))
}

export function searchLabels(targets: JumpTarget[], query: string): Map<string, string> {
  const labels = new Map<string, string>()
  const needle = query.toLowerCase()
  const matches = searchMatches(targets, query)
  // Every place the query occurs, not just the first in each target: "su" sits inside
  // "summary" as well as at the head of a key, and a label on either of those keys
  // would eat the keystroke that was meant to narrow.
  const continuations = new Set<string>()
  for (const match of matches) {
    const text = match.text.toLowerCase()
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
      continuations.add(text[at + needle.length] ?? "")
    }
  }
  const available = [...JUMP_KEYS].filter((key) => !continuations.has(key))
  matches.forEach((match, at) => {
    const label = available[at]
    if (label) {
      labels.set(match.key, label)
    }
  })
  return labels
}

/**
 * Distinct labels for `count` targets, in assignment order. All labels share one
 * length — single chars when they fit, otherwise two-char combos — so no label is a
 * prefix of another and typing is never ambiguous.
 */
export function jumpLabels(count: number): string[] {
  const keys = JUMP_KEYS
  if (count <= 0) {
    return []
  }
  if (count <= keys.length) {
    return keys.slice(0, count).split("")
  }
  const out: string[] = []
  for (const a of keys) {
    for (const b of keys) {
      out.push(a + b)
      if (out.length === count) {
        return out
      }
    }
  }
  return out
}
