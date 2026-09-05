import { theme } from "../theme"
import { avatarColor } from "../utils/glyphs"

/** `paddingX` on both sides of two initials — the slot every avatar has to fill. */
const CHIP_WIDTH = 4

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const chars =
    parts.length >= 2
      ? (parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")
      : name.slice(0, 2)
  return chars.toUpperCase()
}

/**
 * Assignee avatar: an initials chip when assigned, a blank cell of the same width
 * when not — the rows in a list are right-aligned, so a narrower "unassigned" would
 * drag that row's whole tail out of line with its neighbours, and a placeholder
 * glyph is noise the blank already communicates.
 */
export function Avatar({ name }: { name?: string }) {
  if (!name) {
    return <box width={CHIP_WIDTH} height={1} alignSelf="flex-start" />
  }
  return (
    // height + alignSelf pin the chip to one line: a box otherwise stretches to the
    // row height, so a wrapped multi-line title would inflate the chip vertically.
    <box backgroundColor={avatarColor(name)} paddingX={1} height={1} alignSelf="flex-start">
      <text fg={theme.bg}>{initials(name)}</text>
    </box>
  )
}
