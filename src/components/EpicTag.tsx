import { epicColor, typeGlyph } from "../utils/glyphs"

/**
 * A card/row's epic link as a compact colour-coded tag (specs/029): the epic glyph
 * plus its name (or key when the name isn't sourced). The colour is hashed from the
 * epic key so cards sharing an epic read as a group. Returns `null` when the issue
 * has no epic. Distinct from labels ([LabelTags]) and sub-tasks — this is the link
 * *up* to the epic.
 *
 * `max` caps the label so the tag fits a fixed column (specs/044's backlog rows);
 * without it the tag is as wide as the epic's name.
 */
export function EpicTag({
  epicKey,
  epicName,
  max,
}: {
  epicKey?: string
  epicName?: string
  max?: number
}) {
  if (!epicKey) {
    return null
  }
  const label = epicName ?? epicKey
  return (
    <text>
      <span fg={epicColor(epicKey)}>
        {typeGlyph("epic").char} {max && label.length > max ? `${label.slice(0, max - 1)}…` : label}
      </span>
    </text>
  )
}
