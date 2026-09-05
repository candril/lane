import {
  getTreeSitterClient,
  RGBA,
  SyntaxStyle,
  type StyleDefinition,
  type TreeSitterClient,
} from "@opentui/core"
import { theme } from "./theme"

/**
 * The style table OpenTUI's Markdown renderable resolves its tokens against — the
 * only place a component may hand it colours, so the board's palette stays the one
 * source of truth (specs/007).
 *
 * `conceal` is what the renderer paints the syntax markers with (the `#` of a
 * heading, the `**` of a bold run); dimming rather than hiding them keeps the source
 * legible without letting punctuation compete with the prose.
 */
const STYLES: Record<string, StyleDefinition> = {
  default: { fg: RGBA.fromHex(theme.text) },
  conceal: { fg: RGBA.fromHex(theme.textMuted) },
  "markup.heading": { fg: RGBA.fromHex(theme.primary), bold: true },
  "markup.strong": { fg: RGBA.fromHex(theme.text), bold: true },
  "markup.italic": { fg: RGBA.fromHex(theme.text), italic: true },
  "markup.strikethrough": { fg: RGBA.fromHex(theme.textDim) },
  "markup.raw": { fg: RGBA.fromHex(theme.warning) },
  "markup.link": { fg: RGBA.fromHex(theme.secondary) },
  "markup.link.label": { fg: RGBA.fromHex(theme.secondary) },
  "markup.link.url": { fg: RGBA.fromHex(theme.textDim), underline: true },
  // Tree-sitter's code-block tokens, so a fenced block reads as code rather than prose.
  comment: { fg: RGBA.fromHex(theme.textDim), italic: true },
  keyword: { fg: RGBA.fromHex(theme.secondary) },
  string: { fg: RGBA.fromHex(theme.success) },
  number: { fg: RGBA.fromHex(theme.warning) },
  function: { fg: RGBA.fromHex(theme.primary) },
  type: { fg: RGBA.fromHex(theme.warning) },
  variable: { fg: RGBA.fromHex(theme.text) },
}

let cached: SyntaxStyle | null = null

/**
 * Built once and shared: a `SyntaxStyle` holds a native pointer, so a per-render
 * instance would leak one allocation per frame.
 */
export function markdownStyle(): SyntaxStyle {
  cached ??= SyntaxStyle.fromStyles(STYLES)
  return cached
}

/**
 * The Markdown renderable paints its text blocks from tree-sitter highlights and
 * draws nothing without them — so the client is not an enhancement, it is what makes
 * prose appear at all. The markdown grammar ships inside `@opentui/core`, so this
 * loads from disk and works offline.
 */
export function markdownTreeSitter(): TreeSitterClient {
  return getTreeSitterClient()
}
