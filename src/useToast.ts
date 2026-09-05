import { useEffect, useRef, useState } from "react"
import type { useRenderer } from "@opentui/react"

type Renderer = ReturnType<typeof useRenderer>

export interface Toast {
  toast: string | null
  /** Flash a transient confirmation in the header (copies, opens). Auto-clears. */
  showToast: (message: string) => void
}

/** Transient header message that clears itself after 2s. */
export function useToast(renderer: Renderer): Toast {
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current)
      }
    },
    [],
  )

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
    }
    toastTimer.current = setTimeout(() => {
      setToast(null)
      renderer.requestRender()
    }, 2000)
  }

  return { toast, showToast }
}
