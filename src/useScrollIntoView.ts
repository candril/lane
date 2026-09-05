import { useEffect, useRef } from "react"
import type { useRenderer } from "@opentui/react"
import { ScrollBoxRenderable, type BoxRenderable, type Renderable } from "@opentui/core"
import type { TabMode } from "./tabs"

type Renderer = ReturnType<typeof useRenderer>

/**
 * Keep the keyboard-focused board card inside its scrollbox. OpenTUI's scrollbox
 * tracks the mouse, not our cursor, so a keyboard move that lands off-screen would
 * leave the focused card hidden. The three `at*` flags describe where the cursor
 * sits in its column so the snap can pin the scrollbar to an extreme; `deps` is the
 * set of changes (cursor, layout, board, view) that should re-trigger a scroll.
 */
export function useScrollIntoView(args: {
  renderer: Renderer
  view: TabMode
  atLaneTop: boolean
  atContentTop: boolean
  atContentBottom: boolean
  deps: unknown[]
}) {
  const { renderer, view, atLaneTop, atContentTop, atContentBottom, deps } = args
  const focusedRef = useRef<BoxRenderable | null>(null)
  const activeLaneRef = useRef<BoxRenderable | null>(null)

  // Latest-value refs for the frame callback below (registered once). The header
  // sits at the lane top, so scrolling reveals it; when the cursor can go no
  // further up/down its column, snap the scrollbar fully to that end.
  const atLaneTopRef = useRef(false)
  const atContentTopRef = useRef(false)
  const atContentBottomRef = useRef(false)
  atLaneTopRef.current = atLaneTop
  atContentTopRef.current = atContentTop
  atContentBottomRef.current = atContentBottom

  const scrollDirtyRef = useRef(false)

  // Mark a re-scroll pending whenever the focus, layout, or view changes, and
  // request a frame so the callback below runs even if nothing else redraws.
  useEffect(() => {
    scrollDirtyRef.current = true
    renderer.requestRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Frame callbacks run *before* layout, so the geometry we read lags one frame.
  // Rather than scroll once (and land on stale positions), keep correcting for a
  // few frames after each change until the focused card sits inside the viewport
  // — each scrollBy requests another frame, so this converges on its own.
  useEffect(() => {
    let framesLeft = 0
    const bringFocusedIntoView = (): boolean => {
      const card = focusedRef.current
      if (!card) {
        return false
      }
      let ancestor: Renderable | null = card.parent
      while (ancestor && !(ancestor instanceof ScrollBoxRenderable)) {
        ancestor = ancestor.parent
      }
      if (!ancestor) {
        return false
      }
      const node = ancestor
      const viewportHeight = node.viewport.height
      if (viewportHeight <= 0) {
        return false
      }
      // Work in content-scroll coordinates: `off` = a screen row's position within
      // the scrollable content = screenY - viewportTop + current scrollTop.
      const current = node.scrollTop
      const max = Math.max(0, node.scrollHeight - viewportHeight)
      const toOffset = (screenY: number) => screenY - node.viewport.y + current
      const cardTopOff = toOffset(card.y)
      const cardBottomOff = cardTopOff + card.height
      // Range of scrollTop values that keep the whole card in view.
      const lowest = cardBottomOff - viewportHeight // card flush to the bottom
      const highest = cardTopOff // card flush to the top

      let target: number
      if (card.height >= viewportHeight) {
        target = cardTopOff // taller than the viewport: pin its top
      } else if (atContentTopRef.current) {
        target = 0 // first card: scrollbar all the way up
      } else if (atContentBottomRef.current) {
        target = max // last card: scrollbar all the way down
      } else {
        // Least-scroll position that shows the card, but reveal the lane header
        // too when the card sits at its lane's top.
        const anchorOff =
          atLaneTopRef.current && activeLaneRef.current
            ? toOffset(activeLaneRef.current.y)
            : cardTopOff
        target = Math.min(Math.max(current, lowest), highest, anchorOff)
      }
      // Snapping to an extreme must never hide the card.
      target = Math.max(lowest, Math.min(target, highest))
      target = Math.max(0, Math.min(target, max))
      if (Math.abs(target - current) < 1) {
        return false
      }
      node.scrollTo(target)
      return true
    }
    const onFrame = async () => {
      if (scrollDirtyRef.current) {
        scrollDirtyRef.current = false
        framesLeft = 8
      }
      if (framesLeft <= 0 || view !== "board") {
        return
      }
      framesLeft--
      if (!bringFocusedIntoView()) {
        framesLeft = 0
      }
    }
    renderer.setFrameCallback(onFrame)
    return () => renderer.removeFrameCallback(onFrame)
  }, [renderer, view])

  return { focusedRef, laneRef: activeLaneRef }
}
