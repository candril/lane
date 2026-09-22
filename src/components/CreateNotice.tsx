import { theme } from "../theme"
import type { CreateNotice as Notice } from "../useCreateDraft"

/**
 * The line under the board that follows a quick-add (specs/059): open the new issue or
 * undo it while the create is out or just landed, the confirmation undo asks for, and a
 * failure that waits to be dismissed rather than flashing past in the header like a toast.
 */
export function CreateNotice({ notice, canOpen }: { notice: Notice; canOpen: boolean }) {
  if (notice.kind === "confirm") {
    return (
      <box flexShrink={0} paddingX={1} backgroundColor={theme.headerBg}>
        <text>
          <span fg={theme.warning}>delete {notice.subject}? this can't be taken back</span>
          <span fg={theme.textMuted}> · y delete · n keep</span>
        </text>
      </box>
    )
  }
  return (
    <box flexShrink={0} paddingX={1} backgroundColor={theme.headerBg}>
      {notice.kind === "failed" ? (
        <text>
          <span fg={theme.error}>{notice.message}</span>
          <span fg={theme.textMuted}>
            {notice.retry ? " · n retry · esc dismiss" : " · esc dismiss"}
          </span>
        </text>
      ) : (
        <text>
          {notice.kind === "pending" ? (
            <span fg={theme.warning}>creating “{notice.summary}”…</span>
          ) : (
            <span fg={theme.success}>✓ created {notice.key}</span>
          )}
          <span fg={theme.textMuted}>{canOpen ? " · ↵ open · u undo" : " · u undo"}</span>
        </text>
      )}
    </box>
  )
}
