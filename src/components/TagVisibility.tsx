import { createContext, useContext } from "react"

/**
 * Which card decorations are currently shown (specs/039). A global view preference,
 * toggled live via the `t` chord and seeded from `[display]` config — so it rides a
 * context rather than being threaded as props through Board → Column → Card. Cards,
 * list rows, and checklist cards read it to gate their epic and label tags.
 */
export interface TagVisibility {
  epics: boolean
  labels: boolean
}

const TagVisibilityContext = createContext<TagVisibility>({ epics: true, labels: true })

export const TagVisibilityProvider = TagVisibilityContext.Provider

export function useTagVisibility(): TagVisibility {
  return useContext(TagVisibilityContext)
}
