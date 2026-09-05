import { expect, test } from "bun:test"
import {
  cloneOf,
  insertBySource,
  querySourceId,
  reconcile,
  restoreQuerySources,
  type BoardSource,
  type QuerySpec,
  type Tab,
} from "./tabs"

// Enough of a provider to be wrapped: `querySource` binds the delegated mutations.
const stubProvider = (): BoardSource["provider"] => ({
  loadBoard: () => Promise.resolve({ columns: [], tasks: [] }),
  moveTask: () => Promise.resolve(),
  createIssue: () => Promise.reject(new Error("unused")),
  editSummary: () => Promise.resolve(),
  setLabels: () => Promise.resolve(),
  setEpic: () => Promise.resolve(),
  assignTask: () => Promise.resolve(),
})

const source = (id: string, swimlanes?: { name: string; jql: string }[]): BoardSource => ({
  id,
  name: id,
  provider: stubProvider(),
  cacheKey: id,
  swimlanes,
})

const spec = (originSourceId: string): QuerySpec => ({
  kind: "query",
  jql: 'text ~ "parcel*"',
  originSourceId,
})

const tab = (id: string, sourceId: string, adHoc?: boolean): Tab => ({
  id,
  name: id,
  sourceId,
  projection: { mode: "board", query: "", grouping: "parent" },
  adHoc,
})

test("insertBySource: a clone lands after the last tab of its board", () => {
  const tabs = [tab("board:a", "a"), tab("backlog:a", "a"), tab("board:b", "b")]
  const next = insertBySource(tabs, tab("adhoc:1", "a", true))
  expect(next.map((t) => t.id)).toEqual(["board:a", "backlog:a", "adhoc:1", "board:b"])
})

test("insertBySource: a tab whose board has no tabs yet goes last", () => {
  const next = insertBySource([tab("board:a", "a")], tab("adhoc:1", "b", true))
  expect(next.map((t) => t.id)).toEqual(["board:a", "adhoc:1"])
})

test("cloneOf: copies the projection but not the identity", () => {
  const origin: Tab = {
    ...tab("board:a", "a"),
    projection: { mode: "backlog", query: "assignee:me", grouping: "type" },
  }
  const clone = cloneOf(origin, "mine", "adhoc:1")
  expect(clone).toEqual({
    id: "adhoc:1",
    name: "mine",
    sourceId: "a",
    projection: { mode: "backlog", query: "assignee:me", grouping: "type" },
    adHoc: true,
  })
  clone.projection.query = "changed"
  expect(origin.projection.query).toBe("assignee:me")
})

test("reconcile: a swimlane grouping the board can't offer falls back to parent", () => {
  const saved = { mode: "board" as const, query: "#UX", grouping: "swimlanes" as const }
  expect(reconcile(saved, source("a")).grouping).toBe("parent")
  expect(reconcile(saved, source("a", [{ name: "UX", jql: "" }])).grouping).toBe("swimlanes")
  expect(reconcile(saved, source("a")).query).toBe("#UX")
})

test("reconcile: tag visibility survives the trip through a restored session", () => {
  const saved = {
    mode: "board" as const,
    query: "",
    grouping: "parent" as const,
    epics: false,
    labels: false,
  }
  expect(reconcile(saved, source("a"))).toMatchObject({ epics: false, labels: false })
})

test("querySourceId: the same query is the same source, a changed one is not", () => {
  expect(querySourceId('text ~ "parcel*"')).toBe(querySourceId('text ~ "parcel*"'))
  expect(querySourceId('text ~ "parcel*"')).not.toBe(querySourceId('text ~ "parcels*"'))
})

test("restoreQuerySources: rebuilt once per query, from its origin board", () => {
  const config = [source("Checkout"), source("Other")]
  const saved = [
    { ...tab("adhoc:1:query:x", "query:x", true), source: spec("Checkout") },
    { ...tab("adhoc:2:query:x", "query:x", true), source: spec("Checkout") },
  ]
  const built = restoreQuerySources(saved, config)
  expect(built).toHaveLength(1)
  expect(built[0]!.query).toBe('text ~ "parcel*"')
})

test("restoreQuerySources: a tab whose origin board left the config rebuilds nothing", () => {
  const saved = [{ ...tab("adhoc:1:query:x", "query:x", true), source: spec("Gone") }]
  expect(restoreQuerySources(saved, [source("Checkout")])).toEqual([])
})

test("cloneOf: a clone of a query tab can rebuild the source too", () => {
  const original = { ...tab("adhoc:1:query:x", "query:x", true), source: spec("Checkout") }
  expect(cloneOf(original, "copy", "adhoc:2:query:x").source).toEqual(spec("Checkout"))
})
