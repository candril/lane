/**
 * Label generation for the flash-style jump (specs/037): assign each visible
 * target a short, easy-to-type key sequence. Home-row keys first so the common
 * (few targets) case is a single comfortable keystroke.
 */

// Home-row and near-home keys first; `s` is omitted — it's the key that starts the
// jump, so reusing it as a label would be confusing.
const JUMP_KEYS = "fjdklaghrueiwotynbvmcxzpq"

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
