import type { Board, IssueType, Priority, Sprint, Task } from "../types"
import type { BoardProvider, ChangeEntry } from "./provider"
import { createMockProvider, type MockData } from "./mock"

/**
 * The board `lane --mock` opens: a fictional web shop's team, sized and varied like a
 * real sprint board rather than the tests' compact fixture (`sampleData`). Three
 * epics, two live sprints, five people, labels, points, a backlog with refinement
 * statuses, seeded descriptions and history — enough that every view, grouping and
 * layout has something to show, which is what the screenshots and the demo need.
 */

const ADA = "Ada Lovelace"
const GRACE = "Grace Hopper"
const ALAN = "Alan Turing"
const MARGARET = "Margaret Hamilton"
const EDSGER = "Edsger Dijkstra"

/** Who `assignee:me` / `@me` resolves to in the demo. */
export const DEMO_USER = GRACE

const ACTIVE: Sprint = {
  id: 24,
  name: "Sprint 24",
  state: "active",
  startDate: "2026-08-31T07:00:00.000Z",
  endDate: "2026-09-11T16:00:00.000Z",
}
const NEXT: Sprint = {
  id: 25,
  name: "Sprint 25",
  state: "future",
  startDate: "2026-09-14T07:00:00.000Z",
  endDate: "2026-09-25T16:00:00.000Z",
}

const CHECKOUT = "SHOP-100"
const TRACKING = "SHOP-200"
const LOYALTY = "SHOP-300"

type Extra = Partial<Omit<Task, "key" | "summary" | "type" | "columnId" | "priority">> & {
  priority?: Priority
}

function issue(
  key: string,
  summary: string,
  type: IssueType,
  columnId: string,
  extra: Extra = {},
): Task {
  return { key, summary, type, columnId, priority: "medium", ...extra }
}

function seed(): Board {
  return {
    columns: [
      { id: "to-do", title: "To Do" },
      { id: "in-progress", title: "In Progress" },
      { id: "in-review", title: "In Review" },
      { id: "done", title: "Done" },
    ],
    backlog: [
      { id: "to-be-discussed", title: "To be discussed" },
      { id: "in-refinement", title: "In refinement" },
    ],
    tasks: [
      // ── Epics ────────────────────────────────────────────────────────────
      issue(CHECKOUT, "Checkout redesign", "epic", "in-progress", { assignee: ADA }),
      issue(TRACKING, "Order tracking", "epic", "in-progress", { assignee: GRACE }),
      issue(LOYALTY, "Loyalty programme", "epic", "to-do"),

      // ── Checkout redesign (active sprint) ────────────────────────────────
      issue("SHOP-412", "Rework the checkout summary step", "story", "in-progress", {
        assignee: ADA,
        priority: "high",
        points: 5,
        epicKey: CHECKOUT,
        labels: ["UX"],
        sprint: ACTIVE,
      }),
      issue("SHOP-413", "Wireframe the summary card", "subtask", "done", {
        assignee: MARGARET,
        parentKey: "SHOP-412",
        resolution: "Done",
      }),
      issue("SHOP-414", "Build the summary card", "subtask", "in-progress", {
        assignee: ADA,
        parentKey: "SHOP-412",
      }),
      issue("SHOP-415", "Wire the edit-address flow", "subtask", "to-do", {
        parentKey: "SHOP-412",
      }),
      issue("SHOP-388", "Totals drift on refund", "bug", "in-progress", {
        assignee: GRACE,
        priority: "highest",
        points: 3,
        epicKey: CHECKOUT,
        labels: ["payments"],
        sprint: ACTIVE,
      }),
      issue("SHOP-390", "Add the audit column to the orders table", "task", "in-progress", {
        assignee: EDSGER,
        points: 2,
        epicKey: CHECKOUT,
        labels: ["infra"],
        sprint: ACTIVE,
      }),
      issue("SHOP-402", "Drop the legacy price API", "task", "in-review", {
        assignee: ALAN,
        priority: "high",
        points: 3,
        epicKey: CHECKOUT,
        labels: ["infra"],
        sprint: ACTIVE,
      }),
      issue("SHOP-403", "Migrate the cart to the new price API", "subtask", "done", {
        assignee: ALAN,
        parentKey: "SHOP-402",
        resolution: "Done",
      }),
      issue("SHOP-404", "Remove the legacy endpoints", "subtask", "in-review", {
        assignee: ALAN,
        parentKey: "SHOP-402",
      }),
      issue("SHOP-371", "Ship the coupon banner", "story", "done", {
        assignee: ADA,
        points: 3,
        epicKey: CHECKOUT,
        labels: ["UX", "PO"],
        sprint: ACTIVE,
        resolution: "Done",
      }),
      issue("SHOP-405", "Express checkout for returning customers", "story", "to-do", {
        assignee: MARGARET,
        priority: "high",
        points: 8,
        epicKey: CHECKOUT,
        labels: ["UX", "payments"],
        sprint: ACTIVE,
      }),
      issue("SHOP-406", "Spike: one-tap wallet payments", "subtask", "to-do", {
        assignee: MARGARET,
        parentKey: "SHOP-405",
      }),
      issue("SHOP-407", "Design the returning-customer banner", "subtask", "to-do", {
        parentKey: "SHOP-405",
      }),

      // ── Order tracking (active sprint) ───────────────────────────────────
      issue("SHOP-420", "Customer order cockpit", "story", "in-progress", {
        assignee: GRACE,
        points: 5,
        epicKey: TRACKING,
        sprint: ACTIVE,
      }),
      issue("SHOP-421", "Backend: order timeline endpoint", "subtask", "done", {
        assignee: GRACE,
        parentKey: "SHOP-420",
        resolution: "Done",
      }),
      issue("SHOP-422", "Frontend: timeline view", "subtask", "in-progress", {
        assignee: GRACE,
        parentKey: "SHOP-420",
      }),
      issue("SHOP-423", "[UX] Define the empty state", "subtask", "to-do", {
        assignee: MARGARET,
        parentKey: "SHOP-420",
        labels: ["UX"],
      }),
      issue("SHOP-424", "Parcel status webhook drops events under load", "bug", "to-do", {
        assignee: EDSGER,
        priority: "highest",
        points: 3,
        epicKey: TRACKING,
        labels: ["infra"],
        sprint: ACTIVE,
      }),
      issue("SHOP-425", "Past orders", "story", "in-review", {
        assignee: ALAN,
        points: 3,
        epicKey: TRACKING,
        labels: ["UX"],
        sprint: ACTIVE,
      }),
      issue("SHOP-426", "Cancel an order", "story", "to-do", {
        points: 5,
        epicKey: TRACKING,
        labels: ["PO"],
        sprint: ACTIVE,
      }),

      // ── Loose work in the sprint ─────────────────────────────────────────
      issue("SHOP-430", "Crash when the terminal is resized below 40 columns", "bug", "to-do", {
        assignee: GRACE,
        priority: "high",
        labels: ["mobile"],
        sprint: ACTIVE,
      }),
      issue("SHOP-431", "Adopt shared palette tokens across cards", "task", "done", {
        assignee: EDSGER,
        priority: "low",
        points: 2,
        sprint: ACTIVE,
        resolution: "Done",
      }),
      issue("SHOP-432", "Nightly build flakes on the ARM runner", "bug", "in-review", {
        assignee: EDSGER,
        priority: "low",
        labels: ["infra"],
        sprint: ACTIVE,
      }),
      issue("SHOP-433", "Rotate the CDN signing key", "task", "done", {
        assignee: ALAN,
        priority: "low",
        points: 1,
        sprint: ACTIVE,
        resolution: "Won't Do",
      }),

      // ── Next sprint ──────────────────────────────────────────────────────
      issue("SHOP-440", "Points balance on the account page", "story", "to-do", {
        assignee: ADA,
        points: 5,
        epicKey: LOYALTY,
        labels: ["UX"],
        sprint: NEXT,
      }),
      issue("SHOP-441", "Earn points on every order", "story", "to-do", {
        points: 8,
        epicKey: LOYALTY,
        labels: ["payments"],
        sprint: NEXT,
      }),
      issue("SHOP-442", "Gift card top-up flow", "story", "to-do", {
        assignee: MARGARET,
        priority: "high",
        points: 5,
        epicKey: CHECKOUT,
        sprint: NEXT,
      }),

      // ── Backlog: off the board until refined (specs/044) ─────────────────
      issue("SHOP-450", "Redeem points at checkout", "story", "in-refinement", {
        priority: "high",
        epicKey: LOYALTY,
        labels: ["payments"],
      }),
      issue("SHOP-451", "Draft the redemption API contract", "subtask", "in-refinement", {
        assignee: GRACE,
        parentKey: "SHOP-450",
      }),
      issue("SHOP-452", "Agree the rollback story with support", "subtask", "to-be-discussed", {
        priority: "low",
        parentKey: "SHOP-450",
      }),
      issue("SHOP-453", "Wishlist sharing — do we want it?", "story", "to-be-discussed", {
        labels: ["PO"],
      }),
      issue("SHOP-454", "Tiered shipping rates by region", "story", "to-be-discussed", {
        epicKey: CHECKOUT,
      }),
      issue("SHOP-455", "Order tracking push notifications", "story", "in-refinement", {
        assignee: EDSGER,
        epicKey: TRACKING,
        labels: ["mobile"],
      }),
    ],
  }
}

const DESCRIPTIONS: Record<string, string> = {
  [CHECKOUT]: [
    "Replace the four-step checkout with a single scrolling page.",
    "",
    "## Goals",
    "",
    "- Fewer abandoned carts on mobile — the summary step is where we lose people",
    "- Returning customers pay in **one tap**",
    "- No new backend service; compose the price and address APIs we have",
    "",
    "## Out of scope",
    "",
    "Guest checkout stays as it is. Loyalty redemption is its own epic.",
  ].join("\n"),
  "SHOP-412": [
    "The summary step repeats the cart, the address and the payment method as three",
    "separate cards. Fold them into one card with inline *edit* links.",
    "",
    "### Acceptance criteria",
    "",
    "1. One card, three rows: items, delivery, payment",
    "2. Each row has an edit link that returns here afterwards",
    "3. The total updates without a reload when the address changes",
    "",
    "> Design flagged that the coupon field must stay visible — customers look for it",
    "> before they look for the pay button.",
  ].join("\n"),
  "SHOP-388": [
    "Refunding a single line of a multi-line order recomputes the total from the",
    "*current* prices, not the prices at order time.",
    "",
    "## Steps to reproduce",
    "",
    "1. Place an order with two items",
    "2. Change the price of one item in the catalogue",
    "3. Refund the other item",
    "",
    "## Where it goes wrong",
    "",
    "```",
    "RefundService.recompute(order)",
    "  → PriceLookup.current(sku)      // should be order.lines[i].unitPrice",
    "```",
    "",
    "| Scenario | Expected | Actual |",
    "| --- | --- | --- |",
    "| price unchanged | 0.00 | 0.00 |",
    "| price raised | 0.00 | −4.50 |",
    "| price lowered | 0.00 | +2.00 |",
  ].join("\n"),
  "SHOP-420": [
    "A single place to see and manage a customer's orders.",
    "",
    "## Goals",
    "",
    "- One view for **orders**, returns and invoices",
    '- Support can answer *"where is my parcel?"* without three tabs',
    "- Timeline reads newest first",
    "",
    "- [x] Agree the timeline events with logistics",
    "- [x] Backend endpoint",
    "- [ ] Frontend view",
    "- [ ] Empty state",
  ].join("\n"),
  "SHOP-426": [
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
  "SHOP-430": [
    "The board crashes when the terminal is narrower than 40 columns.",
    "",
    "## Steps to reproduce",
    "",
    "1. Open the board on a wide terminal",
    "2. Drag the window until it is under 40 columns",
    "3. Move the cursor with `j`",
    "",
    "```",
    "TypeError: undefined is not an object (evaluating 'column.width')",
    "  at layout (Column.tsx:88)",
    "```",
  ].join("\n"),
  "SHOP-442": [
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

const HISTORY: Record<string, ChangeEntry[]> = {
  "SHOP-412": [
    {
      at: "2026-09-03T14:12:00.000Z",
      author: ADA,
      items: [
        { field: "status", from: "To Do", to: "In Progress" },
        { field: "assignee", to: ADA },
      ],
    },
    {
      at: "2026-09-01T09:30:00.000Z",
      author: MARGARET,
      items: [
        {
          field: "description",
          from: "The summary step repeats the cart, the address and the payment method as three\nseparate cards. Fold them into one.",
          to: "The summary step repeats the cart, the address and the payment method as three\nseparate cards. Fold them into one card with inline *edit* links.",
        },
      ],
    },
    {
      at: "2026-08-28T16:05:00.000Z",
      author: ADA,
      items: [
        { field: "summary", from: "Summary step", to: "Rework the checkout summary step" },
        { field: "labels", to: "UX" },
        { field: "story points", to: "5" },
      ],
    },
  ],
  "SHOP-388": [
    {
      at: "2026-09-04T08:20:00.000Z",
      author: GRACE,
      items: [{ field: "status", from: "To Do", to: "In Progress" }],
    },
    {
      at: "2026-09-02T11:00:00.000Z",
      author: EDSGER,
      items: [
        { field: "priority", from: "High", to: "Highest" },
        { field: "labels", to: "payments" },
      ],
    },
  ],
  "SHOP-420": [
    {
      at: "2026-08-20T10:00:00.000Z",
      author: GRACE,
      items: [{ field: "status", from: "To Do", to: "In Progress" }],
    },
    ...Array.from({ length: 12 }, (_, i) => ({
      at: `2026-08-${String(19 - i).padStart(2, "0")}T09:${String(i * 4).padStart(2, "0")}:00.000Z`,
      author: i % 2 ? ALAN : GRACE,
      items: [{ field: "labels", to: `round-${12 - i}` }],
    })),
  ],
}

export function demoData(): MockData {
  return { seed, descriptions: { ...DESCRIPTIONS }, history: HISTORY }
}

/**
 * A tab over the same demo data, narrowed by a predicate — the offline stand-in for
 * several `[[boards]]` entries sharing one Jira. Writes go to the shared provider, so
 * a change made on one tab shows on the others. A sub-task follows its parent.
 */
function narrow(provider: BoardProvider, keep: (t: Task) => boolean): BoardProvider {
  return {
    ...provider,
    async loadBoard() {
      const board = await provider.loadBoard()
      const kept = new Set(board.tasks.filter(keep).map((t) => t.key))
      return {
        ...board,
        tasks: board.tasks.filter(
          (t) => kept.has(t.key) || (!!t.parentKey && kept.has(t.parentKey)),
        ),
      }
    },
  }
}

/** The team's work board: everything but the epics, like a `type != Epic` filter. */
export function teamBoard(provider: BoardProvider): BoardProvider {
  return narrow(provider, (t) => t.type !== "epic")
}

/** An epic tab (specs/034): the epics and the issues filed under them. */
export function epicsBoard(provider: BoardProvider): BoardProvider {
  return narrow(provider, (t) => t.type === "epic" || !!t.epicKey)
}

/** A bugs-only tab, which the demo opens as a list. */
export function bugsOnly(provider: BoardProvider): BoardProvider {
  return narrow(provider, (t) => t.type === "bug")
}

export function createDemoProvider(): BoardProvider {
  return createMockProvider(demoData())
}
