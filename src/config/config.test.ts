import { expect, test } from "bun:test"
import { validateConfig } from "./validate"

const parse = (toml: string) => Bun.TOML.parse(toml)

const VALID = `
[jira]
project = "SHOP"
story_points_field = "customfield_10016"
team_field = "customfield_10001"

[[jira.columns]]
title = "To Do"
statuses = ["Open", "Ready"]

[[jira.columns]]
title = "In Progress"
statuses = ["In Progress"]

[[jira.columns]]
title = "Done"
statuses = ["Resolved", "Closed"]

[[boards]]
name = "Checkout Sprint"
jql = "project = SHOP AND sprint in openSprints()"
view = "board"

  [boards.create_defaults]
  components = ["Checkout Platform"]

    [boards.create_defaults.custom]
    team = "c3db8dfc-57"

  [[boards.swimlanes]]
  name = "Critical"
  jql = "priority = Highest"

  [[boards.swimlanes]]
  name = "Everything else"
  jql = ""
`

test("parses a full valid config", () => {
  const cfg = validateConfig(parse(VALID), "test")
  expect(cfg.jira.project).toBe("SHOP")
  expect(cfg.jira.storyPointsField).toBe("customfield_10016")
  // Array-of-tables preserves column order (a plain [jira.columns] map would not).
  expect(cfg.jira.columns.map((c) => c.title)).toEqual(["To Do", "In Progress", "Done"])
  expect(cfg.jira.columns[0]!.statuses).toEqual(["Open", "Ready"])
  const board = cfg.boards[0]!
  expect(board.name).toBe("Checkout Sprint")
  expect(board.view).toBe("board")
  expect(board.createDefaults?.components).toEqual(["Checkout Platform"])
  expect(board.createDefaults?.custom?.team).toBe("c3db8dfc-57")
  expect(board.swimlanes).toEqual([
    { name: "Critical", jql: "priority = Highest" },
    { name: "Everything else", jql: "" }, // catch-all lane allows an empty jql
  ])
})

const MINIMAL = `
[jira]
project = "X"
[[jira.columns]]
title = "T"
statuses = ["S"]
[[boards]]
name = "B"
jql = "q"
`

test("view and optional tables may be omitted", () => {
  const cfg = validateConfig(parse(MINIMAL), "test")
  expect(cfg.boards[0]!.view).toBeUndefined()
  expect(cfg.boards[0]!.swimlanes).toBeUndefined()
  expect(cfg.display).toBeUndefined()
})

test("issue-type name overrides parse, board over instance (specs/012)", () => {
  const cfg = validateConfig(
    parse(`${MINIMAL}
[jira.issue_types]
subtask = "Technical task"
[boards.issue_types]
subtask = "Subtask"
story = "Story"`),
    "test",
  )
  expect(cfg.jira.issueTypes?.subtask).toBe("Technical task")
  expect(cfg.boards[0]!.issueTypes).toEqual({ subtask: "Subtask", story: "Story" })
})

test("an unknown issue kind in issue_types fails clearly", () => {
  expect(() =>
    validateConfig(parse(`${MINIMAL}\n[jira.issue_types]\nfeature = "Feature"`), "t"),
  ).toThrow(/issue_types\.feature/)
})

test("a board may override project + columns (specs/030)", () => {
  const cfg = validateConfig(
    parse(`${MINIMAL}
project = "SANDBOX"
jira_config = "~/.config/lane/jira-sandbox.yml"
  [[boards.columns]]
  title = "Idea"
  statuses = ["Idea"]
  [[boards.columns]]
  title = "Done"
  statuses = ["Done"]`),
    "test",
  )
  const board = cfg.boards[0]!
  expect(board.project).toBe("SANDBOX")
  expect(board.jiraConfig).toBe("~/.config/lane/jira-sandbox.yml")
  expect(board.columns?.map((c) => c.title)).toEqual(["Idea", "Done"])
})

test("parses the display sub-task layout", () => {
  const cfg = validateConfig(parse(`${MINIMAL}\n[display]\nsubtasks = "under-parent"`), "test")
  expect(cfg.display?.subtasks).toBe("under-parent")
})

test("an unknown display.subtasks value fails clearly", () => {
  expect(() => validateConfig(parse(`${MINIMAL}\n[display]\nsubtasks = "sideways"`), "t")).toThrow(
    /display\.subtasks/,
  )
})

test("parses the [refresh] table", () => {
  const cfg = validateConfig(parse(`${MINIMAL}\n[refresh]\ninterval = 120\non_focus = false`), "t")
  expect(cfg.refresh).toEqual({ interval: 120, onFocus: false })
})

test("a negative refresh interval fails clearly", () => {
  expect(() => validateConfig(parse(`${MINIMAL}\n[refresh]\ninterval = -5`), "t")).toThrow(
    /refresh\.interval/,
  )
})

test("parses the [filters] quick-filter table, lowercasing keys (specs/036)", () => {
  const cfg = validateConfig(parse(`${MINIMAL}\n[filters]\nb = "type:bug"\nM = "assignee:me"`), "t")
  expect(cfg.filters).toEqual({ b: "type:bug", m: "assignee:me" })
})

test("a multi-char filter chord key fails clearly", () => {
  expect(() => validateConfig(parse(`${MINIMAL}\n[filters]\nbug = "type:bug"`), "t")).toThrow(
    /filters\.bug/,
  )
})

test("missing boards fails, naming the key", () => {
  expect(() =>
    validateConfig(parse(`[jira]\nproject="X"\n[[jira.columns]]\ntitle="T"\nstatuses=["S"]`), "t"),
  ).toThrow(/boards/)
})

test("an unknown view value fails clearly", () => {
  expect(() =>
    validateConfig(
      parse(`${MINIMAL}\nview = "grid"\n`.replace('jql = "q"', 'jql = "q"\nview = "grid"')),
      "t",
    ),
  ).toThrow(/view/)
})

test("a non-string status is caught with its key path", () => {
  const bad = `[jira]\nproject="X"\n[[jira.columns]]\ntitle="T"\nstatuses=[1]\n[[boards]]\nname="B"\njql="q"`
  expect(() => validateConfig(parse(bad), "t")).toThrow(/statuses/)
})
