import { expect, test } from "bun:test"
import {
  discardIssue,
  isPendingKey,
  landPending,
  pendingKey,
  withPendingGuard,
} from "./pendingCreate"
import type { BoardProvider } from "./providers/provider"
import type { Board, Task } from "./types"

const task = (key: string, extra: Partial<Task> = {}): Task => ({
  key,
  summary: key,
  type: "task",
  priority: "medium",
  columnId: "todo",
  ...extra,
})

/** Records every write; `deleteIssue`/`listResolutions` are overridable per test. */
function fakeProvider(overrides: Partial<BoardProvider> = {}) {
  const calls: string[] = []
  const provider = {
    async moveTask(key: string, to: string, resolution?: string) {
      calls.push(`move ${key} ${to} ${resolution}`)
    },
    async rankTask(keys: string[], anchor: { before: string } | { after: string }) {
      calls.push(`rank ${keys.join(",")} ${JSON.stringify(anchor)}`)
    },
    async createIssue(input: { summary: string; parentKey?: string }) {
      calls.push(`create ${input.summary}`)
      return task("SHOP-9")
    },
    issueUrl: (key: string) => `https://jira.example.com/browse/${key}`,
    ...overrides,
  } as unknown as BoardProvider
  return { provider, calls }
}

test("placeholder keys never look like a Jira key", () => {
  expect(isPendingKey(pendingKey(1))).toBe(true)
  expect(isPendingKey("SHOP-1")).toBe(false)
  expect(isPendingKey(null)).toBe(false)
})

test("the guard refuses a write naming a placeholder, wherever the key sits", async () => {
  const { provider, calls } = fakeProvider()
  const guarded = withPendingGuard(provider)
  const temp = pendingKey(1)
  await expect(guarded.moveTask(temp, "done")).rejects.toThrow("still being created")
  await expect(guarded.rankTask!(["SHOP-1"], { before: temp })).rejects.toThrow()
  await expect(guarded.rankTask!([temp, "SHOP-2"], { after: "SHOP-3" })).rejects.toThrow()
  await expect(
    guarded.createIssue({ type: "subtask", summary: "x", parentKey: temp }),
  ).rejects.toThrow()
  expect(calls).toEqual([])
})

test("the guard lets real keys through untouched", async () => {
  const { provider, calls } = fakeProvider()
  const guarded = withPendingGuard(provider)
  await guarded.moveTask("SHOP-1", "done")
  await guarded.createIssue({ type: "task", summary: "fresh" })
  expect(calls).toEqual(["move SHOP-1 done undefined", "create fresh"])
})

test("a placeholder has no URL, so open and copy-URL do nothing", () => {
  const guarded = withPendingGuard(fakeProvider().provider)
  expect(guarded.issueUrl!(pendingKey(1))).toBeUndefined()
  expect(guarded.issueUrl!("SHOP-1")).toContain("SHOP-1")
})

test("landing swaps the real issue in at the placeholder's slot", () => {
  const temp = pendingKey(1)
  const board: Board = {
    columns: [{ id: "todo", title: "To Do" }],
    tasks: [task("SHOP-1"), task(temp, { epicName: "Checkout" }), task("SHOP-2")],
  }
  const landed = landPending(board, temp, task("SHOP-9"))
  expect(landed.tasks.map((t) => t.key)).toEqual(["SHOP-1", "SHOP-9", "SHOP-2"])
  // What the provider doesn't send back survives from the placeholder.
  expect(landed.tasks[1]!.epicName).toBe("Checkout")
})

test("landing a placeholder that is gone leaves the board alone", () => {
  const board: Board = { columns: [], tasks: [task("SHOP-1")] }
  expect(landPending(board, pendingKey(1), task("SHOP-9"))).toBe(board)
})

test("undo deletes where it may", async () => {
  const { provider, calls } = fakeProvider({
    deleteIssue: async (key: string) => void calls.push(`delete ${key}`),
  })
  expect(await discardIssue(provider, "SHOP-9", "done")).toEqual({ deleted: true })
  expect(calls).toEqual(["delete SHOP-9"])
})

test("a refused delete closes the issue as Won't Do instead", async () => {
  const { provider, calls } = fakeProvider({
    deleteIssue: () => Promise.reject(new Error("403 no permission")),
    listResolutions: async () => ["Done", "Won't Do", "Duplicate"],
  })
  expect(await discardIssue(provider, "SHOP-9", "done")).toEqual({
    deleted: false,
    resolution: "Won't Do",
  })
  expect(calls).toEqual(["move SHOP-9 done Won't Do"])
})

test("without a Won't Do the close carries the default reason", async () => {
  const { provider } = fakeProvider({
    listResolutions: async () => ["Done", "Duplicate"],
    defaultResolution: "Done",
  })
  expect(await discardIssue(provider, "SHOP-9", "done")).toMatchObject({ resolution: "Done" })
})

test("undo rejects only when the close fails too", async () => {
  const { provider } = fakeProvider({
    deleteIssue: () => Promise.reject(new Error("403")),
    moveTask: () => Promise.reject(new Error("transition refused")),
  })
  await expect(discardIssue(provider, "SHOP-9", "done")).rejects.toThrow("transition refused")
})
