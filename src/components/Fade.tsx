import { createContext, useContext, type ReactNode } from "react"
import { theme } from "../theme"

/**
 * The jump's backdrop (specs/037): while a jump narrows, everything on screen fades
 * toward the background so the matches and their labels are the only thing left to
 * read. It rides a context rather than a prop, because the faded colors are chosen deep
 * in the leaves — an avatar chip, a label tag, an epic tag — which know nothing about
 * jumps and shouldn't have to.
 *
 * A match re-opens the scope (`<Fade when={false}>`) around its own row, so it keeps its
 * real colors inside a faded board.
 */
const FadeContext = createContext(false)

export function Fade({ when, children }: { when: boolean; children: ReactNode }) {
  return <FadeContext.Provider value={when}>{children}</FadeContext.Provider>
}

/** Mixes a color toward the background; `1` would be the background itself. */
const FADE_STRENGTH = 0.72

/** Whether the backdrop is up here — for a row that decides its own scope. */
export function useFading(): boolean {
  return useContext(FadeContext)
}

/**
 * A color as it should be drawn: itself, or faded into the background. Blending keeps
 * each color's identity — a red bug glyph still reads as the red one — where a flat dim
 * color would erase the difference.
 */
export function fade(color: string, faded: boolean): string {
  return faded ? mix(color, theme.bg, FADE_STRENGTH) : color
}

/**
 * The backdrop as a leaf sees it. A row that steps out of the backdrop must not use
 * this for its own colors: the hook reads the scope it sits *in*, not the one it opens
 * around its children.
 */
export function useFaded(): (color: string) => string {
  const faded = useFading()
  return (color: string) => fade(color, faded)
}

function channel(hex: string, at: number): number {
  return Number.parseInt(hex.slice(at, at + 2), 16)
}

function mix(color: string, into: string, amount: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(into)) {
    return color
  }
  const blend = (at: number) =>
    Math.round(channel(color, at) * (1 - amount) + channel(into, at) * amount)
      .toString(16)
      .padStart(2, "0")
  return `#${blend(1)}${blend(3)}${blend(5)}`
}
