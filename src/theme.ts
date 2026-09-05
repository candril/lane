// Tokyo Night inspired color palette
export type Theme = typeof tokyoNight

const tokyoNight = {
  // Backgrounds
  bg: "#1a1b26",
  headerBg: "#24283b",
  columnBg: "#1f2335",
  cardBg: "#24283b",
  cardBgFocused: "#33467c",
  // Multi-select (specs/055): a warm tint, deliberately off-hue from the blue focus
  // so "in the copy set" and "under the cursor" read apart at a glance. A color-only
  // channel because a marker glyph shifted the card text sideways.
  cardBgSelected: "#45402a",
  modalBg: "#16161e",
  overlayBg: "#00000080",

  // Text
  text: "#c0caf5",
  textDim: "#565f89",
  textMuted: "#414868",

  // Accents
  primary: "#7aa2f7",
  secondary: "#bb9af7",
  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",

  // Borders
  border: "#414868",
  borderFocused: "#7aa2f7",

  // Assignee chips — soft pastels, deliberately muted and off-hue from the
  // semantic accents above so a person's colour never reads as a status.
  avatarPalette: [
    "#c4b5e0", // lavender
    "#a9c7e8", // periwinkle
    "#9fd8c8", // mint
    "#c3dda0", // sage
    "#e6cfa0", // sand
    "#e8b6a0", // peach
    "#e2aac4", // rose
    "#b8c0d8", // slate
  ],
} as const

/**
 * Module-level theme reference. Kept mutable so a future config/theme picker
 * can swap it at startup before the renderer mounts.
 */
// eslint-disable-next-line prefer-const
export let theme: Theme = tokyoNight

export function setTheme(t: Theme): void {
  theme = t
}
