import type { BoardProvider } from "./providers/provider"
import type { Board as BoardModel, Task } from "./types"

const PENDING_PREFIX = "pending-"

/** A placeholder can't collide with a Jira key, which is always `PROJECT-123`. */
export function pendingKey(n: number): string {
  return `${PENDING_PREFIX}${n}`
}

export function isPendingKey(key: string | null | undefined): boolean {
  return !!key?.startsWith(PENDING_PREFIX)
}

/** What a card draws in the key slot — a placeholder is nobody's business to read. */
export function keyLabel(key: string): string {
  return isPendingKey(key) ? "new…" : key
}

function namesPending(value: unknown): boolean {
  if (typeof value === "string") {
    return isPendingKey(value)
  }
  if (Array.isArray(value)) {
    return value.some(namesPending)
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((v) => typeof v === "string" && isPendingKey(v))
  }
  return false
}

/**
 * Refuse every provider call that names a placeholder key (specs/059). Keys reach the
 * provider from the cursor, list rows, rank anchors, selections and create inputs; this
 * is the one place they all pass through, so a pending card can't leak a `pending-N`
 * into a Jira request however it was reached.
 */
export function withPendingGuard(provider: BoardProvider): BoardProvider {
  return new Proxy(provider, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== "function") {
        return value
      }
      // The one synchronous method: no URL means `o`/`⇧Y` quietly do nothing.
      if (prop === "issueUrl") {
        return (key: string) => (isPendingKey(key) ? undefined : value.call(target, key))
      }
      return (...args: unknown[]) =>
        args.some(namesPending)
          ? Promise.reject(new Error("still being created"))
          : value.apply(target, args)
    },
  })
}

/**
 * Swap a landed issue in for its placeholder, in place, so the card keeps its slot and
 * the cursor stays on it. A placeholder no longer on the board (undone, or the tab
 * switched away and back) leaves the board untouched.
 */
export function landPending(board: BoardModel, tempKey: string, landed: Task): BoardModel {
  if (!board.tasks.some((t) => t.key === tempKey)) {
    return board
  }
  return {
    ...board,
    tasks: board.tasks.map((t) => (t.key === tempKey ? { ...t, ...landed } : t)),
  }
}

export function withoutTask(board: BoardModel, key: string): BoardModel {
  return { ...board, tasks: board.tasks.filter((t) => t.key !== key) }
}

export type Discarded = { deleted: true } | { deleted: false; resolution: string }

/**
 * Take a just-created issue back (specs/059): delete it, or — deleting needs a permission
 * many Jira instances keep to admins — close it as "Won't Do" into `doneColumnId`.
 * Rejects only when the close fails as well.
 */
export async function discardIssue(
  provider: BoardProvider,
  key: string,
  doneColumnId: string,
): Promise<Discarded> {
  if (await tryDelete(provider, key)) {
    return { deleted: true }
  }
  const resolution = await wontDo(provider)
  await provider.moveTask(key, doneColumnId, resolution)
  return { deleted: false, resolution }
}

/** A refused delete is the expected case on most instances, not an error to surface. */
async function tryDelete(provider: BoardProvider, key: string): Promise<boolean> {
  if (!provider.deleteIssue) {
    return false
  }
  try {
    await provider.deleteIssue(key)
    return true
  } catch {
    return false
  }
}

async function wontDo(provider: BoardProvider): Promise<string> {
  const known = await provider.listResolutions?.().catch(() => [])
  return (
    known?.find((r) => /^won['’]?t\s*do$/i.test(r)) ??
    known?.find((r) => /won['’]?t/i.test(r)) ??
    provider.defaultResolution ??
    "Done"
  )
}
