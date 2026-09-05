import type { Ref } from "react"
import type { BoxRenderable } from "@opentui/core"
import type { Grouping, Lane } from "../grouping"
import type { SubtaskLayout } from "../config/types"
import type { Board as BoardModel } from "../types"
import { Column } from "./Column"
import { Swimlane } from "./Swimlane"

interface BoardProps {
  board: BoardModel
  grouping: Grouping
  lanes: Lane[]
  activeLane: number
  activeColumn: number
  /** Whether the cursor is on the active lane's header rather than a cell. */
  onHeader: boolean
  /** Lane keys whose cells are folded away (header only). */
  collapsed: Set<string>
  /** Column ids folded to a narrow strip (specs/040). */
  collapsedColumns: Set<string>
  focusedKey: string | null
  /** Attached to the focused card / empty cell / header so App can scroll it in. */
  focusedRef?: Ref<BoxRenderable>
  /** Attached to the active swimlane so scrolling can reveal its header too. */
  laneRef?: Ref<BoxRenderable>
  columnMeta: Map<string, { title: string; color: string }>
  subtaskLayout?: SubtaskLayout
  /** Jump labels by card/lane key while a jump is active (specs/037). */
  jumpLabels?: Map<string, string>
  /** Keys in the multi-select copy set (specs/055). */
  selectedKeys?: Set<string>
}

export function Board({
  board,
  grouping,
  lanes,
  activeLane,
  activeColumn,
  onHeader,
  collapsed,
  collapsedColumns,
  focusedKey,
  focusedRef,
  laneRef,
  columnMeta,
  subtaskLayout,
  jumpLabels,
  selectedKeys,
}: BoardProps) {
  const doneColumnId = board.columns[board.columns.length - 1]?.id ?? ""
  // The by-parent view spreads a parent's sub-tasks across its lane's own columns with
  // no parent card among them — nothing to fold a checklist into (specs/008), and
  // nothing a basket (specs/051) would group that the lane header doesn't. So both
  // resolve to the plain card list there.
  const layout: SubtaskLayout =
    grouping === "parent" ? "own-column" : (subtaskLayout ?? "own-column")

  if (grouping === "none") {
    const lane = lanes[0]!
    return (
      <box flexGrow={1} flexDirection="row" paddingY={1}>
        {board.columns.map((column, i) => {
          const focused = i === activeColumn
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
              boardColumns={board.columns}
              layout={layout}
              jumpLabels={jumpLabels}
              selectedKeys={selectedKeys}
              tall
              collapsed={collapsedColumns.has(column.id)}
            />
          )
        })}
      </box>
    )
  }

  return (
    <scrollbox flexGrow={1} paddingY={1} viewportCulling={false}>
      {lanes.map((lane, li) => (
        <Swimlane
          key={lane.key}
          lane={lane}
          columns={board.columns}
          activeColumn={activeColumn}
          laneActive={li === activeLane}
          headerSelected={li === activeLane && onHeader}
          collapsed={collapsed.has(lane.key)}
          collapsedColumns={collapsedColumns}
          focusedKey={onHeader ? null : focusedKey}
          focusedRef={li === activeLane ? focusedRef : undefined}
          laneRef={li === activeLane ? laneRef : undefined}
          doneColumnId={doneColumnId}
          columnMeta={columnMeta}
          layout={layout}
          jumpLabels={jumpLabels}
          selectedKeys={selectedKeys}
        />
      ))}
    </scrollbox>
  )
}
