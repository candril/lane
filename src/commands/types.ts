import type { ChildVisibility, SubtaskLayout } from "../config/types"
import type { Grouping } from "../grouping"
import type { TabMode } from "../tabs"

/** Section order in the palette; anything unlisted falls to the end. */
export const CATEGORY_ORDER = ["issue", "view", "board", "tabs", "app"] as const

export type CommandCategory = (typeof CATEGORY_ORDER)[number]

/**
 * A field editor the palette opens *inside itself* rather than running and closing
 * (specs/010): the row list is replaced by that field's candidates and Esc backs out
 * to the command list. Each of these fields has a direct key that opens the bottom-bar
 * editor instead — one write path, two surfaces.
 */
export type SubmenuKind = "status" | "assign" | "epic" | "labels" | "resolution"

export interface Command {
  id: string
  label: string
  category: CommandCategory
  /** The direct binding for this action, right-aligned as a hint. Display only. */
  shortcut?: string
  /** Set when choosing this command opens a submenu instead of acting. */
  submenu?: SubmenuKind
}

/**
 * What the palette needs to know to decide which commands exist right now. State
 * only — the callbacks live in {@link CommandActions}, so the list can be built and
 * asserted without an App.
 */
export interface CommandContext {
  /** The issue every issue command acts on: the viewer's, else the cursor's. */
  issueKey: string | null
  view: TabMode
  grouping: Grouping
  /** Query-swimlanes are configured for this board, so `g s` means something. */
  hasSwimlanes: boolean
  /** The loaded board's issues carry sprints, so `sprint` grouping applies (specs/050). */
  hasSprints: boolean
  showEpics: boolean
  showLabels: boolean
  /** The tab's sub-task layout (specs/051) — every other one is offered as a command. */
  subtasks: SubtaskLayout
  /** Which children the board draws (specs/052) — every other setting is offered. */
  children: ChildVisibility
  /** A filter is active, so there is something for "clear filter" to do. */
  filtered: boolean
  /** Sub-task filter scope (specs/043) — the label says which way ⇧F would flip it. */
  subtaskScope: "strict" | "inherit"
  /** A query tab can't create issues (specs/047). */
  canCreate: boolean
  /** The source can report the workflow's resolutions, so a reason can be set (specs/053). */
  canResolve: boolean
  /** The focused issue sits in the done column — so a reason is amended, not a close made. */
  issueDone: boolean
  /** Issues in the multi-select — the copy commands (specs/055) and the field
   * editors (specs/056) act on them instead of the focused issue. */
  selectionCount: number
  /** More than one tab, so switching is possible. */
  tabCount: number
  /** The active tab is an ad-hoc one, so it can be renamed or closed (specs/045). */
  ownTab: boolean
}
