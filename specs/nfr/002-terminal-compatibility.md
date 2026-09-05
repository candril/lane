# NFR: Terminal Compatibility & Rendering

**Status**: Draft

## Requirement

The app renders and behaves correctly across common terminals and reasonable sizes, and reads
keyboard input reliably despite terminal quirks.

## Criteria

- Renders correctly in mainstream terminals (iTerm2, Terminal.app, tmux, common Linux emulators).
- Keyboard handling tolerates the uppercase-vs-shift quirk: a key sent as `"H"` with no shift
  flag is treated the same as shift + `"h"` (already handled in
  [../003-keyboard-navigation](../003-keyboard-navigation.md)).
- Colours come exclusively from `theme.ts`, so a future theme swap is centralised and no
  component bakes in hex values.
- Degrades gracefully at small terminal sizes rather than crashing.

## Notes

- Horizontal overflow (more columns than fit) is currently out of scope
  ([../002-board-view](../002-board-view.md)); revisit if it becomes a real constraint.
- Glyphs used on cards must be widely supported by terminal fonts; keep the set in
  `utils/glyphs.ts` conservative.
