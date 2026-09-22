import { useState } from "react"
import { theme } from "../theme"
import type { IssueType } from "../types"
import { typeGlyph } from "../utils/glyphs"

interface CreatePromptProps {
  type: IssueType
  /** The issue this one files under (a sub-task's parent or an epic); null if top-level. */
  parent: { key: string; color: string } | null
  /** What a retry reopens with (specs/059); empty for a fresh quick-add. */
  initialSummary?: string
  onSubmit: (summary: string) => void
}

/**
 * Bottom quick-add line: a type chip, the parent it will nest under (when a
 * sub-task), and a single summary field. Type is switched with Ctrl-T and the
 * line is dismissed with Esc — both handled by App's keyboard owner, which fires
 * ahead of this focused input (see the InternalKeyHandler priority in OpenTUI).
 */
export function CreatePrompt({ type, parent, initialSummary, onSubmit }: CreatePromptProps) {
  const glyph = typeGlyph(type)
  const nesting = parent
  // Held here because the underlying SubmitEvent carries no value for Enter to submit.
  const [value, setValue] = useState(initialSummary ?? "")

  return (
    <box flexDirection="column" flexShrink={0} backgroundColor={theme.headerBg}>
      <box flexDirection="row" paddingX={1}>
        <text>
          <span fg={theme.textDim}>new </span>
          <span fg={glyph.color}>
            {glyph.char} {type}
          </span>
          {nesting && <span fg={theme.textDim}> · under </span>}
          {nesting && <span fg={parent.color}>{parent.key}</span>}
          <span fg={theme.textDim}> ▸ </span>
        </text>
        <box flexGrow={1}>
          <input
            width="100%"
            focused
            placeholder="summary…"
            value={value}
            onInput={setValue}
            onSubmit={() => onSubmit(value)}
          />
        </box>
        <text fg={theme.textMuted}> ^T type · esc cancel</text>
      </box>
    </box>
  )
}
