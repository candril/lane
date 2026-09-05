import { forwardRef } from "react"
import { TextAttributes, type BoxRenderable } from "@opentui/core"
import { theme } from "../theme"
import type { HiddenChildren } from "../grouping"
import type { Task } from "../types"
import { priorityGlyph, typeGlyph } from "../utils/glyphs"
import { Avatar } from "./Avatar"
import { LabelTags } from "./LabelTags"
import { EpicTag } from "./EpicTag"
import { JumpGlyph } from "./JumpTag"
import { useTagVisibility } from "./TagVisibility"

interface CardProps {
  task: Task
  focused: boolean
  /** In the multi-select (specs/055): tinted background marks the card as part of the copy set. */
  selected: boolean
  /** In the "done" column: the key is struck through and the card dimmed. */
  done: boolean
  /**
   * `own-column` layout: the parent's key, rendered as a dim `↳PARENT` in the
   * footer so the link stays visible while the parent sits in another column.
   * Null for parents and for sub-tasks under a parent-header lane.
   */
  parentRef: string | null
  /**
   * `under-parent` layout: this sub-task is nested in its parent's column — indent
   * it and prefix the summary with a `↳` connector so it reads as a child.
   */
  indent: boolean
  /** `under-parent` layout: the sub-task's own status, shown when it differs from the column. */
  statusBadge: string | null
  statusColor: string
  /** Flash-jump label for this card while a jump is active (specs/037). */
  jumpLabel?: string
  /**
   * Children this card isn't showing — folded away (specs/042) or withheld by the
   * visibility setting (specs/052). Marked on the card so they read as hidden, never
   * as absent: `▸ N subtasks` when they could be unfolded, `✓ N done` when they are
   * finished work the board is keeping out of the way.
   */
  hidden?: HiddenChildren
}

/**
 * One issue card: summary on top, then a footer of `type + key` (left) and
 * `priority + assignee` (right). Done cards read as settled (struck key, dimmed).
 */
export const Card = forwardRef<BoxRenderable, CardProps>(function Card(
  { task, focused, selected, done, parentRef, indent, statusBadge, statusColor, jumpLabel, hidden },
  ref,
) {
  const type = typeGlyph(task.type)
  const priority = priorityGlyph(task.priority)
  const tags = useTagVisibility()
  // While a jump is active this card carries a label; dim its text so the labels
  // read as an overlay (specs/037).
  const dim = !!jumpLabel
  // Focus owns the background, so a card that is both focused and selected shows its
  // membership through the key color instead.
  const keyColor = dim
    ? theme.textMuted
    : done
      ? theme.textMuted
      : focused
        ? selected
          ? theme.warning
          : theme.text
        : theme.textDim
  const summaryColor = dim ? theme.textDim : done ? theme.textDim : theme.text

  return (
    <box
      ref={ref}
      flexDirection="column"
      marginBottom={1}
      marginLeft={indent ? 2 : 0}
      paddingX={1}
      paddingY={1}
      backgroundColor={
        focused ? theme.cardBgFocused : selected ? theme.cardBgSelected : theme.cardBg
      }
    >
      <box flexDirection="row" alignItems="flex-start">
        {/* The glyph sits in its own column so a wrapped summary hangs under its own
            first character instead of sliding back beneath the glyph. */}
        <box flexShrink={0}>
          <text>
            {indent && <span fg={theme.textMuted}>↳ </span>}
            <JumpGlyph label={jumpLabel} char={type.char} color={type.color} />
          </text>
        </box>
        {/* flexGrow bounds the wrap width; the marginRight gutter keeps every wrapped
            line clear of the priority glyph / assignee chip. */}
        <box flexGrow={1} flexShrink={1} flexDirection="column" marginRight={1}>
          <text>
            <span fg={keyColor} attributes={done ? TextAttributes.STRIKETHROUGH : undefined}>
              {task.key}
            </span>
            <span fg={summaryColor}> {task.summary}</span>
          </text>
          {(parentRef || statusBadge) && (
            <text>
              {parentRef && <span fg={theme.textMuted}>↳{parentRef}</span>}
              {statusBadge && (
                <span fg={statusColor}>
                  {parentRef ? " " : ""}[{statusBadge}]
                </span>
              )}
            </text>
          )}
          {!!hidden && (
            <text fg={theme.textMuted}>
              {hidden.done
                ? `✓ ${hidden.count} done`
                : `▸ ${hidden.count} subtask${hidden.count === 1 ? "" : "s"}`}
            </text>
          )}
          {tags.epics && !dim && <EpicTag epicKey={task.epicKey} epicName={task.epicName} />}
          {tags.labels && <LabelTags labels={task.labels} />}
        </box>
        <text fg={priority.color}>{priority.char} </text>
        <Avatar name={task.assignee} />
      </box>
    </box>
  )
})
