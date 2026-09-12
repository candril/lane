# Changelog

All notable changes to lane are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **OpenTUI 0.1.87 to 0.5.11**, the terminal renderer everything is drawn with, together with
  `@opentui/react` and React 19.3. The one API break was the renderer's console option; screenshots
  taken before and after are pixel-identical, so nothing about the rendering changed.
- Docs site to Astro 7 and Starlight 0.42, two majors.
- `marked` 17 to 18, oxlint 1.82, oxfmt 0.67 and `undici-types` 8.10.2.
- GitHub Actions moved to the Node 24 majors ahead of Node 20 being removed from hosted runners on
  23 September 2026.
- Blockquotes in an issue description now render as an indented quote bar rather than lines prefixed
  with a literal `>`. This comes from OpenTUI's Markdown renderable, not from lane.

### Known issues

- Three oxlint rules promoted to `correctness` in 1.82 (`react/refs`, `react/immutability`,
  `react/set-state-in-effect`) are configured as warnings rather than fixed. They flag real call
  sites and are worth working through.

## [0.1.1] — 2026-09-06

### Added

- Homebrew (`brew install candril/tap/lane`) and Nix (`nix run github:candril/lane`) via
  [candril/homebrew-tap](https://github.com/candril/homebrew-tap), alongside the curl installer.
  All three install the release binary, verified against `SHA256SUMS`.
- The installer, build script and release workflow shared with the sibling tools; a released
  binary reports its tag, and the release writes `release.json` for the Nix flake.

### Changed

- The README and docs site carry the shared spec-driven notice, the same install section as
  the sibling tools, and a footer linking them.
- Demo gif paced by caption, with the moved card ringed; docs screenshots with solid scrollbars.

## [0.1.0] — 2026-09-05

First public release.

### Board

- Columns from your config, cards with type glyph, key, summary, priority, assignee,
  points, epic and label tags. Done cards are struck through.
- `h j k l` grid cursor that also lands on empty cells; `s` flash-jump to any visible
  card or lane.
- `⇧H` / `⇧L` moves a card (a Jira transition), `⇧J` / `⇧K` re-ranks it, including
  across the backlog divider.
- Views: board, list, backlog (`v b/l/k`). Groupings: none, by parent, by type, JQL
  swimlanes, by sprint (`g n/p/t/s/r`).
- Sub-task layouts: own column, under the parent, checklist rows, parent baskets
  (`v o/u/c/g`); child visibility all / hide done / none (`v a/d/n`).
- Fold controls (`z a/o/c`, `z ⇧R`, `z ⇧M`), column collapse (`c` / `⇧C`), epic and
  label tag toggles (`t e/l/a`).

### Issues

- Viewer (`↵`) with the description rendered as Markdown, links, children, and a
  folded history section; `↵` on a text edit shows it as a diff.
- Create (`n` / `⇧N`), rename (`e`), edit title and body in `$EDITOR` (`i`), assign
  (`a`), labels (`#`), epic (`⇧E`), status (`⇧S`), close as a reason (`⇧R`).
- Copy key, URL, title or description (`y`, `⇧Y`, `⇧U`, `⇧D`); open in the browser or
  a tmux window (`o` / `⇧O`).
- Multi-select with `space`, `^A` scopes and `⇧V` ranges; every field editor and copy
  acts on the whole selection.

### Find

- `/` filters the loaded board live; `:` searches Jira with the same grammar
  (`type:bug @me #UX epic:KEY -is:done`, a key, or raw JQL).
- Search results become a tab with `^T`; `⇧T c/r/x` clones, renames and closes tabs.
- Quick filters bound to letters in config (`f` + letter).

### App

- Config-defined boards as tabs, per-board columns, JQL, swimlanes, default view and
  grouping, and a `jira` CLI config per board for cross-instance setups.
- `lane import <board-id>` scaffolds a board config from a real Jira board.
- Cached boot with background refresh on an interval and on terminal focus.
- Command palette (`^P`) with every action, and a shortcut dialog (`?`).
- `lane --mock` opens an offline demo board.

[Unreleased]: https://github.com/candril/lane/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/candril/lane/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/candril/lane/releases/tag/v0.1.0
