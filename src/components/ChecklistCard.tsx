import type { Ref } from "react"
import { TextAttributes, type BoxRenderable } from "@opentui/core"
import { theme } from "../theme"
import type { HiddenChildren } from "../grouping"
import type { Column as ColumnModel, Task } from "../types"
import { priorityGlyph, statusGlyph, typeGlyph } from "../utils/glyphs"
import { Avatar } from "./Avatar"
import { LabelTags } from "./LabelTags"
import { EpicTag } from "./EpicTag"
import { JumpGlyph } from "./JumpTag"
import { useTagVisibility } from "./TagVisibility"

interface ChecklistCardProps {
  parent: Task
  /** The parent's sub-tasks, in order — rendered as checklist rows inside the card. */
  subs: Task[]
  /** Key of the focused row (parent or a sub) when the cursor is in this cell, else null. */
  focusedKey: string | null
  /** Attached to whichever row (parent or sub) is focused, so it scrolls into view. */
  focusedRef?: Ref<BoxRenderable>
  boardColumns: ColumnModel[]
  doneColumnId: string
  columnMeta: Map<string, { title: string; color: string }>
  /** Jump labels by card key (parent + subs) while a jump is active (specs/037). */
  jumpLabels?: Map<string, string>
  /** Keys in the multi-select copy set (specs/055), tinted — parent and sub rows alike. */
  selectedKeys?: Set<string>
  /**
   * Rows this checklist isn't showing — folded away (specs/042) or withheld by the
   * visibility setting (specs/052). Rendered as a final muted row so a part-hidden
   * checklist still says what it is holding back, not just a shorter list.
   */
  hidden?: HiddenChildren
}

/**
 * A checklist row's status icon: the column's glyph in the column's colour. The icon
 * is the *only* status cue (no `[status]` text), per the checklist layout, so it
 * carries the distinction in both shape and hue — one `◐` in three colours left
 * In Progress, In Review and On Hold indistinguishable.
 */
function statusIcon(
  task: Task,
  boardColumns: ColumnModel[],
  columnMeta: Map<string, { title: string; color: string }>,
): { glyph: string; color: string } {
  return {
    glyph: statusGlyph(task.columnId, boardColumns),
    color: columnMeta.get(task.columnId)?.color ?? theme.textDim,
  }
}

/**
 * Parent card whose sub-tasks fold in as compact checklist rows (specs/008
 * `checklist` layout): each row is a status icon + summary — no issue key, no
 * status text — plus its labels, and stays individually selectable. Status changes
 * in place via the board's `Shift+H`/`Shift+L`, which the icon then reflects.
 * A sub-task's labels are shown because they are editable from the row (specs/028)
 * and this layout is otherwise the only place an edit leaves no visible trace.
 */
export function ChecklistCard({
  parent,
  subs,
  focusedKey,
  focusedRef,
  boardColumns,
  doneColumnId,
  columnMeta,
  jumpLabels,
  selectedKeys,
  hidden,
}: ChecklistCardProps) {
  const type = typeGlyph(parent.type)
  const priority = priorityGlyph(parent.priority)
  const parentFocused = parent.key === focusedKey
  const parentSelected = !!selectedKeys?.has(parent.key)
  const parentDone = parent.columnId === doneColumnId
  // Dim text while a jump is active so the labels overlay clearly (specs/037).
  const dim = !!jumpLabels
  const tags = useTagVisibility()

  return (
    <box
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
      paddingY={1}
      backgroundColor={theme.cardBg}
    >
      <box
        ref={parentFocused ? focusedRef : undefined}
        flexDirection="column"
        backgroundColor={
          parentFocused ? theme.cardBgFocused : parentSelected ? theme.cardBgSelected : undefined
        }
      >
        <box flexDirection="row" alignItems="flex-start">
          {/* Glyph in its own column so a wrapped title hangs under the key, and a
              marginRight gutter so no line touches the priority glyph / chip. */}
          <box flexShrink={0}>
            <text>
              <JumpGlyph label={jumpLabels?.get(parent.key)} char={type.char} color={type.color} />
            </text>
          </box>
          <box flexGrow={1} flexShrink={1} marginRight={1}>
            <text>
              <span
                fg={
                  dim || parentDone
                    ? theme.textMuted
                    : parentFocused
                      ? parentSelected
                        ? theme.warning
                        : theme.text
                      : theme.textDim
                }
                attributes={parentDone ? TextAttributes.STRIKETHROUGH : undefined}
              >
                {parent.key}
              </span>
              <span fg={dim || parentDone ? theme.textDim : theme.text}> {parent.summary}</span>
            </text>
            {tags.epics && !dim && <EpicTag epicKey={parent.epicKey} epicName={parent.epicName} />}
            {tags.labels && <LabelTags labels={parent.labels} />}
          </box>
          <text fg={priority.color}>{priority.char} </text>
          <Avatar name={parent.assignee} />
        </box>
      </box>

      <box flexDirection="column" marginTop={1}>
        {subs.map((sub) => {
          const focused = sub.key === focusedKey
          const selected = !!selectedKeys?.has(sub.key)
          const done = sub.columnId === doneColumnId
          const icon = statusIcon(sub, boardColumns, columnMeta)
          return (
            <box
              key={sub.key}
              ref={focused ? focusedRef : undefined}
              flexDirection="row"
              paddingLeft={1}
              backgroundColor={
                focused ? theme.cardBgFocused : selected ? theme.cardBgSelected : undefined
              }
            >
              <box flexShrink={0}>
                <text>
                  <JumpGlyph
                    label={jumpLabels?.get(sub.key)}
                    char={icon.glyph}
                    color={icon.color}
                  />
                </text>
              </box>
              <box flexGrow={1} flexShrink={1} marginRight={1}>
                <text>
                  {/* No key cell here, so on a focused row the summary carries the
                      selected color instead. */}
                  <span
                    fg={
                      dim || done
                        ? theme.textMuted
                        : focused
                          ? selected
                            ? theme.warning
                            : theme.text
                          : theme.textDim
                    }
                    attributes={done ? TextAttributes.STRIKETHROUGH : undefined}
                  >
                    {sub.summary}
                  </span>
                </text>
              </box>
              {tags.labels && !!sub.labels?.length && (
                <box flexShrink={0} marginRight={1}>
                  <LabelTags labels={sub.labels} max={2} />
                </box>
              )}
              <Avatar name={sub.assignee} />
            </box>
          )
        })}
        {!!hidden && (
          // Two leading cells so it lines up with the row summaries above, whose
          // status icon occupies the same slot.
          <box flexDirection="row" paddingLeft={1}>
            <text fg={theme.textMuted}>
              {"  "}
              {hidden.done
                ? `✓ ${hidden.count} done`
                : `▸ ${hidden.count} subtask${hidden.count === 1 ? "" : "s"}`}
            </text>
          </box>
        )}
      </box>
    </box>
  )
}
