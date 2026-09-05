import { useEffect, useRef, useState } from "react"
import { readBoardCache, writeBoardCache } from "./cache"
import { findSource, type BoardSource } from "./tabs"
import { EMPTY_BOARD, type Board as BoardModel } from "./types"

/**
 * Owns the board snapshot and its stale-while-revalidate lifecycle (specs/033):
 * each source's in-memory cache, the background refresh (mount / interval / focus /
 * manual), and source switching. Optimistic mutations bump `pendingMutations` so a
 * refresh defers until they settle — the counter is shared with the mutation hooks.
 *
 * Keyed by *source*, not tab (specs/044): several tabs can project one issue set, and
 * they must share a single fetch, a single refresh, and the optimistic result of a
 * mutation made from any of them.
 */
export function useBoardData(args: {
  initialSources: BoardSource[]
  initialSourceId: string
  initialBoard: BoardModel
  initialLoading: boolean
  refreshInterval: number
  registerFocus?: (cb: (focused: boolean) => void) => () => void
  showToast: (message: string) => void
  /** Called just before a fetched board replaces the visible one, so the caller can
   * anchor cursors to issue keys — a fresh board may order everything differently. */
  onFreshBoard?: () => void
}) {
  const { initialSources, initialSourceId, initialBoard, initialLoading, refreshInterval } = args
  const { registerFocus, showToast, onFreshBoard } = args
  // Revalidate resolves in a closure from an older render; the ref keeps the
  // callback it invokes current.
  const onFreshBoardRef = useRef(onFreshBoard)
  onFreshBoardRef.current = onFreshBoard

  const [activeSourceId, setActiveSourceId] = useState(initialSourceId)
  // The source list lives here rather than in App because everything that resolves an
  // id — revalidate, switchSource, the interval and focus refreshes — reads it, and
  // those callbacks outlive the render that created them. The ref is the authority and
  // is updated *synchronously* by `addSource`: a caller that adds a source and switches
  // to it in the same tick (keeping a search as a tab — specs/047) would otherwise look
  // it up in a list React has not committed yet, and silently keep the old board.
  const [sources, setSources] = useState(initialSources)
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const source = findSource(sources, activeSourceId) ?? sources[0]!

  function addSource(added: BoardSource) {
    if (findSource(sourcesRef.current, added.id)) {
      return
    }
    sourcesRef.current = [...sourcesRef.current, added]
    setSources(sourcesRef.current)
  }

  function dropSource(id: string) {
    sourcesRef.current = sourcesRef.current.filter((s) => s.id !== id)
    setSources(sourcesRef.current)
  }
  const provider = source.provider
  const [board, setBoard] = useState<BoardModel>(initialBoard)
  // Each source caches its last-loaded snapshot so switching back is instant; others
  // load lazily on first activation (specs/016). Don't seed an empty placeholder
  // board (specs/033) — it'd shadow the disk cache on switch-back.
  const boardCache = useRef<Map<string, BoardModel>>(
    new Map(initialLoading ? [] : [[initialSourceId, initialBoard]]),
  )
  // The active source at the time an async load resolves may have moved on; this ref
  // lets the load discard itself if the user has switched away.
  const activeSourceRef = useRef(activeSourceId)
  activeSourceRef.current = activeSourceId
  // A background revalidation is in flight for the active board (specs/033) — drives
  // the header's refreshing hint. Seeded true when we booted from an empty board.
  const [refreshing, setRefreshing] = useState(initialLoading)
  const refreshingRef = useRef(initialLoading)
  // Count of optimistic mutations in flight; a refresh defers until they settle so a
  // stale server read can't clobber an optimistic move/assign/edit/create (specs/033).
  const pendingMutations = useRef(0)
  const refreshDeferredRef = useRef(false)
  // When the active board was last refreshed — drives the header's age indicator.
  const lastRefreshRef = useRef(0)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)

  // Revalidate the active board once on mount — the "revalidate" half of SWR boot.
  useEffect(() => {
    revalidate(initialSourceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Interval refresh (specs/033): a self-rescheduling timer — rescheduled after each
  // run, so polls never overlap. `0` disables it.
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) {
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      doRefresh()
      timer = setTimeout(tick, refreshInterval * 1000)
    }
    timer = setTimeout(tick, refreshInterval * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval])

  // Focus-in and SIGCONT (resume from Ctrl-Z) refresh (specs/033), gated on the data
  // being ~30s stale so rapid alt-tabbing doesn't storm the CLI.
  useEffect(() => {
    const refreshIfStale = () => {
      if (Date.now() - lastRefreshRef.current > 30_000) {
        doRefresh()
      }
    }
    const unregister = registerFocus?.((focused) => {
      if (focused) {
        refreshIfStale()
      }
    })
    process.on("SIGCONT", refreshIfStale)
    return () => {
      unregister?.()
      process.off("SIGCONT", refreshIfStale)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerFocus])

  // Re-render every 30s so the header's "updated Nm ago" age stays current.
  const [, forceAgeTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => forceAgeTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  /**
   * Fetch a board fresh through its provider and swap it in — the revalidate half of
   * stale-while-revalidate (specs/033). Writes the result to the disk + in-memory
   * caches; only touches the visible board if that tab is still active on resolve.
   */
  function revalidate(id: string) {
    const target = findSource(sourcesRef.current, id)
    if (!target) {
      return
    }
    setRefreshing(true)
    refreshingRef.current = true
    void (async () => {
      try {
        const fresh = await target.provider.loadBoard()
        boardCache.current.set(id, fresh)
        writeBoardCache(target.cacheKey, fresh)
        if (activeSourceRef.current === id) {
          onFreshBoardRef.current?.()
          setBoard(fresh)
          lastRefreshRef.current = Date.now()
          setLastRefresh(lastRefreshRef.current)
        }
      } catch (err) {
        if (activeSourceRef.current === id) {
          showToast(`refresh failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      } finally {
        refreshingRef.current = false
        if (activeSourceRef.current === id) {
          setRefreshing(false)
        }
      }
    })()
  }

  /**
   * Refresh the active board on demand — manual `r`, interval, or focus (specs/033).
   * Deferred while an optimistic mutation is in flight (so a stale server read can't
   * clobber it) and skipped if a refresh is already running.
   */
  function doRefresh() {
    if (pendingMutations.current > 0) {
      refreshDeferredRef.current = true
      return
    }
    if (refreshingRef.current) {
      return
    }
    revalidate(activeSourceRef.current)
  }

  /** Mark an optimistic mutation done; run a deferred refresh once all settle. */
  function settleMutation() {
    pendingMutations.current = Math.max(0, pendingMutations.current - 1)
    if (pendingMutations.current === 0 && refreshDeferredRef.current) {
      refreshDeferredRef.current = false
      doRefresh()
    }
  }

  /**
   * Switch to another source: show whatever we have instantly — in-memory snapshot,
   * else the disk cache, else empty — then revalidate in the background (specs/016,
   * specs/033). Switching between tabs that share a source never gets here, so it
   * costs nothing.
   */
  function switchSource(id: string) {
    const target = findSource(sourcesRef.current, id)
    if (!target || id === activeSourceId) {
      return
    }
    boardCache.current.set(activeSourceId, board)
    setActiveSourceId(id)
    // The ref is otherwise only caught up on the next render. A provider that resolves
    // at once (the demo) would finish first, see the old id, and drop its board — the
    // tab then sits on "refreshing" forever.
    activeSourceRef.current = id
    const mem = boardCache.current.get(id)
    const disk = mem ? null : readBoardCache(target.cacheKey)
    if (mem) {
      setBoard(mem)
    } else if (disk) {
      setBoard(disk.board)
      boardCache.current.set(id, disk.board)
    } else {
      setBoard(EMPTY_BOARD)
    }
    revalidate(id)
  }

  return {
    board,
    setBoard,
    sources,
    addSource,
    dropSource,
    activeSourceId,
    source,
    provider,
    refreshing,
    lastRefresh,
    revalidate,
    doRefresh,
    settleMutation,
    pendingMutations,
    switchSource,
  }
}
