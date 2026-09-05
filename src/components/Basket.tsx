import type { ReactNode } from "react"
import { theme } from "../theme"

interface BasketProps {
  /**
   * The parent this basket belongs to, printed as its header — omitted when the
   * parent's own card is inside, since the card already names it (specs/051).
   */
  header: { key: string; summary: string } | null
  children: ReactNode
}

/**
 * The tray the `basket` layout draws around one parent's run of cards (specs/051).
 *
 * Recessed rather than outlined: its background is darker than the column it sits in
 * and the cards inside are lighter still, so the grouping reads as depth. A border
 * would say the same thing while depending on how the terminal sizes box-drawing
 * characters (nfr/002).
 */
export function Basket({ header, children }: BasketProps) {
  return (
    <box
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
      paddingTop={1}
      backgroundColor={theme.bg}
    >
      {header && (
        <box paddingBottom={1} flexDirection="row">
          <box flexShrink={0}>
            <text fg={theme.textDim}>{header.key} </text>
          </box>
          <box flexGrow={1} flexShrink={1}>
            <text fg={theme.textMuted}>{header.summary}</text>
          </box>
        </box>
      )}
      {children}
    </box>
  )
}
