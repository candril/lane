import { theme } from "../theme"
import type { IssueType, Priority } from "../types"

/** Column names that mean *parked* rather than in flight, in the usual spellings. */
const HOLD = /hold|block|wait|paus|stall/i

/** The hues a column in flight can take. Cycled, so more columns never wrap onto a
 *  semantic colour. `theme.success` is deliberately absent: green already means "this
 *  is the value you have" in the pickers and the label editor, and a green column
 *  would fight that. */
const IN_FLIGHT = [theme.primary, theme.secondary]

/**
 * Colour for a status badge, by what the column *means*: the first is not-started
 * grey, the last is done — the same grey, since a done row reads from its `✓` and
 * strike-through and shouldn't shout — a parked column is amber, and the ones in
 * flight between them alternate blue/purple.
 *
 * Keying on position alone was the old rule and it wrapped at four columns: a
 * five-column board painted On Hold in the success green and Done in To Do's grey,
 * i.e. exactly backwards.
 */
export function columnColor(index: number, total: number, title?: string): string {
  if (index <= 0 || index >= total - 1) {
    return theme.textDim
  }
  if (title && HOLD.test(title)) {
    return theme.warning
  }
  return IN_FLIGHT[(index - 1) % IN_FLIGHT.length]!
}

/** Fill states between hollow and done, spread across however many columns sit there. */
const PROGRESS = ["◔", "◑", "◕"]

/**
 * Glyph for a column's place in the flow: hollow at the first, a filled check at the
 * last, a fill ramp in between — so three in-flight columns are three shapes rather
 * than one `◐` in three colours (specs/008 checklist rows). A column the board does
 * not hold (a sub-task sitting in a backlog status, `index === -1`) reads as hollow.
 */
export function columnGlyph(index: number, total: number): string {
  if (index <= 0) {
    return "○"
  }
  if (index >= total - 1) {
    return "✓"
  }
  const middle = total - 2
  if (middle === 1) {
    return "◑"
  }
  return PROGRESS[Math.round(((index - 1) * (PROGRESS.length - 1)) / (middle - 1))]!
}

/**
 * The same glyph addressed by column id rather than position — what anything holding a
 * task rather than an index needs (a checklist row, the viewer's status field). Kept
 * beside {@link columnGlyph} so the two can't drift into showing one status as two shapes.
 */
export function statusGlyph(columnId: string, columns: { id: string }[]): string {
  return columnGlyph(
    columns.findIndex((c) => c.id === columnId),
    columns.length,
  )
}

/** A stable soft-pastel chip colour for an assignee, hashed from their name. */
export function avatarColor(name: string): string {
  const palette = theme.avatarPalette
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return palette[Math.abs(hash) % palette.length]!
}

/**
 * A stable chip colour for a label, hashed from its text — shares the avatar
 * palette so labels, assignees, and epic tags read as one visual system, and a
 * given label keeps its colour across every card (specs/035).
 */
export function labelColor(label: string): string {
  return avatarColor(label)
}

/**
 * A stable chip colour for an epic, hashed from its key — shares the avatar palette
 * so cards under the same epic read as a group, consistent with labels and assignees
 * (specs/029).
 */
export function epicColor(epicKey: string): string {
  return avatarColor(epicKey)
}

/** Single-glyph + color for each Jira issue type. */
export function typeGlyph(type: IssueType): { char: string; color: string } {
  switch (type) {
    case "story":
      return { char: "◆", color: theme.success }
    case "bug":
      return { char: "●", color: theme.error }
    case "epic":
      return { char: "❖", color: theme.secondary }
    case "subtask":
      return { char: "▪", color: theme.primary }
    case "task":
    default:
      return { char: "▣", color: theme.primary }
  }
}

/** Priority arrow + color, high priorities pointing up. */
export function priorityGlyph(priority: Priority): { char: string; color: string } {
  switch (priority) {
    case "highest":
      return { char: "⇈", color: theme.error }
    case "high":
      return { char: "↑", color: theme.error }
    case "medium":
      return { char: "→", color: theme.warning }
    case "low":
      return { char: "↓", color: theme.primary }
    case "lowest":
      return { char: "⇊", color: theme.textDim }
  }
}
