import type { Command, CommandContext } from "./types"

/**
 * Every command the palette offers for the current state (specs/010). State-aware by
 * omission: a command that can't act right now simply isn't in the list, so Enter
 * never lands on something that quietly does nothing. Order within a category is the
 * order they are pushed; the palette groups and sorts the categories.
 *
 * Pure on purpose — the actions are keyed by id and run elsewhere ({@link runCommand}),
 * which keeps the visibility rules assertable without stubbing two dozen callbacks.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const commands: Command[] = []
  const issue = ctx.issueKey
  // The field editors and copies act on the multi-select when one exists (specs/055,
  // specs/056), so those commands name the selection and survive a cursor on nothing.
  const selected = ctx.selectionCount
  const subject = selected > 0 ? `${selected} selected` : issue

  if (issue || selected > 0) {
    commands.push(
      {
        id: "issue:status",
        label: `Set status of ${subject}…`,
        category: "issue",
        shortcut: "⇧S",
        submenu: "status",
      },
      {
        id: "issue:assign",
        label: `Assign ${subject}…`,
        category: "issue",
        shortcut: "a",
        submenu: "assign",
      },
      {
        id: "issue:labels",
        label: `Edit labels of ${subject}…`,
        category: "issue",
        shortcut: "#",
        submenu: "labels",
      },
      {
        id: "issue:epic",
        label: `Set epic of ${subject}…`,
        category: "issue",
        shortcut: "⇧E",
        submenu: "epic",
      },
    )
  }
  if (issue) {
    commands.push(
      { id: "issue:detail", label: `View ${issue}`, category: "issue", shortcut: "↵" },
      { id: "issue:rename", label: `Rename ${issue}`, category: "issue", shortcut: "e" },
      { id: "issue:editor", label: `Edit ${issue} in $EDITOR`, category: "issue", shortcut: "i" },
      { id: "issue:open", label: `Open ${issue} in the browser`, category: "issue", shortcut: "o" },
      {
        id: "issue:window",
        label: `Open ${issue} in a tmux window`,
        category: "issue",
        shortcut: "⇧O",
      },
    )
  }
  // The copy commands follow the same selection rule.
  const counted = (noun: string) => `Copy ${selected} selected ${noun}${selected === 1 ? "" : "s"}`
  if (issue || selected > 0) {
    commands.push(
      {
        id: "issue:copy-key",
        label: selected > 0 ? counted("key") : `Copy ${issue}`,
        category: "issue",
        shortcut: "y",
      },
      {
        id: "issue:copy-url",
        label: selected > 0 ? counted("URL") : `Copy ${issue} URL`,
        category: "issue",
        shortcut: "⇧Y",
      },
      {
        id: "issue:copy-title",
        label: selected > 0 ? counted("title") : `Copy ${issue} title`,
        category: "issue",
        shortcut: "⇧U",
      },
    )
  }
  if (issue) {
    commands.push({
      id: "issue:copy-description",
      label: `Copy ${issue} description`,
      category: "issue",
      shortcut: "⇧D",
    })
  }
  // The reason a close carries (specs/053). One command, two jobs, so the label says
  // which one it is about to do — this closes an open issue, and only amends a closed one.
  if ((issue || selected > 0) && ctx.canResolve) {
    commands.push({
      id: "issue:resolution",
      label:
        selected > 0
          ? `Close ${subject} as…`
          : ctx.issueDone
            ? `Change why ${issue} closed…`
            : `Close ${issue} as…`,
      category: "issue",
      shortcut: "⇧R",
      submenu: "resolution",
    })
  }
  if (ctx.canCreate) {
    commands.push(
      { id: "issue:new", label: "New issue (in context)", category: "issue", shortcut: "n" },
      { id: "issue:new-top", label: "New top-level issue", category: "issue", shortcut: "⇧N" },
    )
  }

  // View: only the modes and groupings you are not already in.
  const views = [
    { mode: "board", label: "Board view", shortcut: "v b" },
    { mode: "list", label: "List view", shortcut: "v l" },
    { mode: "backlog", label: "Backlog view", shortcut: "v k" },
  ] as const
  for (const v of views) {
    if (ctx.view !== v.mode) {
      commands.push({
        id: `view:${v.mode}`,
        label: v.label,
        category: "view",
        shortcut: v.shortcut,
      })
    }
  }
  const groupings = [
    { key: "none", label: "Group: none", shortcut: "g n" },
    { key: "parent", label: "Group: by parent", shortcut: "g p" },
    { key: "type", label: "Group: by type", shortcut: "g t" },
    { key: "swimlanes", label: "Group: swimlanes", shortcut: "g s" },
    { key: "sprint", label: "Group: by sprint", shortcut: "g r" },
  ] as const
  const unavailable: Partial<Record<(typeof groupings)[number]["key"], boolean>> = {
    swimlanes: !ctx.hasSwimlanes,
    sprint: !ctx.hasSprints,
  }
  for (const g of groupings) {
    if (ctx.grouping === g.key || unavailable[g.key]) {
      continue
    }
    commands.push({ id: `group:${g.key}`, label: g.label, category: "view", shortcut: g.shortcut })
  }
  // Sub-task layouts (specs/051): the ones you are not in, like the groupings above.
  const layouts = [
    { layout: "own-column", label: "Sub-tasks: own column", shortcut: "v o" },
    { layout: "under-parent", label: "Sub-tasks: under the parent", shortcut: "v u" },
    { layout: "checklist", label: "Sub-tasks: checklist in the parent", shortcut: "v c" },
    { layout: "basket", label: "Sub-tasks: parent baskets", shortcut: "v g" },
  ] as const
  for (const l of layouts) {
    if (ctx.subtasks !== l.layout) {
      commands.push({
        id: `subtasks:${l.layout}`,
        label: l.label,
        category: "view",
        shortcut: l.shortcut,
      })
    }
  }
  // Child visibility (specs/052) — the second axis over the layouts above.
  const visibilities = [
    { children: "all", label: "Children: show all", shortcut: "v a" },
    { children: "hide-done", label: "Children: hide the done ones", shortcut: "v d" },
    { children: "none", label: "Children: hide all", shortcut: "v n" },
  ] as const
  for (const v of visibilities) {
    if (ctx.children !== v.children) {
      commands.push({
        id: `children:${v.children}`,
        label: v.label,
        category: "view",
        shortcut: v.shortcut,
      })
    }
  }
  commands.push(
    {
      id: "view:epic-tags",
      label: ctx.showEpics ? "Hide epic tags" : "Show epic tags",
      category: "view",
      shortcut: "t e",
    },
    {
      id: "view:label-tags",
      label: ctx.showLabels ? "Hide label tags" : "Show label tags",
      category: "view",
      shortcut: "t l",
    },
    { id: "view:filter", label: "Filter this board…", category: "view", shortcut: "/" },
  )
  if (ctx.filtered) {
    commands.push({
      id: "view:clear-filter",
      label: "Clear the filter",
      category: "view",
      shortcut: "esc",
    })
    commands.push({
      id: "view:subtask-scope",
      label:
        ctx.subtaskScope === "inherit"
          ? "Filter sub-tasks on their own merits"
          : "Keep sub-tasks of a matching parent",
      category: "view",
      shortcut: "⇧F",
    })
  }
  commands.push(
    { id: "fold:open-all", label: "Unfold everything", category: "view", shortcut: "z ⇧R" },
    { id: "fold:close-all", label: "Fold everything", category: "view", shortcut: "z ⇧M" },
  )

  commands.push(
    { id: "board:refresh", label: "Refresh the board", category: "board", shortcut: "r" },
    { id: "board:search", label: "Search Jira…", category: "board", shortcut: ":" },
  )

  commands.push({ id: "tab:clone", label: "Clone this tab", category: "tabs", shortcut: "⇧T c" })
  if (ctx.ownTab) {
    commands.push(
      { id: "tab:rename", label: "Rename this tab", category: "tabs", shortcut: "⇧T r" },
      { id: "tab:close", label: "Close this tab", category: "tabs", shortcut: "⇧T x" },
    )
  }
  if (ctx.tabCount > 1) {
    commands.push(
      { id: "tab:next", label: "Next tab", category: "tabs", shortcut: "]" },
      { id: "tab:prev", label: "Previous tab", category: "tabs", shortcut: "[" },
    )
  }

  commands.push(
    { id: "app:help", label: "Keyboard shortcuts", category: "app", shortcut: "?" },
    { id: "app:quit", label: "Quit lane", category: "app", shortcut: "q" },
  )

  return commands
}
