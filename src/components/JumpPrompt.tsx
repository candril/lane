import { theme } from "../theme"

/**
 * The line a narrowing jump types into (specs/037). It sits where the other bottom
 * prompts sit, so entering a jump moves nothing on the board above it.
 */
export function JumpPrompt({ query, matches }: { query: string; matches: number }) {
  const hint = query === "" ? "type to narrow" : matches === 0 ? "no targets" : `${matches} targets`
  return (
    <box flexShrink={0} paddingX={1} backgroundColor={theme.headerBg}>
      <text>
        <span fg={theme.textDim}>jump ▸ </span>
        <span fg={theme.text}>{query}</span>
        <span fg={query !== "" && matches === 0 ? theme.error : theme.textMuted}> · {hint}</span>
        <span fg={theme.textMuted}> · esc cancel</span>
      </text>
    </box>
  )
}
