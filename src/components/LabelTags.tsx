import { theme } from "../theme"
import { labelColor } from "../utils/glyphs"

/**
 * A card/row's labels as compact colour-coded tags (specs/035). Capped so a
 * heavily-labelled issue can't blow out the layout — the overflow shows as `+N`.
 * Each label keeps a stable hashed colour so a shared label reads as a group.
 * Returns `null` (renders nothing) when there are no labels.
 */
export function LabelTags({
  labels,
  max = 3,
  width,
}: {
  labels?: string[]
  max?: number
  /** Cap the rendered width; a label longer than its column would wrap the row. */
  width?: number
}) {
  if (!labels || labels.length === 0) {
    return null
  }
  const shown = fit(labels.slice(0, max), width)
  const extra = labels.length - shown.length
  return (
    <text>
      {shown.map(({ label, text }, i) => (
        <span key={label} fg={labelColor(label)}>
          {i > 0 ? " " : ""}
          {text}
        </span>
      ))}
      {extra > 0 && <span fg={theme.textMuted}> +{extra}</span>}
    </text>
  )
}

/** Take as many labels as `width` allows, eliding the one that only partly fits. */
function fit(labels: string[], width?: number): { label: string; text: string }[] {
  if (width === undefined) {
    return labels.map((label) => ({ label, text: label }))
  }
  const out: { label: string; text: string }[] = []
  let room = width
  for (const label of labels) {
    const gap = out.length > 0 ? 1 : 0
    if (room - gap < 2) {
      break
    }
    const space = room - gap
    const text = label.length > space ? `${label.slice(0, space - 1)}…` : label
    out.push({ label, text })
    room -= gap + text.length
  }
  return out
}
