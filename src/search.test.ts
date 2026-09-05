import { expect, test } from "bun:test"
import { buildSearchQuery } from "./search"
import type { Board } from "./types"

const scope = { jql: "cf[10001] = abc", label: "Checkout" }

test("words become a text search inside the scope, the last one wildcarded", () => {
  // Jira matches whole words, so the word still being typed needs a `*` or a search
  // reads "0 found" until it happens to be finished (measured against SHOP).
  expect(buildSearchQuery("parcel rollb", { scope })?.jql).toBe(
    '(cf[10001] = abc) AND (text ~ "parcel rollb*") ORDER BY updated DESC',
  )
})

test("a trailing space means the word is finished", () => {
  expect(buildSearchQuery("parcel ", { scope })?.jql).toContain('text ~ "parcel"')
})

test("a wildcard you typed yourself is left alone", () => {
  expect(buildSearchQuery("esi*", { scope })?.jql).toContain('text ~ "esi*"')
})

test("an issue key addresses the issue directly, unscoped", () => {
  // Looking up a key from another team is exactly when you know the key.
  expect(buildSearchQuery("shop-61317", { scope })).toEqual({
    jql: "key = SHOP-61317",
    kind: "key",
  })
})

test("a bare number resolves against the active project", () => {
  expect(buildSearchQuery("61317", { scope, project: "SHOP" })?.jql).toBe("key = SHOP-61317")
  // Without a project to resolve against it is just text.
  expect(buildSearchQuery("61317", { scope })?.kind).toBe("text")
})

test("JQL runs verbatim, still inside the scope", () => {
  const q = buildSearchQuery('status = "In Refinement" AND assignee = currentUser()', { scope })
  expect(q?.kind).toBe("jql")
  expect(q?.jql).toBe(
    '(cf[10001] = abc) AND (status = "In Refinement" AND assignee = currentUser()) ORDER BY updated DESC',
  )
})

test("a leading ? forces the words reading", () => {
  const q = buildSearchQuery("?status = broken", { scope })
  expect(q?.kind).toBe("text")
  expect(q?.jql).toContain('text ~ "status = broken*"')
})

test("no scope searches the whole instance", () => {
  expect(buildSearchQuery("parcel ")?.jql).toBe('text ~ "parcel" ORDER BY updated DESC')
})

test("quotes in the input can't break out of the literal", () => {
  expect(buildSearchQuery('say "hi"')?.jql).toBe('text ~ "say \\"hi\\"" ORDER BY updated DESC')
})

test("empty input is no query", () => {
  expect(buildSearchQuery("   ", { scope })).toBeNull()
})

// ---- the filter grammar as JQL (specs/048) ---------------------------------

const board: Board = {
  columns: [
    { id: "to-do", title: "To Do" },
    { id: "in-review", title: "In Review" },
  ],
  tasks: [
    {
      key: "SHOP-1",
      summary: "a",
      type: "story",
      priority: "medium",
      columnId: "to-do",
      assignee: "Ada Lovelace",
      assigneeId: "acct-ada",
      epicKey: "SHOP-900",
      epicName: "Returns rollback",
    },
  ],
}

const jqlFor = (input: string, ctx = {}) => buildSearchQuery(input, { board, ...ctx })?.jql

test("grammar: a field token becomes a clause, not a text search", () => {
  expect(jqlFor("epic:SHOP-900")).toBe('parent = "SHOP-900" ORDER BY updated DESC')
})

test("grammar: an epic named rather than keyed resolves through the loaded board", () => {
  expect(jqlFor("epic:rollback")).toBe('parent = "SHOP-900" ORDER BY updated DESC')
})

test("grammar: a custom epic-link field is named as one", () => {
  expect(jqlFor("epic:SHOP-900", { epicField: "customfield_10014" })).toBe(
    '"customfield_10014" = "SHOP-900" ORDER BY updated DESC',
  )
})

test("grammar: labels, types and priorities translate", () => {
  expect(jqlFor("#UX")).toBe('labels = "UX" ORDER BY updated DESC')
  expect(jqlFor("type:bug")).toBe('issuetype = "Bug" ORDER BY updated DESC')
  expect(jqlFor("p:high")).toBe('priority = "High" ORDER BY updated DESC')
})

test("grammar: a sub-task type uses the function, since the name is localised", () => {
  expect(jqlFor("type:subtask")).toBe("issuetype in subTaskIssueTypes() ORDER BY updated DESC")
})

test("grammar: a status shorthand resolves through the board's columns", () => {
  expect(jqlFor("is:review")).toBe('status = "In Review" ORDER BY updated DESC')
})

test("grammar: @me is currentUser(), a name is its accountId", () => {
  expect(jqlFor("@me")).toBe("assignee = currentUser() ORDER BY updated DESC")
  expect(jqlFor("@ada")).toBe('assignee = "acct-ada" ORDER BY updated DESC')
})

test("grammar: a person the board doesn't know is reported, not guessed at", () => {
  const built = buildSearchQuery("@nobody parcel", { board })
  expect(built?.unresolved).toEqual(["@nobody"])
  expect(built?.jql).toBe('text ~ "parcel*" ORDER BY updated DESC')
})

test("grammar: repeated fields OR within, fields AND across — as / reads them", () => {
  expect(jqlFor("type:bug type:story #UX")).toBe(
    '(issuetype = "Bug" OR issuetype = "Story") AND labels = "UX" ORDER BY updated DESC',
  )
})

test("grammar: negation wraps the positive clause", () => {
  expect(jqlFor("-#UX")).toBe('NOT (labels = "UX") ORDER BY updated DESC')
})

test("grammar: leftover words stay a prefix-wildcarded text search", () => {
  expect(jqlFor("#UX parcel roll")).toBe(
    'labels = "UX" AND text ~ "parcel roll*" ORDER BY updated DESC',
  )
})

test("grammar: a finished word keeps its trailing space meaning", () => {
  expect(jqlFor("parcel ")).toBe('text ~ "parcel" ORDER BY updated DESC')
})

test("grammar: an in-progress field token is not yet a query", () => {
  expect(buildSearchQuery("epic:", { board })).toBeNull()
})

test("raw JQL still passes through untouched", () => {
  expect(jqlFor("parent = SHOP-900 AND status != Done")).toBe(
    "parent = SHOP-900 AND status != Done ORDER BY updated DESC",
  )
})

test("a scope wraps whatever the grammar produced", () => {
  expect(jqlFor("#UX", { scope: { jql: "team = 42", label: "Checkout" } })).toBe(
    '(team = 42) AND (labels = "UX") ORDER BY updated DESC',
  )
})

test("grammar: a partial epic key resolves the way / matches it", () => {
  expect(jqlFor("epic:900")).toBe('parent = "SHOP-900" ORDER BY updated DESC')
})

test("grammar: a query whose every term was dropped reports instead of running", () => {
  const built = buildSearchQuery("@nobody", { board })
  expect(built?.jql).toBe("")
  expect(built?.unresolved).toEqual(["@nobody"])
})
