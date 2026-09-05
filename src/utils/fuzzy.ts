/**
 * A tiny fuzzy subsequence matcher, shared by the filter bar (specs/020) and,
 * later, the command palette (specs/010). Greedy first-match rather than optimal
 * alignment — cheap and predictable, which is what a live filter wants.
 */

export interface FuzzyResult {
  score: number
  /** Indices into `target` that matched, in order — for highlighting. */
  positions: number[]
}

const SEPARATOR = /[\s\-_/.:]/

/**
 * Case-insensitive: do `query`'s characters appear in order within `target`?
 * Returns null when they don't. Score rewards matches at word starts and
 * consecutive runs, so "ip" scores "In Progress" above a scattered hit; an empty
 * query matches everything with score 0.
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  if (query === "") {
    return { score: 0, positions: [] }
  }
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const positions: number[] = []
  let score = 0
  let qi = 0
  let prev = -2
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      continue
    }
    const before = ti > 0 ? target[ti - 1]! : " "
    const camel = /[a-z]/.test(before) && /[A-Z]/.test(target[ti]!)
    const boundary = ti === 0 || SEPARATOR.test(before) || camel
    let bonus = 1
    if (boundary) {
      bonus += 3
    }
    if (ti === prev + 1) {
      bonus += 2
    }
    score += bonus
    positions.push(ti)
    prev = ti
    qi++
  }
  if (qi < q.length) {
    return null
  }
  // Nudge tighter targets ahead when the raw score ties.
  return { score: score - target.length * 0.01, positions }
}

/** Convenience: does `query` fuzzy-match `target` at all? */
export function fuzzyMatches(query: string, target: string): boolean {
  return fuzzyMatch(query, target) !== null
}
