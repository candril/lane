import type { Board, Task } from "../types"
import type { BoardProvider, ChangeEntry, IssueDetail } from "./provider"

/**
 * In-memory sample board, shaped like a Jira sprint: an epic, a handful of stories
 * (in backlog order) with sub-tasks spread across statuses, plus a couple of
 * childless issues with no epic (the backlog "No epic" catch-all — specs/034).
 * Exercises the parent- and epic-grouped views (specs/009, specs/034) and the
 * flat/nested and list views.
 *
 * The Jira REST provider (`jira.ts`) fetches the same {@link Board} shape and drops
 * in at the same seam.
 */
/**
 * Descriptions for the seed, kept out of {@link Task} on purpose: a description is
 * fetched per issue, never with the board (specs/007), and putting it on the task
 * would imply otherwise. Written as Markdown, which is what `loadIssue` returns —
 * the ADF conversion is the Jira provider's business, not the mock's.
 *
 * The set deliberately covers the renderer's range: headings, lists, a table, a
 * fenced block, a quote — plus one issue with none, so the empty state shows offline.
 */
/**
 * Seeded changelogs (specs/058), newest first. SHOP-60412 carries a description and a
 * summary edit, so the diff view has something to show offline.
 */
const HISTORY: Record<string, ChangeEntry[]> = {
  "SHOP-60412": [
    {
      at: "2026-09-03T14:12:00.000Z",
      author: "Grace Hopper",
      items: [
        { field: "status", from: "To Do", to: "In Progress" },
        { field: "assignee", to: "Grace Hopper" },
      ],
    },
    {
      at: "2026-09-01T09:30:00.000Z",
      author: "Ada Lovelace",
      items: [
        {
          field: "description",
          from: "Show the orders a customer placed.\n\n- include returned ones",
          to: "Show the orders a customer placed, newest first.\n\n- include returned ones\n- link each to its invoice",
        },
      ],
    },
    {
      at: "2026-08-28T16:05:00.000Z",
      author: "Ada Lovelace",
      items: [
        { field: "summary", from: "Orders", to: "Past orders" },
        { field: "labels", to: "UX" },
      ],
    },
  ],
  // Long enough to run past the viewer's cap, so the "… N more" stop has work to do.
  "SHOP-60400": [
    {
      at: "2026-08-20T10:00:00.000Z",
      author: "Ada Lovelace",
      items: [{ field: "status", from: "To Do", to: "In Progress" }],
    },
    ...Array.from({ length: 12 }, (_, i) => ({
      at: `2026-08-${String(19 - i).padStart(2, "0")}T09:${String(i * 4).padStart(2, "0")}:00.000Z`,
      author: i % 2 ? "Ada Lovelace" : "Grace Hopper",
      items: [{ field: "labels", to: `round-${12 - i}` }],
    })),
  ],
}

const DESCRIPTIONS: Record<string, string> = {
  "SHOP-60400": [
    "A single place to see and manage a customer's orders.",
    "",
    "## Goals",
    "",
    "- One view for **orders**, returns and invoices",
    '- Support can answer *"where is my parcel?"* without three tabs',
    "- No new backend service — compose the existing ones",
    "",
    "## Out of scope",
    "",
    "Billing corrections. Those stay in the finance tool.",
  ].join("\n"),
  "SHOP-60411": [
    "Let a customer cancel an order that has not shipped yet.",
    "",
    "### Acceptance criteria",
    "",
    "1. Cancelling asks for confirmation, naming the order",
    "2. A cancelled order disappears from the cockpit immediately",
    "3. The account stays — cancelling an order is not closing the account",
    "",
    '> Support flagged that customers read "cancel" as "close my account".',
    "> The confirmation copy has to be unambiguous.",
  ].join("\n"),
  "SHOP-60420": [
    "The board crashes when the terminal is narrower than 40 columns.",
    "",
    "## Steps to reproduce",
    "",
    "1. Open the board on a wide terminal",
    "2. Drag the window until it is under 40 columns",
    "3. Move the cursor with `j`",
    "",
    "## Stack",
    "",
    "```",
    "TypeError: undefined is not an object (evaluating 'column.width')",
    "  at layout (Column.tsx:88)",
    "```",
    "",
    "| Terminal | Reproduces |",
    "| --- | --- |",
    "| Ghostty | yes |",
    "| iTerm2 | yes |",
    "| tmux | only when split |",
  ].join("\n"),
  "SHOP-60430": [
    "Let customers top up a gift card before its balance runs out.",
    "",
    "Still in refinement — the [pricing model](https://example.com/pricing) is not",
    "agreed, so the API contract below is a sketch.",
    "",
    "- [x] Agree the states a top-up can be in",
    "- [ ] Decide whether a top-up extends validity",
    "- [ ] Write the contract",
  ].join("\n"),
}

function seed(): Board {
  return {
    columns: [
      { id: "todo", title: "To Do" },
      { id: "in-progress", title: "In Progress" },
      { id: "review", title: "In Review" },
      { id: "done", title: "Done" },
    ],
    backlog: [
      { id: "to-be-discussed", title: "To be discussed" },
      { id: "in-refinement", title: "In refinement" },
    ],
    tasks: [
      {
        key: "SHOP-60400",
        summary: "Customer order cockpit",
        type: "epic",
        priority: "medium",
        columnId: "in-progress",
      },
      {
        key: "SHOP-60411",
        summary: "Cancel an order",
        type: "story",
        priority: "medium",
        assignee: "Grace Hopper",
        columnId: "in-progress",
        epicKey: "SHOP-60400",
      },
      {
        key: "SHOP-60413",
        summary: "Update Requirement",
        type: "subtask",
        priority: "medium",
        assignee: "Grace Hopper",
        columnId: "in-progress",
        parentKey: "SHOP-60411",
      },
      {
        key: "SHOP-60415",
        summary: "Frontend",
        type: "subtask",
        priority: "medium",
        assignee: "Grace Hopper",
        columnId: "in-progress",
        parentKey: "SHOP-60411",
      },
      {
        key: "SHOP-60414",
        summary: "Backend",
        type: "subtask",
        priority: "medium",
        columnId: "done",
        parentKey: "SHOP-60411",
      },
      {
        key: "SHOP-60412",
        summary: "Past orders",
        type: "story",
        priority: "medium",
        assignee: "Grace Hopper",
        columnId: "in-progress",
        labels: ["UX"],
        epicKey: "SHOP-60400",
      },
      {
        key: "SHOP-60418",
        summary: "[UX] Define Empty State",
        type: "subtask",
        priority: "medium",
        assignee: "Ada Lovelace",
        columnId: "todo",
        parentKey: "SHOP-60412",
      },
      {
        key: "SHOP-60417",
        summary: "Frontend",
        type: "subtask",
        priority: "medium",
        assignee: "Grace Hopper",
        columnId: "review",
        parentKey: "SHOP-60412",
      },
      {
        key: "SHOP-60416",
        summary: "Backend",
        type: "subtask",
        priority: "medium",
        columnId: "done",
        parentKey: "SHOP-60412",
      },
      {
        key: "SHOP-60420",
        summary: "Crash when terminal is resized below 40 columns",
        type: "bug",
        priority: "highest",
        assignee: "Grace Hopper",
        columnId: "todo",
        labels: ["PO"],
      },
      {
        key: "SHOP-60421",
        summary: "Adopt shared palette tokens across cards",
        type: "task",
        priority: "low",
        points: 2,
        assignee: "Ada Lovelace",
        columnId: "review",
      },
      // Pre-refinement work: off the board, in the backlog tab (specs/044). One
      // carries sub-tasks so the backlog's expandable tree is exercisable offline.
      {
        key: "SHOP-60430",
        summary: "Gift card top-up flow",
        type: "story",
        priority: "high",
        columnId: "in-refinement",
        epicKey: "SHOP-60400",
      },
      {
        key: "SHOP-60431",
        summary: "Draft the top-up API contract",
        type: "subtask",
        priority: "medium",
        assignee: "Ada Lovelace",
        columnId: "in-refinement",
        parentKey: "SHOP-60430",
      },
      {
        key: "SHOP-60432",
        summary: "Agree rollback story with support",
        type: "subtask",
        priority: "low",
        columnId: "to-be-discussed",
        parentKey: "SHOP-60430",
      },
      {
        key: "SHOP-60433",
        summary: "Wishlist sharing — do we want it?",
        type: "story",
        priority: "medium",
        columnId: "to-be-discussed",
      },
    ],
  }
}

/**
 * A provider backed by a private, mutable copy of the seed board. `moveTask`
 * mutates that copy and resolves — instant, but async, so the UI's optimistic /
 * revert path is exercised exactly as it will be against the real backend.
 */
/**
 * Offline stand-in for the instance's resolutions (specs/053) — a plausible subset of a
 * real Jira list, first entry the default a close falls back to.
 */
const RESOLUTIONS = ["Done", "Won't Do", "Duplicate", "Obsolete", "Cannot Reproduce", "Declined"]

/** What a mock provider is seeded with: the board plus per-issue detail. */
export interface MockData {
  /** A fresh copy of the board each call — the provider mutates the one it keeps. */
  seed: () => Board
  descriptions: Record<string, string>
  history: Record<string, ChangeEntry[]>
}

/** The compact fixture the tests run against. */
export function sampleData(): MockData {
  return { seed, descriptions: DESCRIPTIONS, history: HISTORY }
}

export function createMockProvider(data: MockData = sampleData()): BoardProvider {
  const { seed, descriptions, history } = data
  const board = seed()
  let created = 0

  // The epic's name lives on the epic issue, not its children — resolve it onto each
  // child's `epicName` so the card tag has a label offline (specs/029), mirroring what
  // the Jira provider reads from `parent.fields.summary`.
  /** The seed stores a column id; a search result shows a status name (specs/046). */
  function withStatusNames(b: Board): Board {
    const titles = new Map([...b.columns, ...(b.backlog ?? [])].map((c) => [c.id, c.title]))
    return {
      ...b,
      tasks: b.tasks.map((t) => ({ ...t, status: t.status ?? titles.get(t.columnId) })),
    }
  }

  /**
   * Jira hands back an `accountId` beside every assignee, and the search grammar needs
   * one to build an `assignee = …` clause (specs/048). Derive a stable stand-in from the
   * name so the mock exercises the same path.
   */
  function withAssigneeIds(b: Board): Board {
    return {
      ...b,
      tasks: b.tasks.map((t) =>
        t.assignee ? { ...t, assigneeId: t.assigneeId ?? `acct-${slugName(t.assignee)}` } : t,
      ),
    }
  }

  function slugName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  function withEpicNames(b: Board): Board {
    const epicNames = new Map(
      b.tasks.filter((t) => t.type === "epic").map((t) => [t.key, t.summary]),
    )
    return {
      ...b,
      tasks: b.tasks.map((t) => (t.epicKey ? { ...t, epicName: epicNames.get(t.epicKey) } : t)),
    }
  }

  /** Everything the Jira provider fills in beyond the raw seed. */
  function decorate(b: Board): Board {
    return withAssigneeIds(withStatusNames(withEpicNames(b)))
  }

  return {
    async loadBoard() {
      return decorate(structuredClone(board))
    },
    /**
     * Offline stand-in for a Jira query (specs/046): matches the seed on key and
     * summary so the prompt is exercisable without a network. It reads the text of the
     * JQL rather than parsing it — enough for `key = X` and `text ~ "…"`.
     */
    async searchIssues(jql, limit) {
      // The sub-task follow-up a query source runs (specs/047). Matched textually like
      // the rest of this stand-in, but it has to come first: its `parent in (…)` list
      // would otherwise fall through to the text branch and match everything.
      const parents = /parent in \(([^)]*)\)/i.exec(jql)?.[1]
      if (parents && /subTaskIssueTypes/i.test(jql)) {
        const keys = new Set(parents.split(",").map((k) => k.trim().toUpperCase()))
        return decorate(structuredClone(seed()))
          .tasks.filter((t) => t.type === "subtask" && !!t.parentKey && keys.has(t.parentKey))
          .slice(0, limit)
      }
      // `parent = KEY` — an epic's issues (specs/048's `epic:`), or a story's sub-tasks.
      // Without this branch it falls through to the text match below, whose empty
      // pattern matches every issue: an epic tab would show the whole board.
      const parent = /parent = "?([A-Z]+-\d+)"?/i.exec(jql)?.[1]
      if (parent) {
        const of = parent.toUpperCase()
        return decorate(structuredClone(seed()))
          .tasks.filter((t) => t.epicKey?.toUpperCase() === of || t.parentKey?.toUpperCase() === of)
          .slice(0, limit)
      }
      const key = /key = ([A-Z]+-\d+)/i.exec(jql)?.[1]
      // The wildcard the prompt appends to the word being typed (specs/046) is what a
      // substring match does anyway, so drop it.
      const text = (/text ~ "(.*)"/i.exec(jql)?.[1] ?? "").replace(/\*/g, "")
      const board = decorate(structuredClone(seed()))
      const hits = key
        ? board.tasks.filter((t) => t.key.toUpperCase() === key.toUpperCase())
        : board.tasks.filter((t) =>
            `${t.key} ${t.summary}`.toLowerCase().includes(text.toLowerCase()),
          )
      return hits.slice(0, limit)
    },

    /**
     * The offline stand-in for a single-issue fetch (specs/007). An issue with no
     * seeded description returns an empty one — the viewer's empty state, not an error.
     */
    async loadIssue(key): Promise<IssueDetail> {
      const task = decorate(structuredClone(board)).tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      return {
        task,
        description: descriptions[key] ?? "",
        unsupported: [],
        history: history[key] ?? [],
      }
    },

    /** From the whole seed, like `searchIssues` — the board a tab shows may be narrower. */
    async loadChildren(key): Promise<Task[]> {
      return decorate(structuredClone(seed())).tasks.filter(
        (t) => t.parentKey === key || t.epicKey === key,
      )
    },

    async moveTask(key, toColumnId, resolution) {
      const task = board.tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      task.columnId = toColumnId
      // Stand in for the workflow: only the done column asks for a reason, and it
      // takes the default when none was picked — the shape the Jira transition has.
      if (toColumnId === board.columns[board.columns.length - 1]?.id) {
        task.resolution = resolution ?? RESOLUTIONS[0]!
      }
    },
    defaultResolution: RESOLUTIONS[0],
    async listResolutions() {
      return [...RESOLUTIONS]
    },
    async setResolution(key, resolution) {
      const task = board.tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      task.resolution = resolution
    },
    async editSummary(key, summary) {
      const task = board.tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      task.summary = summary
    },
    async editDescription(key, markdown) {
      if (!board.tasks.some((t) => t.key === key)) {
        throw new Error(`Unknown issue ${key}`)
      }
      descriptions[key] = markdown
    },
    async setLabels(key, labels) {
      const task = board.tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      task.labels = labels
    },
    async setEpic(key, epicKey) {
      const task = board.tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      task.epicKey = epicKey ?? undefined
      task.epicName = epicKey ? board.tasks.find((t) => t.key === epicKey)?.summary : undefined
    },
    async rankTask(key, anchor) {
      const from = board.tasks.findIndex((t) => t.key === key)
      const anchorKey = "before" in anchor ? anchor.before : anchor.after
      if (from < 0 || !board.tasks.some((t) => t.key === anchorKey)) {
        throw new Error(`Unknown issue ${key} or anchor ${anchorKey}`)
      }
      const [moved] = board.tasks.splice(from, 1)
      const at = board.tasks.findIndex((t) => t.key === anchorKey)
      board.tasks.splice("before" in anchor ? at : at + 1, 0, moved!)
    },
    async assignTask(key, assignee) {
      const task = board.tasks.find((t) => t.key === key)
      if (!task) {
        throw new Error(`Unknown issue ${key}`)
      }
      task.assignee = assignee ?? undefined
    },
    async createIssue({ type, summary, parentKey, epicKey }) {
      const task: Task = {
        key: `NEW-${++created}`,
        summary,
        type,
        priority: "medium",
        columnId: board.columns[0]!.id,
        parentKey,
        epicKey,
        epicName: epicKey ? board.tasks.find((t) => t.key === epicKey)?.summary : undefined,
      }
      board.tasks.push(task)
      return structuredClone(task)
    },
    issueUrl(key) {
      // Placeholder so the open/copy-URL actions are exercisable offline.
      return `https://jira.example.com/browse/${key}`
    },
  }
}
