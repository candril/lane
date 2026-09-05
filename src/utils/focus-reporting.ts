/**
 * Terminal focus in/out reporting (specs/033). OpenTUI has no focus events, but
 * enabling DEC private mode 1004 makes the terminal emit `\x1b[I` / `\x1b[O` when it
 * gains / loses focus, and `CliRenderer.prependInputHandler` sees raw input sequences
 * before OpenTUI's own key parsing. Used to refresh the board when you tab back.
 * Proven on tmux / iTerm2 / kitty (ported from presto).
 */

import type { CliRenderer } from "@opentui/core"

const ENABLE = "\x1b[?1004h"
const DISABLE = "\x1b[?1004l"
const FOCUS_IN = "\x1b[I"
const FOCUS_OUT = "\x1b[O"

/**
 * Enable focus reporting and route focus in/out to `onFocusChange`. Returns a
 * teardown that removes the handler and disables the mode.
 */
export function setupFocusReporting(
  renderer: CliRenderer,
  onFocusChange: (focused: boolean) => void,
): () => void {
  process.stdout.write(ENABLE)

  const handler = (sequence: string): boolean => {
    if (sequence === FOCUS_IN) {
      onFocusChange(true)
      return true // consume — not a key
    }
    if (sequence === FOCUS_OUT) {
      onFocusChange(false)
      return true
    }
    return false // let OpenTUI process everything else
  }

  renderer.prependInputHandler(handler)
  return () => {
    renderer.removeInputHandler(handler)
    process.stdout.write(DISABLE)
  }
}
