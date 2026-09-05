import type { Ref } from "react"
import { TextAttributes, type BoxRenderable } from "@opentui/core"
import { theme } from "../theme"
import type { BoardCard } from "../grouping"
import type { SubtaskLayout } from "../config/types"
import type { Column as ColumnModel, Task } from "../types"
import { Basket } from "./Basket"
import { Card } from "./Card"
import { ChecklistCard } from "./ChecklistCard"

interface ColumnProps {
  column: ColumnModel
  cards: BoardCard[]
  /** The cursor is on a cell in this column (of this lane). */
  focused: boolean
  /** Key of the focused card, or null when the cursor is on an empty cell/elsewhere. */
  focusedKey: string | null
  /** Attached to the focused card, or to the empty-cell placeholder when this cell is empty. */
  focusedRef?: Ref<BoxRenderable>
  doneColumnId: string
  columnMeta: Map<string, { title: string; color: string }>
  /** All board columns, for the checklist status icon (position + color). */
  boardColumns: ColumnModel[]
  /**
   * The sub-task layout to render (specs/008), already resolved for the grouping —
   * `checklist` folds each parent's sub-tasks into its card as rows, `basket` trays
   * each parent's run of cards (specs/051), the rest are a plain card list.
   */
  layout: SubtaskLayout
  /** Jump labels by card key while a jump is active (specs/037). */
  jumpLabels?: Map<string, string>
  /** Keys in the multi-select copy set (specs/055). */
  selectedKeys?: Set<string>
  /** Tall = flat board column (scrolls, fills height). Otherwise a swimlane band cell. */
  tall: boolean
  /** Folded to a narrow strip: cards hidden, title + count only (specs/040). */
  collapsed: boolean
}

const COLLAPSED_WIDTH = 5

export function Column({
  column,
  cards,
  focused,
  focusedKey,
  focusedRef,
  doneColumnId,
  columnMeta,
  boardColumns,
  layout,
  jumpLabels,
  selectedKeys,
  tall,
  collapsed,
}: ColumnProps) {
  if (collapsed) {
    return (
      <box
        ref={focused ? focusedRef : undefined}
        flexDirection="column"
        flexGrow={0}
        flexShrink={0}
        width={COLLAPSED_WIDTH}
        marginX={1}
        alignItems="center"
        paddingY={tall ? 1 : 0}
        backgroundColor={focused ? theme.headerBg : theme.columnBg}
      >
        <text
          fg={focused ? theme.primary : theme.textDim}
          attributes={focused ? TextAttributes.BOLD : undefined}
        >
          ▸
        </text>
        {/* Tall (flat) columns have the height to spell the status vertically; short
            swimlane cells only get the chevron + count so they never stretch the lane. */}
        {tall &&
          column.title
            .toUpperCase()
            .split("")
            .map((ch, i) => (
              <text key={i} fg={focused ? theme.primary : theme.textDim}>
                {ch}
              </text>
            ))}
        {cards.length > 0 && (
          <>
            {tall && <text> </text>}
            <text fg={theme.textMuted}>{cards.length}</text>
          </>
        )}
      </box>
    )
  }

  const renderCard = (card: BoardCard, parentRef: string | null) => {
    const cardFocused = card.task.key === focusedKey
    // `under-parent` sub-tasks sit in the parent's column; badge their own
    // status when it differs from the column they're shown in.
    const offColumn = card.nested && card.task.columnId !== column.id
    const meta = offColumn ? columnMeta.get(card.task.columnId) : undefined
    return (
      <Card
        key={card.task.key}
        ref={cardFocused ? focusedRef : undefined}
        task={card.task}
        focused={cardFocused}
        selected={!!selectedKeys?.has(card.task.key)}
        done={card.task.columnId === doneColumnId}
        parentRef={parentRef}
        indent={!!card.nested}
        statusBadge={offColumn ? (meta?.title ?? card.task.columnId) : null}
        statusColor={meta?.color ?? theme.textDim}
        jumpLabel={jumpLabels?.get(card.task.key)}
        hidden={card.hidden}
      />
    )
  }

  const cardList = () => cards.map((card) => renderCard(card, card.parentRef ?? null))

  // Basket layout (specs/051): one parent's cards are a contiguous run in the cell
  // (grouping.ts), so a run becomes one tray. The tray is headed by the parent unless
  // the parent's own card opens the run, and a run of one loose card gets no tray —
  // a box around a single card groups nothing.
  const basketCards = () => {
    const runs: { parent: string | null; header: BoardCard | null; members: BoardCard[] }[] = []
    for (const card of cards) {
      const parent = card.isSubtask
        ? (card.parentRef ?? null)
        : card.subtaskCount
          ? card.task.key
          : null
      const open = runs[runs.length - 1]
      if (parent && open && open.parent === parent) {
        open.members.push(card)
      } else {
        runs.push({ parent, header: card.isSubtask ? card : null, members: [card] })
      }
    }
    return runs.map((run) => {
      const rendered = run.members.map((card) => renderCard(card, null))
      if (!run.header && rendered.length === 1) {
        return rendered[0]
      }
      return (
        <Basket
          key={run.members[0]!.task.key}
          header={
            run.header
              ? { key: run.header.parentRef ?? "", summary: run.header.parentSummary ?? "" }
              : null
          }
        >
          {rendered}
        </Basket>
      )
    })
  }

  // Checklist layout: fold each parent's trailing nested sub-tasks into one card.
  // Sub-tasks always follow their parent in the same column cell (grouping.ts), so
  // a non-sub-task card opens a group and the sub-tasks after it belong to it.
  const checklistCards = () => {
    const groups: { card: BoardCard; subs: Task[] }[] = []
    for (const card of cards) {
      if (card.isSubtask && groups.length > 0) {
        groups[groups.length - 1]!.subs.push(card.task)
      } else {
        groups.push({ card, subs: [] })
      }
    }
    return groups.map((g) => {
      const parent = g.card.task
      // A folded parent (specs/042) has no rows left, so it falls back to a plain card
      // — with the `▸ N` marker standing in for the checklist.
      if (g.subs.length === 0) {
        const cardFocused = parent.key === focusedKey
        return (
          <Card
            key={parent.key}
            ref={cardFocused ? focusedRef : undefined}
            task={parent}
            focused={cardFocused}
            selected={!!selectedKeys?.has(parent.key)}
            done={parent.columnId === doneColumnId}
            parentRef={null}
            indent={false}
            statusBadge={null}
            statusColor={theme.textDim}
            jumpLabel={jumpLabels?.get(parent.key)}
            hidden={g.card.hidden}
          />
        )
      }
      const containsFocus = parent.key === focusedKey || g.subs.some((s) => s.key === focusedKey)
      return (
        <ChecklistCard
          key={parent.key}
          parent={parent}
          subs={g.subs}
          focusedKey={focusedKey}
          focusedRef={containsFocus ? focusedRef : undefined}
          boardColumns={boardColumns}
          doneColumnId={doneColumnId}
          columnMeta={columnMeta}
          jumpLabels={jumpLabels}
          selectedKeys={selectedKeys}
          hidden={g.card.hidden}
        />
      )
    })
  }

  const body =
    cards.length === 0 ? (
      // An empty cell is still a selectable grid position, but it isn't a card —
      // keep it a quiet dash, just brightened when the cursor rests on it.
      <box ref={focused ? focusedRef : undefined} alignItems="center" paddingX={1}>
        <text
          fg={focused ? theme.primary : theme.textMuted}
          attributes={focused ? TextAttributes.BOLD : undefined}
        >
          —
        </text>
      </box>
    ) : layout === "checklist" ? (
      checklistCards()
    ) : layout === "basket" ? (
      basketCards()
    ) : (
      cardList()
    )

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexBasis={0}
      marginX={1}
      backgroundColor={theme.columnBg}
    >
      {/* paddingX 2 = the body's paddingX + the cards' own, so the title sits on
          the same column as the card glyphs — and as a lane header's name. */}
      <box
        paddingX={2}
        height={1}
        flexDirection="row"
        backgroundColor={focused ? theme.headerBg : theme.columnBg}
      >
        <text>
          <span fg={focused ? theme.primary : theme.textDim}>{column.title}</span>
          {cards.length > 0 && <span fg={theme.textMuted}> {cards.length}</span>}
        </text>
      </box>

      {tall ? (
        <scrollbox flexGrow={1} paddingX={1} paddingTop={1} viewportCulling={false}>
          {body}
        </scrollbox>
      ) : (
        <box flexDirection="column" paddingX={1} paddingTop={1}>
          {body}
        </box>
      )}
    </box>
  )
}
