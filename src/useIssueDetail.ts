import { useCallback, useRef, useState } from "react"
import type { BoardProvider, ChangeEntry, IssueDetail } from "./providers/provider"
import type { Task } from "./types"

/** What the viewer is showing for the open issue, once the fetch has settled. */
export interface DetailState {
  key: string
  loading: boolean
  description?: string
  unsupported?: string[]
  error?: string
  /**
   * The issue as the fetch returned it. The viewer renders from board state where it
   * can (so a field edit shows there immediately), and falls back to this — which is
   * what lets it show an issue the board never loaded, an epic above all (specs/057).
   */
  task?: Task
  /** The changelog, newest first (specs/058); rides on the same fetch. */
  history?: ChangeEntry[]
}

/**
 * The detail view's open/closed state and its lazy per-issue fetch (specs/007).
 *
 * Only the description is fetched here — the header renders from board state, which
 * is already loaded and stays live through the field editors. Descriptions are cached
 * for the session: reopening an issue you just read should not cost a round trip, and
 * `r` on the board is the way to get fresh data.
 */
export function useIssueDetail(provider: BoardProvider) {
  const [detail, setDetail] = useState<DetailState | null>(null)
  const cache = useRef(new Map<string, IssueDetail>())
  // Drops a slow fetch that lands after the user has already moved on to another
  // issue, which would otherwise overwrite the description on screen.
  const run = useRef(0)
  // Which of the viewer's items the cursor is on (specs/057): 0 is the issue itself,
  // then one step per linked issue in the order they are drawn. Owned here, beside the
  // trail, because going back has to land on the link you went down through — the
  // trail records the cursor with each step, and `back` restores it.
  const [focus, setFocus] = useState(0)
  // The issues drilled through to reach this one (specs/057), oldest first, each with
  // the cursor position it was left at.
  const trail = useRef<{ key: string; focus: number }[]>([])
  // Mirror the open issue and cursor for `push`, which needs what it is leaving
  // without taking them as dependencies — that would rebuild every navigation
  // callback on each fetch settle and cursor move.
  const keyRef = useRef<string | null>(null)
  keyRef.current = detail?.key ?? null
  const focusRef = useRef(0)
  focusRef.current = focus
  // Children the board never loaded (specs/057), fetched per issue on demand and kept
  // for the session like the descriptions; `children` is the set for the open issue.
  const [children, setChildren] = useState<{ key: string; tasks: Task[] } | null>(null)
  const childrenCache = useRef(new Map<string, Task[]>())

  /**
   * Fetch an issue's description without showing it — what the `$EDITOR` hand-off
   * needs (specs/049), since `i` works from a card too, where nothing has been fetched.
   * Null when the source cannot serve one.
   */
  const load = useCallback(
    async (key: string): Promise<IssueDetail | null> => {
      const hit = cache.current.get(key)
      if (hit || !provider.loadIssue) {
        return hit ?? null
      }
      const loaded = await provider.loadIssue(key)
      cache.current.set(key, loaded)
      return loaded
    },
    [provider],
  )

  /**
   * Re-read the open issue from the source, in place. What a field write against an
   * issue the board doesn't hold needs (specs/057): the optimistic update lands on
   * board state, which has no copy of it, so the viewer would otherwise keep showing
   * the values it was fetched with. Refetching rather than patching also brings the
   * changelog up to date, which is where the edit shows anyway. Silent on purpose —
   * no loading state, since the issue is on screen and only some fields move.
   */
  const refresh = useCallback(
    (key: string) => {
      if (!provider.loadIssue) {
        return
      }
      cache.current.delete(key)
      const ticket = ++run.current
      void (async () => {
        const loaded = await load(key).catch(() => null)
        if (!loaded || ticket !== run.current) {
          return
        }
        setDetail((d) =>
          d?.key === key
            ? {
                ...d,
                description: loaded.description,
                unsupported: loaded.unsupported,
                task: loaded.task,
                history: loaded.history,
              }
            : d,
        )
      })()
    },
    [provider, load],
  )

  /** Record a description written elsewhere, so reopening shows the new text. */
  const patch = useCallback((key: string, description: string) => {
    const hit = cache.current.get(key)
    if (hit) {
      cache.current.set(key, { ...hit, description })
    }
    setDetail((d) => (d?.key === key ? { ...d, description } : d))
  }, [])

  /** Fetch what hangs off `key`, for the viewer to list beside what the board holds. */
  const loadChildren = useCallback(
    (key: string) => {
      const hit = childrenCache.current.get(key)
      if (hit) {
        setChildren({ key, tasks: hit })
        return
      }
      if (!provider.loadChildren) {
        return
      }
      void (async () => {
        try {
          const tasks = await provider.loadChildren!(key)
          childrenCache.current.set(key, tasks)
          if (keyRef.current === key) {
            setChildren({ key, tasks })
          }
        } catch {
          // The section just stays as the board had it: the viewer reads fine without
          // it, and a toast for a lookup nobody asked for by name would be noise.
        }
      })()
    },
    [provider],
  )

  const show = useCallback(
    (key: string) => {
      // A fresh issue starts on itself; `back` overrides this with the saved cursor.
      setFocus(0)
      const hit = cache.current.get(key)
      if (hit) {
        setDetail({
          key,
          loading: false,
          description: hit.description,
          unsupported: hit.unsupported,
          task: hit.task,
          history: hit.history,
        })
        return
      }
      if (!provider.loadIssue) {
        setDetail({ key, loading: false })
        return
      }
      const ticket = ++run.current
      setDetail({ key, loading: true })
      void (async () => {
        try {
          const loaded = await load(key)
          if (ticket === run.current) {
            setDetail({
              key,
              loading: false,
              description: loaded?.description,
              unsupported: loaded?.unsupported,
              task: loaded?.task,
              history: loaded?.history,
            })
          }
        } catch (err) {
          if (ticket === run.current) {
            const message = err instanceof Error ? err.message : String(err)
            setDetail({ key, loading: false, error: message })
          }
        }
      })()
    },
    [provider, load],
  )

  const close = useCallback(() => {
    run.current++
    trail.current = []
    setDetail(null)
  }, [])

  /** Opening from outside starts a fresh trail — the board is the way back. */
  const open = useCallback(
    (key: string) => {
      trail.current = []
      show(key)
    },
    [show],
  )

  /**
   * Follow a link *within* the viewer (specs/057), remembering where it came from so
   * `⌫` can walk back out the way it came in rather than dropping to the board.
   */
  const push = useCallback(
    (key: string) => {
      const from = keyRef.current
      if (from && from !== key) {
        trail.current.push({ key: from, focus: focusRef.current })
      }
      show(key)
    },
    [show],
  )

  /**
   * `⌫`: back to the issue we drilled in from — with the cursor on the link we left
   * through, so ↵ ⌫ is a round trip — or out of the viewer at the root.
   */
  const back = useCallback(() => {
    const previous = trail.current.pop()
    if (previous) {
      show(previous.key)
      setFocus(previous.focus)
      return
    }
    close()
  }, [show, close])

  /** ↵ on an open viewer closes it; on anything else it switches to that issue. */
  const toggle = useCallback(
    (key: string | null) => {
      if (!key || detail?.key === key) {
        close()
        return
      }
      open(key)
    },
    [detail?.key, open, close],
  )

  return {
    detail,
    focus,
    setFocus,
    children,
    loadChildren,
    open,
    push,
    back,
    close,
    toggle,
    load,
    patch,
    refresh,
  }
}
