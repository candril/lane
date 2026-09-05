import type { Ref } from "react"
import { TextAttributes, type BoxRenderable } from "@opentui/core"
import { theme } from "../theme"
import type { Lane, LaneHeader } from "../grouping"
import type { SubtaskLayout } from "../config/types"
import type { Column as ColumnModel } from "../types"
import { typeGlyph } from "../utils/glyphs"
import { Avatar } from "./Avatar"
import { Column } from "./Column"
import { JumpGlyph } from "./JumpTag"

interface SwimlaneProps {
  lane: Lane
  columns: ColumnModel[]
  activeColumn: number
  laneActive: boolean
  /** The cursor is on this lane's header (the whole lane is selected). */
  headerSelected: boolean
  /** The lane is folded: show only its header. */
  collapsed: boolean
  /** Column ids folded to a narrow strip (specs/040). */
  collapsedColumns: Set<string>
  focusedKey: string | null
  /** Attached to the focused card / empty cell, or the header when selected. */
  focusedRef?: Ref<BoxRenderable>
  /** Attached to the active lane's band so scrolling can reveal its header. */
  laneRef?: Ref<BoxRenderable>
  doneColumnId: string
  columnMeta: Map<string, { title: string; color: string }>
  /** The sub-task layout to render, resolved for this grouping (specs/008, specs/051). */
  layout: SubtaskLayout
  /** Jump labels by card/lane key while a jump is active (specs/037). */
  jumpLabels?: Map<string, string>
  /** Keys in the multi-select copy set (specs/055). */
  selectedKeys?: Set<string>
}

function LaneHeaderRow({
  header,
  collapsed,
  selected,
  headerRef,
  columnMeta,
  jumpLabel,
}: {
  header: LaneHeader
  collapsed: boolean
  selected: boolean
  headerRef?: Ref<BoxRenderable>
  columnMeta: Map<string, { title: string; color: string }>
  jumpLabel?: string
}) {
  const chevron = collapsed ? "▸" : "▾"
  const background = selected ? theme.headerBg : undefined
  // During a jump the label overlays the chevron/glyph slot; dim the rest (specs/037).
  const dim = !!jumpLabel

  if (header.kind === "label") {
    return (
      <box ref={headerRef} paddingX={1} flexDirection="row" backgroundColor={background}>
        <text>
          <JumpGlyph label={jumpLabel} char={chevron} color={theme.textDim} />
          <span
            fg={dim ? theme.textDim : selected ? theme.primary : theme.secondary}
            attributes={TextAttributes.BOLD}
          >
            {header.text}
          </span>
          <span fg={theme.textMuted}> {header.count}</span>
        </text>
      </box>
    )
  }

  const { task, subtaskCount } = header
  const type = typeGlyph(task.type)
  const status = columnMeta.get(task.columnId)
  return (
    <box ref={headerRef} paddingX={1} flexDirection="row" backgroundColor={background}>
      <text>
        <span fg={theme.textDim}>{chevron} </span>
        <JumpGlyph label={jumpLabel} char={type.char} color={type.color} />
        <span fg={dim ? theme.textDim : selected ? theme.text : theme.textDim}>{task.key} </span>
        <span fg={dim ? theme.textDim : theme.text} attributes={TextAttributes.BOLD}>
          {task.summary}
        </span>
        <span fg={theme.textMuted}>
          {" "}
          ({subtaskCount} subtask{subtaskCount === 1 ? "" : "s"})
        </span>
        <span fg={status?.color ?? theme.textDim}>
          {" "}
          {(status?.title ?? task.columnId).toUpperCase()}
        </span>
      </text>
      <box flexGrow={1} />
      <Avatar name={task.assignee} />
    </box>
  )
}

/** One swimlane band: its header, then (unless folded) a row of column cells. */
export function Swimlane({
  lane,
  columns,
  activeColumn,
  laneActive,
  headerSelected,
  collapsed,
  collapsedColumns,
  focusedKey,
  focusedRef,
  laneRef,
  doneColumnId,
  columnMeta,
  layout,
  jumpLabels,
  selectedKeys,
}: SwimlaneProps) {
  return (
    <box ref={laneRef} flexDirection="column" marginBottom={1}>
      {lane.header && (
        <LaneHeaderRow
          header={lane.header}
          collapsed={collapsed}
          selected={headerSelected}
          headerRef={headerSelected ? focusedRef : undefined}
          columnMeta={columnMeta}
          jumpLabel={jumpLabels?.get(lane.key)}
        />
      )}
      {!collapsed && (
        <box flexDirection="row" marginTop={1}>
          {columns.map((column, i) => {
            const focused = laneActive && !headerSelected && i === activeColumn
            return (
              <Column
                key={column.id}
                column={column}
                cards={lane.columns[i] ?? []}
                focused={focused}
                focusedKey={focused ? focusedKey : null}
                focusedRef={focused ? focusedRef : undefined}
                doneColumnId={doneColumnId}
                columnMeta={columnMeta}
                boardColumns={columns}
                layout={layout}
                jumpLabels={jumpLabels}
                selectedKeys={selectedKeys}
                tall={false}
                collapsed={collapsedColumns.has(column.id)}
              />
            )
          })}
        </box>
      )}
    </box>
  )
}
