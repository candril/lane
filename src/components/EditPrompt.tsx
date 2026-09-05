import { useState } from "react"
import { theme } from "../theme"

interface EditPromptProps {
  /** What is being edited, e.g. "edit" — shown dimmed before {@link subject}. */
  prefix: string
  /** The thing itself: an issue key, or the tab being named (specs/045). */
  subject: string
  /** The current value — seeds the field so you edit rather than retype. */
  current: string
  submitting: boolean
  error?: string
  onSubmit: (summary: string) => void
}

/**
 * Bottom line for a single-field edit — renaming an issue, naming a tab: a label,
 * then a field seeded with the current value. Esc cancels (handled by App's keyboard
 * owner, which runs ahead of this focused input); Enter submits.
 */
export function EditPrompt({
  prefix,
  subject,
  current,
  submitting,
  error,
  onSubmit,
}: EditPromptProps) {
  const [value, setValue] = useState(current)
  const hint = submitting ? "saving…" : "esc cancel"

  return (
    <box flexDirection="column" flexShrink={0} backgroundColor={theme.headerBg}>
      <box flexDirection="row" paddingX={1}>
        <text>
          <span fg={theme.textDim}>{prefix} </span>
          <span fg={theme.text}>{subject}</span>
          <span fg={theme.textDim}> ▸ </span>
        </text>
        <box flexGrow={1}>
          <input
            width="100%"
            focused
            value={value}
            onInput={setValue}
            onSubmit={() => onSubmit(value)}
          />
        </box>
        <text fg={submitting ? theme.warning : theme.textMuted}> {hint}</text>
      </box>
      {error && (
        <box paddingX={1}>
          <text fg={theme.error}>{error}</text>
        </box>
      )}
    </box>
  )
}
