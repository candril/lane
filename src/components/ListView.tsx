import { Fragment } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"
import type { ListRow } from "../grouping"
import { priorityGlyph, typeGlyph } from "../utils/glyphs"
import { Avatar } from "./Avatar"
import { LabelTags } from "./LabelTags"
import { EpicTag } from "./EpicTag"
import { JumpGlyph } from "./JumpTag"
import { useTagVisibility } from "./TagVisibility"

interface ListViewProps {
  rows: ListRow[]
  focusedIndex: number
  doneColumnId: string
  columnMeta: Map<string, { title: string; color: string }>
  /** Jump labels by row task key while a jump is active (specs/037). */
  jumpLabels?: Map<string, string>
  /** Keys in the multi-select copy set (specs/055), shown as a tinted row background. */
  selectedKeys?: Set<string>
}

/**
 * The epic gets a column of its own rather than trailing the summary: a backlog is
 * read down the epic, and a tag that starts wherever the title happens to end can't
 * be scanned that way. Two cells go to the glyph and its space.
 */
/** Labels line up in their own column too, for the same reason as the epic's. */
const LABEL_COLUMN = 10

const EPIC_COLUMN = 22

/**
 * Right-aligned so the tail of every row (priority, assignee) lines up, and fixed so
 * the epic column *before* it does too — a variable-width status pushed the epics a
 * couple of cells around, which is exactly what a column is meant to prevent.
 */
const STATUS_COLUMN = 16

/** Pad to `width` (right-aligned), eliding anything longer. */
function column(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padStart(width)
}

/** Fixed cells left of the summary: disclosure, type glyph, issue key, a space. */
const ROW_LEAD = 4 + 2 + 1
/** Priority glyph, avatar chip, and the row's own padding. */
const ROW_TAIL = 2 + 4 + 4

/**
 * A row has to stay one row: the columns to its right are fixed, so a long summary
 * would wrap and break the one-issue-one-row reading the cursor depends on. Trim it
 * to whatever the terminal leaves over.
 */
function summaryFor(
  text: string,
  key: string,
  width: number,
  tags: { epics: boolean; labels: boolean },
): string {
  const columns =
    ROW_LEAD +
    key.length +
    ROW_TAIL +
    STATUS_COLUMN +
    (tags.epics ? EPIC_COLUMN : 0) +
    (tags.labels ? LABEL_COLUMN : 0)
  const room = width - columns
  if (room < 4) {
    return ""
  }
  return text.length > room ? `${text.slice(0, room - 1)}…` : text
}

function disclosure(row: ListRow): string {
  const indent = "  ".repeat(row.depth)
  if (row.hasChildren) {
    return `${indent}${row.expanded ? "▾" : "▸"} `
  }
  return row.depth > 0 ? `${indent}↳ ` : `${indent}  `
}

/**
 * Flat, tree-style list: top-level issues with expandable sub-task children. A row
 * may carry a `section` heading (the backlog's status groups, specs/044) — printed
 * above it rather than as a row of its own, so the cursor still walks issues only.
 */
export function ListView({
  rows,
  focusedIndex,
  doneColumnId,
  columnMeta,
  jumpLabels,
  selectedKeys,
}: ListViewProps) {
  // Dim rows while a jump is active so the labels overlay clearly (specs/037).
  const dim = !!jumpLabels
  const tags = useTagVisibility()
  const { width } = useTerminalDimensions()
  return (
    <scrollbox flexGrow={1} paddingX={1} paddingY={1}>
      {rows.map((row, i) => {
        const type = typeGlyph(row.task.type)
        const priority = priorityGlyph(row.task.priority)
        const status = columnMeta.get(row.task.columnId)
        const done = row.task.columnId === doneColumnId
        const focused = i === focusedIndex
        const selected = !!selectedKeys?.has(row.task.key)
        return (
          <Fragment key={row.task.key}>
            {row.section && (
              <box flexDirection="row" paddingX={1} marginTop={i > 0 ? 1 : 0}>
                <text>
                  <span fg={theme.primary}>{row.section.title}</span>
                  <span fg={theme.textMuted}> ({row.section.count})</span>
                </text>
              </box>
            )}
            <box
              flexDirection="row"
              paddingX={1}
              backgroundColor={
                focused ? theme.cardBgFocused : selected ? theme.cardBgSelected : undefined
              }
            >
              <text>
                <span fg={theme.textDim}>{disclosure(row)}</span>
                <JumpGlyph
                  label={jumpLabels?.get(row.task.key)}
                  char={type.char}
                  color={type.color}
                />
                {/* Focus owns the row background; the key color says a focused row is
                    also in the copy set. */}
                <span
                  fg={
                    dim || done ? theme.textMuted : focused && selected ? theme.warning : theme.text
                  }
                  attributes={done ? TextAttributes.STRIKETHROUGH : undefined}
                >
                  {row.task.key}
                </span>
                <span fg={dim || done ? theme.textDim : theme.text}>
                  {" "}
                  {summaryFor(row.task.summary, row.task.key, width - row.depth * 2, tags)}
                </span>
              </text>
              <box flexGrow={1} />
              {tags.labels ? (
                <box width={LABEL_COLUMN} flexShrink={0}>
                  <LabelTags labels={row.task.labels} max={2} width={LABEL_COLUMN} />
                </box>
              ) : null}
              {tags.epics ? (
                <box width={EPIC_COLUMN} flexShrink={0}>
                  <EpicTag
                    epicKey={row.task.epicKey}
                    epicName={row.task.epicName}
                    max={EPIC_COLUMN - 2}
                  />
                </box>
              ) : null}
              <text fg={status?.color ?? theme.textDim}>
                {column(status?.title ?? row.task.columnId, STATUS_COLUMN)}{" "}
              </text>
              <text fg={priority.color}>{priority.char} </text>
              <Avatar name={row.task.assignee} />
            </box>
          </Fragment>
        )
      })}
    </scrollbox>
  )
}
