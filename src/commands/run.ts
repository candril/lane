import type { ChildVisibility, SubtaskLayout } from "../config/types"
import type { Grouping } from "../grouping"
import type { TabMode } from "../tabs"

/**
 * The App behind the palette. Every entry is an action a direct key already triggers
 * (specs/010): the palette is a second door onto the same handlers, never a second
 * implementation of them.
 */
export interface CommandActions {
  startStatus: () => void
  startResolution: () => void
  startAssign: () => void
  startLabels: () => void
  startEpic: () => void
  toggleDetail: () => void
  startEdit: () => void
  editInEditor: () => void
  openIssue: () => void
  openIssueWindow: () => void
  copyKey: () => void
  copyUrl: () => void
  copyTitle: () => void
  copyDescription: () => void
  startCreate: (topLevel: boolean) => void
  setView: (mode: TabMode) => void
  setGrouping: (grouping: Grouping) => void
  toggleEpicTags: () => void
  toggleLabelTags: () => void
  setSubtaskLayout: (layout: SubtaskLayout) => void
  setChildVisibility: (visibility: ChildVisibility) => void
  startFilter: () => void
  clearFilter: () => void
  toggleSubtaskScope: () => void
  foldAll: (open: boolean) => void
  doRefresh: () => void
  startSearch: () => void
  cloneTab: () => void
  renameTab: () => void
  closeTab: () => void
  stepTab: (direction: -1 | 1) => void
  showHelp: () => void
  quit: () => void
}

/**
 * Run the command with this id. Submenu commands never reach here — the palette
 * handles those itself — so an unknown id is a wiring mistake, not a user action, and
 * is ignored rather than thrown.
 */
export function runCommand(id: string, actions: CommandActions): void {
  switch (id) {
    case "issue:status":
      return actions.startStatus()
    case "issue:resolution":
      return actions.startResolution()
    case "issue:assign":
      return actions.startAssign()
    case "issue:labels":
      return actions.startLabels()
    case "issue:epic":
      return actions.startEpic()
    case "issue:detail":
      return actions.toggleDetail()
    case "issue:rename":
      return actions.startEdit()
    case "issue:editor":
      return actions.editInEditor()
    case "issue:open":
      return actions.openIssue()
    case "issue:window":
      return actions.openIssueWindow()
    case "issue:copy-key":
      return actions.copyKey()
    case "issue:copy-url":
      return actions.copyUrl()
    case "issue:copy-title":
      return actions.copyTitle()
    case "issue:copy-description":
      return actions.copyDescription()
    case "issue:new":
      return actions.startCreate(false)
    case "issue:new-top":
      return actions.startCreate(true)
    case "view:board":
      return actions.setView("board")
    case "view:list":
      return actions.setView("list")
    case "view:backlog":
      return actions.setView("backlog")
    case "group:none":
      return actions.setGrouping("none")
    case "group:parent":
      return actions.setGrouping("parent")
    case "group:type":
      return actions.setGrouping("type")
    case "group:swimlanes":
      return actions.setGrouping("swimlanes")
    case "subtasks:own-column":
      return actions.setSubtaskLayout("own-column")
    case "subtasks:under-parent":
      return actions.setSubtaskLayout("under-parent")
    case "subtasks:checklist":
      return actions.setSubtaskLayout("checklist")
    case "subtasks:basket":
      return actions.setSubtaskLayout("basket")
    case "children:all":
      return actions.setChildVisibility("all")
    case "children:hide-done":
      return actions.setChildVisibility("hide-done")
    case "children:none":
      return actions.setChildVisibility("none")
    case "view:epic-tags":
      return actions.toggleEpicTags()
    case "view:label-tags":
      return actions.toggleLabelTags()
    case "view:filter":
      return actions.startFilter()
    case "view:clear-filter":
      return actions.clearFilter()
    case "view:subtask-scope":
      return actions.toggleSubtaskScope()
    case "fold:open-all":
      return actions.foldAll(true)
    case "fold:close-all":
      return actions.foldAll(false)
    case "board:refresh":
      return actions.doRefresh()
    case "board:search":
      return actions.startSearch()
    case "tab:clone":
      return actions.cloneTab()
    case "tab:rename":
      return actions.renameTab()
    case "tab:close":
      return actions.closeTab()
    case "tab:next":
      return actions.stepTab(1)
    case "tab:prev":
      return actions.stepTab(-1)
    case "app:help":
      return actions.showHelp()
    case "app:quit":
      return actions.quit()
  }
}
