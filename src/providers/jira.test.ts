import { expect, test } from "bun:test"
import { rankFailure, resolveSprint, toHistory } from "./jira"

test("the changelog comes out newest first whichever way Jira sent it, minus the churn", () => {
  const history = toHistory({
    histories: [
      {
        created: "2026-08-05T11:32:00.000+0200",
        author: { displayName: "Lukas" },
        items: [{ field: "status", fromString: "To Do", toString: "In Progress" }],
      },
      {
        created: "2026-09-03T11:58:00.000+0200",
        author: { displayName: "Automation Bot" },
        items: [{ field: "Rank", fromString: null, toString: "Ranked higher" }],
      },
      {
        created: "2026-08-28T08:28:00.000+0200",
        author: { displayName: "Patrick" },
        items: [
          { field: "assignee", fromString: null, toString: "Patrick" },
          { field: "timespent", fromString: null, toString: "3600" },
        ],
      },
    ],
  })
  expect(history.map((h) => h.author)).toEqual(["Patrick", "Lukas"])
  expect(history[0]!.items).toEqual([{ field: "assignee", from: undefined, to: "Patrick" }])
})

// The agile rank endpoint answers a refused rank with 207 + entries, which fetch's
// `ok` treats as success — rankFailure is what turns that body back into an error.

test("a successful rank has no body (204) and no failure", () => {
  expect(rankFailure(undefined)).toBeNull()
})

test("entries without errors are fine", () => {
  expect(rankFailure({ entries: [{ issueKeys: ["SHOP-1"], status: 200, errors: [] }] })).toBeNull()
})

test("a refused rank surfaces Jira's own message", () => {
  const result = {
    entries: [
      { issueKeys: ["SHOP-1"], status: 409, errors: ["Rank field is not available for issue"] },
    ],
  }
  expect(rankFailure(result)).toBe("Rank field is not available for issue")
})

test("a refusal without a message still fails, naming the issue and status", () => {
  expect(rankFailure({ entries: [{ issueKeys: ["SHOP-9"], status: 403 }] })).toBe(
    "rank refused for SHOP-9 (HTTP 403)",
  )
})

test("a malformed body is not treated as failure", () => {
  expect(rankFailure({ entries: "nope" })).toBeNull()
  expect(rankFailure("text")).toBeNull()
})

// Board 42 shows sprints board 7 created: the field's `boardId` names the creator,
// so only the board's own sprint list says which of an issue's sprints it shows.

const borrowed = { id: 195, name: "Sprint 195", state: "active", boardId: 7 }
const own = { id: 197, name: "Sprint 197", state: "future", boardId: 42 }
const twin = { id: 9195, name: "Sprint 195", state: "active", boardId: 7 }

test("a sprint the board shows counts though another board created it", () => {
  expect(resolveSprint([borrowed, own], new Set([195, 197]))?.id).toBe(195)
})

test("a same-named sprint the board doesn't show is dropped", () => {
  expect(resolveSprint([twin], new Set([195, 197]))).toBeUndefined()
  expect(resolveSprint([twin, own], new Set([195, 197]))?.id).toBe(197)
})

test("without a board's sprint list every live sprint counts", () => {
  expect(resolveSprint([twin])?.id).toBe(9195)
})

test("comments join the changelog by time, newest first, as Markdown", () => {
  const history = toHistory(
    {
      histories: [
        {
          created: "2026-09-02T10:00:00.000Z",
          author: { displayName: "Lukas" },
          items: [{ field: "status", fromString: "To Do", toString: "In Progress" }],
        },
      ],
    },
    {
      comments: [
        {
          created: "2026-09-03T08:00:00.000Z",
          author: { displayName: "Patrick" },
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "mention", attrs: { id: "x", text: "@Lukas" } },
                  { type: "text", text: " fixed in " },
                  { type: "text", text: "#412", marks: [{ type: "strong" }] },
                ],
              },
            ],
          },
        },
        { created: "2026-09-01T08:00:00.000Z", author: { displayName: "Lukas" }, body: "first" },
      ],
    },
  )
  expect(history.map((h) => h.author)).toEqual(["Patrick", "Lukas", "Lukas"])
  expect(history[0]!.comment).toBe("@Lukas fixed in **#412**")
  expect(history[1]!.comment).toBeUndefined()
})
