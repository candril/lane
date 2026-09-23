import { Fragment } from "react"
import { theme } from "../theme"

/**
 * Text with the jump's query picked out of it (specs/037) — the flash-style match
 * highlight, so a narrowed board says *why* each remaining card is still there rather
 * than leaving the label to imply it. Renders spans, so it lives inside a `<text>`.
 */
export function Matched({ text, query, fg }: { text: string; query?: string; fg: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0 || !query) {
    return <span fg={fg}>{text}</span>
  }
  return (
    <Fragment>
      {at > 0 && <span fg={fg}>{text.slice(0, at)}</span>}
      <span fg={theme.bg} bg={theme.warning}>
        {text.slice(at, at + query.length)}
      </span>
      <span fg={fg}>{text.slice(at + query.length)}</span>
    </Fragment>
  )
}
