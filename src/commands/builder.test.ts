import { expect, test } from "bun:test"
import { buildCommands } from "./builder"
import type { CommandContext } from "./types"

const BASE: CommandContext = {
  issueKey: "SHOP-1",
  view: "board",
  grouping: "swimlanes",
  hasSwimlanes: true,
  hasSprints: false,
  showEpics: true,
  showLabels: true,
  subtasks: "own-column",
  children: "all",
  filtered: false,
  subtaskScope: "strict",
  canCreate: true,
  canResolve: true,
  issueDone: false,
  selectionCount: 0,
  tabCount: 2,
  ownTab: false,
}

const ids = (ctx: Partial<CommandContext> = {}) =>
  buildCommands({ ...BASE, ...ctx }).map((c) => c.id)

test("the reason command says whether it closes the issue or amends a closed one", () => {
  const label = (ctx: Partial<CommandContext>) =>
    buildCommands({ ...BASE, ...ctx }).find((c) => c.id === "issue:resolution")?.label
  expect(label({ issueDone: false })).toBe("Close SHOP-1 as…")
  expect(label({ issueDone: true })).toBe("Change why SHOP-1 closed…")
  // A source that can't report resolutions offers no reason at all (specs/053).
  expect(ids({ canResolve: false })).not.toContain("issue:resolution")
})

test("issue commands need an issue, and name the one they would act on", () => {
  const commands = buildCommands(BASE)
  expect(commands.find((c) => c.id === "issue:status")?.label).toBe("Set status of SHOP-1…")
  expect(ids({ issueKey: null }).filter((id) => id.startsWith("issue:"))).toEqual([
    "issue:new",
    "issue:new-top",
  ])
})

test("the field commands descend into a submenu instead of acting", () => {
  const submenus = buildCommands(BASE).filter((c) => c.submenu)
  expect(submenus.map((c) => c.submenu)).toEqual([
    "status",
    "assign",
    "labels",
    "epic",
    "resolution",
  ])
})

test("the copy commands follow the multi-select", () => {
  const label = (id: string, ctx: Partial<CommandContext>) =>
    buildCommands({ ...BASE, ...ctx }).find((c) => c.id === id)?.label
  expect(label("issue:copy-key", { selectionCount: 3 })).toBe("Copy 3 selected keys")
  expect(label("issue:copy-url", { selectionCount: 1 })).toBe("Copy 1 selected URL")
  expect(label("issue:copy-title", { selectionCount: 0 })).toBe("Copy SHOP-1 title")
  // A selection keeps the copy commands alive with the cursor on nothing…
  expect(ids({ issueKey: null, selectionCount: 2 })).toContain("issue:copy-key")
  // …but the single-issue description copy still needs a focused issue.
  expect(ids({ issueKey: null, selectionCount: 2 })).not.toContain("issue:copy-description")
})

test("the field editors follow the multi-select", () => {
  const label = (id: string, ctx: Partial<CommandContext>) =>
    buildCommands({ ...BASE, ...ctx }).find((c) => c.id === id)?.label
  expect(label("issue:status", { selectionCount: 3 })).toBe("Set status of 3 selected…")
  expect(label("issue:resolution", { selectionCount: 3 })).toBe("Close 3 selected as…")
  // A selection keeps the field editors alive with the cursor on nothing…
  expect(ids({ issueKey: null, selectionCount: 2 })).toContain("issue:assign")
  // …but the single-issue commands still need a focused issue.
  expect(ids({ issueKey: null, selectionCount: 2 })).not.toContain("issue:detail")
})

test("a query tab can't create issues", () => {
  expect(ids({ canCreate: false })).not.toContain("issue:new")
})

test("the view you are in is not offered", () => {
  expect(ids({ view: "board" })).not.toContain("view:board")
  expect(ids({ view: "list" })).toContain("view:board")
  expect(ids({ grouping: "type" })).not.toContain("group:type")
})

test("swimlane grouping is offered only where the board defines lanes", () => {
  expect(ids({ grouping: "none", hasSwimlanes: false })).not.toContain("group:swimlanes")
  expect(ids({ grouping: "none", hasSwimlanes: true })).toContain("group:swimlanes")
})

test("tag toggles say which way they will flip", () => {
  const shown = buildCommands({ ...BASE, showLabels: true })
  const hidden = buildCommands({ ...BASE, showLabels: false })
  expect(shown.find((c) => c.id === "view:label-tags")?.label).toBe("Hide label tags")
  expect(hidden.find((c) => c.id === "view:label-tags")?.label).toBe("Show label tags")
})

test("clearing a filter is offered only when one is set", () => {
  expect(ids({ filtered: false })).not.toContain("view:clear-filter")
  expect(ids({ filtered: true })).toContain("view:clear-filter")
})

test("only an ad-hoc tab can be renamed or closed", () => {
  expect(ids({ ownTab: false })).not.toContain("tab:close")
  expect(ids({ ownTab: true })).toContain("tab:close")
})

test("tab stepping needs somewhere to step to", () => {
  expect(ids({ tabCount: 1 })).not.toContain("tab:next")
})

test("every command id is unique", () => {
  const all = ids({ issueKey: "SHOP-1", filtered: true, ownTab: true })
  expect(new Set(all).size).toBe(all.length)
})

test("sprint grouping is offered only where the loaded board has sprints", () => {
  expect(ids({ grouping: "none", hasSprints: false })).not.toContain("group:sprint")
  expect(ids({ grouping: "none", hasSprints: true })).toContain("group:sprint")
  expect(ids({ grouping: "sprint", hasSprints: true })).not.toContain("group:sprint")
})

test("the sub-task layouts you are not in are offered, the one you are in is not", () => {
  expect(ids({ subtasks: "basket" }).filter((id) => id.startsWith("subtasks:"))).toEqual([
    "subtasks:own-column",
    "subtasks:under-parent",
    "subtasks:checklist",
  ])
})

test("the child visibilities you are not in are offered", () => {
  expect(ids({ children: "hide-done" }).filter((id) => id.startsWith("children:"))).toEqual([
    "children:all",
    "children:none",
  ])
})
