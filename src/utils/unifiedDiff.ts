/**
 * A unified diff of two texts, line by line — the format OpenTUI's `<diff>` element
 * renders (specs/058). One hunk covering both texts whole: the inputs are issue
 * descriptions, short enough that context trimming would only cost readers the
 * paragraphs around a change.
 */
export function unifiedDiff(from: string, to: string, name = "text"): string {
  const a = from === "" ? [] : from.split("\n")
  const b = to === "" ? [] : to.split("\n")
  const n = a.length
  const m = b.length
  // Longest common subsequence by length, built from the end so the walk below can
  // read `lcs[i][j]` as "how much of a[i..] and b[j..] still matches".
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const lines: string[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      lines.push(` ${a[i]}`)
      i++
      j++
    } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      // On a tie the removal goes first — a diff reads "this became that".
      lines.push(`-${a[i]}`)
      i++
    } else {
      lines.push(`+${b[j]}`)
      j++
    }
  }
  const hunk = `@@ -${n === 0 ? 0 : 1},${n} +${m === 0 ? 0 : 1},${m} @@`
  return [`--- a/${name}`, `+++ b/${name}`, hunk, ...lines].join("\n")
}
