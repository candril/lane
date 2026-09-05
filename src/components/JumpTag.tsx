import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"

/**
 * The flash-style jump slot (specs/037): occupies the same two cells as a card's
 * type/status glyph, so showing a label never shifts the layout — the bright
 * inverse badge reads as an overlay on top of the glyph. With no active label it
 * renders the glyph as usual. Renders a `<span>`, so it lives inside a `<text>`.
 */
export function JumpGlyph({ label, char, color }: { label?: string; char: string; color: string }) {
  if (label) {
    // Pad to two cells so a one-char label still fills the glyph slot exactly.
    return (
      <span fg={theme.bg} bg={theme.error} attributes={TextAttributes.BOLD}>
        {label.padEnd(2)}
      </span>
    )
  }
  return <span fg={color}>{char} </span>
}
