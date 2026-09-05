import { expect, test } from "bun:test"
import { createMockProvider } from "./providers/mock"
import {
  applyFilter,
  isEmptyQuery,
  lastToken,
  parseQuery,
  replaceLastToken,
  suggestions,
} from "./filter"
import type { Board } from "./types"

const board: Board = await createMockProvider().loadBoard()
const ctx = { columns: board.columns, currentUser: "Grace Hopper" }
const keysFor = (q: string) => applyFilter(board, parseQuery(q), ctx).map((t) => t.key)

// ---- parsing ----

test("splits fields from free text; @ is assignee sugar", () => {
  const q = parseQuery("type:bug @ada is:review p:high past pack")
  expect(q.fields.type).toEqual(["bug"])
  expect(q.fields.assignee).toEqual(["ada"])
  expect(q.fields.status).toEqual(["review"])
  expect(q.fields.priority).toEqual(["high"])
  expect(q.text).toBe("past pack")
})

test("quoted values keep their spaces", () => {
  expect(parseQuery('assignee:"Ada Lovelace"').fields.assignee).toEqual(["Ada Lovelace"])
})

test("a valueless field token is in-progress, not free text", () => {
  const q = parseQuery("type:")
  expect(q.fields.type).toEqual([])
  expect(q.text).toBe("")
  expect(isEmptyQuery(q)).toBe(true)
})

test("unknown field falls back to free text", () => {
  expect(parseQuery("foo:bar").text).toBe("foo:bar")
})

// ---- applying ----

test("empty query returns every task", () => {
  expect(keysFor("").length).toBe(board.tasks.length)
})

test("type filter narrows to that type (plus kept parents)", () => {
  // SHOP-60420 is the only bug and is a root, so no parent is pulled in.
  expect(keysFor("type:bug")).toEqual(["SHOP-60420"])
})

test("repeated field is OR within the field", () => {
  const bugsAndStories = keysFor("type:bug type:story")
  expect(bugsAndStories).toContain("SHOP-60420") // bug
  expect(bugsAndStories).toContain("SHOP-60411") // story
})

test("fields AND across each other", () => {
  // priority:highest only holds on the bug SHOP-60420; combined with type:story → none.
  expect(keysFor("type:story priority:highest")).toEqual([])
})

test("assignee:me resolves to the current user", () => {
  const mine = keysFor("assignee:me")
  expect(mine).toContain("SHOP-60411")
  expect(mine).not.toContain("SHOP-60416") // unassigned backend sub-task
})

test("assignee:none matches the unassigned", () => {
  expect(keysFor("assignee:none")).toContain("SHOP-60416")
})

test("status filter matches by column title substring", () => {
  const review = keysFor("is:review")
  expect(review).toContain("SHOP-60417") // In Review sub-task
})

test("a matching sub-task keeps its parent for lane context", () => {
  // "[UX] Define Empty State" (SHOP-60418) matches; its parent SHOP-60412 is kept
  // even though the parent's summary doesn't contain "empty".
  const r = keysFor("empty")
  expect(r).toContain("SHOP-60418")
  expect(r).toContain("SHOP-60412")
})

test("free text fuzzy-matches key and summary", () => {
  expect(keysFor("past ord")).toContain("SHOP-60412")
})

test("free text (no field:) searches the assignee too", () => {
  // SHOP-60421 is assigned to Ada Lovelace and has no summary/key match for "lovelace".
  expect(keysFor("lovelace")).toContain("SHOP-60421")
})

test("free text searches labels, status, and type", () => {
  expect(keysFor("PO")).toContain("SHOP-60420") // label "PO"
  expect(keysFor("review")).toContain("SHOP-60421") // In Review column
})

test("free text reaches through to the linked epic's summary", () => {
  // "cockpit" only appears on the epic SHOP-60400; the stories linked to it match
  // via their epic, and the epic itself matches on its own summary.
  const r = keysFor("cockpit")
  expect(r).toContain("SHOP-60411")
  expect(r).toContain("SHOP-60412")
  expect(r).toContain("SHOP-60400")
})

test("free text with no match anywhere returns nothing", () => {
  expect(keysFor("zzqqxx")).toEqual([])
})

// ---- labels ----

test("# is label sugar; label:/labels:/l: are aliases", () => {
  expect(parseQuery("#UX").fields.label).toEqual(["UX"])
  expect(parseQuery("label:UX").fields.label).toEqual(["UX"])
  expect(parseQuery("labels:UX").fields.label).toEqual(["UX"])
  expect(parseQuery("l:UX").fields.label).toEqual(["UX"])
})

test("label filter matches the whole label, case-insensitively", () => {
  // SHOP-60412 carries "UX"; SHOP-60420 carries "PO" (mock seed).
  expect(keysFor("#UX")).toEqual(["SHOP-60412"])
  expect(keysFor("label:ux")).toEqual(["SHOP-60412"])
  // Atomic, not a substring: a partial label doesn't match.
  expect(keysFor("label:U")).toEqual([])
})

test("labels OR within the field, AND across fields", () => {
  const either = keysFor("#UX #PO")
  expect(either).toContain("SHOP-60412")
  expect(either).toContain("SHOP-60420")
  // AND with type: only the story keeps
  expect(keysFor("#UX #PO type:story")).toEqual(["SHOP-60412"])
})

test("a valueless label token is in-progress", () => {
  expect(isEmptyQuery(parseQuery("label:"))).toBe(true)
})

test("label suggestions offer known labels with counts; # narrows", () => {
  const all = suggestions("label:", board, ctx).map((x) => x.insert)
  expect(all).toContain("label:UX")
  expect(all).toContain("label:PO")
  const narrowed = suggestions("#u", board, ctx)
  expect(narrowed[0]!.insert).toBe("#UX")
})

// ---- epic ----

test("epic:/e: are aliases for the epic field", () => {
  expect(parseQuery("epic:SHOP-60400").fields.epic).toEqual(["SHOP-60400"])
  expect(parseQuery("e:SHOP-60400").fields.epic).toEqual(["SHOP-60400"])
})

test("epic filter matches the linked epic by key substring", () => {
  // SHOP-60411, SHOP-60412 and the backlog's SHOP-60430 link to epic SHOP-60400; the
  // epic itself has no epic link, so a scoped epic: filter excludes it (unlike free
  // text). Filtering spans the whole source — the board/backlog split is a view
  // concern (specs/044), applied after.
  expect(keysFor("epic:60400")).toEqual(["SHOP-60411", "SHOP-60412", "SHOP-60430"])
})

test("epic filter matches the epic's name too", () => {
  // The children carry the epic's name "Customer order cockpit" (resolved by the provider).
  expect(keysFor("epic:cockpit")).toEqual(["SHOP-60411", "SHOP-60412", "SHOP-60430"])
})

test("epic:none matches issues with no epic", () => {
  const none = keysFor("epic:none")
  expect(none).toContain("SHOP-60400") // the epic itself
  expect(none).toContain("SHOP-60420") // a loose bug
  // (Epic-linked stories like SHOP-60411 are still kept here — the keep-parents rule
  // pulls them back in because their own sub-tasks carry no epic and so match.)
})

test("epic suggestions offer referenced epics with their names", () => {
  const s = suggestions("epic:", board, ctx)
  const cockpit = s.find((x) => x.insert === "epic:SHOP-60400")
  expect(cockpit).toBeDefined()
  expect(cockpit!.label).toBe("Customer order cockpit")
  expect(suggestions("epic:cock", board, ctx).map((x) => x.insert)).toContain("epic:SHOP-60400")
})

// ---- negation ----

test("- (or !) negates a field token", () => {
  const q = parseQuery("-type:bug !#PO @ada")
  expect(q.negFields.type).toEqual(["bug"])
  expect(q.negFields.label).toEqual(["PO"])
  expect(q.fields.assignee).toEqual(["ada"]) // positive still works alongside
  expect(q.fields.type).toEqual([])
})

test("negated field excludes matching tasks", () => {
  // SHOP-60420 is the only bug and a leaf → cleanly excluded.
  expect(keysFor("-type:bug")).not.toContain("SHOP-60420")
  expect(keysFor("-type:bug")).toContain("SHOP-60411")
  // SHOP-60420 carries "PO" and has no children to pull it back.
  expect(keysFor("-#PO")).not.toContain("SHOP-60420")
})

test("positive and negated compose", () => {
  // Stories without the UX label: SHOP-60411 (no label) stays, SHOP-60412 (UX) drops;
  // its sub-tasks don't match type:story so they can't pull it back. The unlabelled
  // backlog stories qualify too — they're only split off when a view renders.
  expect(keysFor("type:story -#UX")).toEqual(["SHOP-60411", "SHOP-60430", "SHOP-60433"])
})

test("a valueless negated token is in-progress", () => {
  expect(isEmptyQuery(parseQuery("-type:"))).toBe(true)
})

test("suggestions carry the negation sign", () => {
  expect(suggestions("-ty", board, ctx).map((x) => x.insert)).toContain("-type:")
  expect(suggestions("-label:", board, ctx).map((x) => x.insert)).toContain("-label:UX")
})

// ---- token helpers ----

test("lastToken / replaceLastToken operate on the trailing token", () => {
  expect(lastToken("type:bug assi")).toBe("assi")
  expect(replaceLastToken("type:bug assi", "assignee:")).toBe("type:bug assignee:")
})

// ---- suggestions ----

test("bare partial suggests field starters", () => {
  const s = suggestions("assi", board, ctx)
  expect(s.map((x) => x.insert)).toContain("assignee:")
})

test("open field suggests its values with counts, most-used first", () => {
  const s = suggestions("type:", board, ctx)
  const inserts = s.map((x) => x.insert)
  expect(inserts).toContain("type:subtask")
  expect(inserts).toContain("type:story")
  // subtask is the most common type in the seed → ranked first
  expect(s[0]!.insert).toBe("type:subtask")
  expect(s[0]!.detail).toBeDefined()
})

test("partial value narrows suggestions", () => {
  const s = suggestions("@ada", board, ctx)
  expect(s.every((x) => /ada/i.test(x.label))).toBe(true)
  expect(s[0]!.insert.toLowerCase()).toContain("ada")
})

test("assignee suggestions quote names with spaces", () => {
  const s = suggestions("assignee:lov", board, ctx)
  expect(s[0]!.insert).toBe('assignee:"Ada Lovelace"')
})

// ---- sub-task scope (specs/043) ----

const inheritCtx = { ...ctx, subtaskScope: "inherit" as const }
const inheritKeys = (q: string) => applyFilter(board, parseQuery(q), inheritCtx).map((t) => t.key)

test("inherit scope keeps every sub-task of a matching parent", () => {
  // SHOP-60414 (unassigned) and SHOP-60416/17/18 (other people) hang off parents
  // assigned to me — strict drops them, inherit keeps the work items whole.
  expect(keysFor("@me")).not.toContain("SHOP-60414")
  const mine = inheritKeys("@me")
  expect(mine).toContain("SHOP-60414")
  expect(mine).toContain("SHOP-60417")
  expect(mine).toContain("SHOP-60418")
})

test("inherit scope doesn't widen a parent kept only for context", () => {
  // "empty" matches the sub-task SHOP-60418; its parent SHOP-60412 rides along, but
  // that must not pull in the parent's other children.
  const r = inheritKeys("empty")
  expect(r).toEqual(["SHOP-60412", "SHOP-60418"])
})

test("scope is irrelevant to an empty query", () => {
  expect(inheritKeys("")).toEqual(keysFor(""))
})
