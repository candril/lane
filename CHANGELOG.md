# Changelog

All notable changes to lane are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- A new issue appears the moment you press Enter instead of after Jira answers, which took one to
  three seconds. It shows `new…` in place of its key until the key arrives, and can't be edited or
  moved until then.
- `⇧H` / `⇧L` with a selection move every marked issue one status, each from its own. They used
  to move only the issue under the cursor.
- `⇧J` / `⇧K` in the backlog view take a marked block across the divider between the backlog and
  the first column, as they already did for a single issue. The block used to stop there.
- `^P` opens the command palette in the issue viewer too. It used to walk the viewer's items
  there, which is what `j` / `k` and `^N` already do, and left `⇧P` as the only way in.
- `s` narrows before it labels on a dense board. Up to 25 visible targets it labels them all,
  as before. Past that every label needed two keys, which filled the glyph slot and ran into the
  issue key — so it now opens a `jump ▸` prompt and gives each match a single-key label as you
  type. A key that could extend what you typed is never a label. The board fades while you
  narrow, each match stepping back out of the fade with what you typed picked out inside its key
  or summary.

### Added

- The notice under the board after a create offers two keys. `↵` opens the new issue in the
  viewer, where its children, assignee and epic are set; pressed while the create is still in
  flight, it opens as soon as the key arrives. `u` undoes the create, asking first (`y` deletes,
  `n` keeps): the issue is deleted, or, where Jira doesn't allow deleting, closed as Won't Do.
- A create Jira refuses leaves a notice with the reason until `esc`, and `n` reopens the prompt
  with what you typed.
- Change the type an issue was filed as: *Change type of SHOP-1…* in the command palette, over
  one issue or a whole selection. Story, task and bug only — turning something into a sub-task or
  an epic is Jira's Move wizard, which its API doesn't offer.
- `epic_jql` per board (or `jira.epic_jql` for all of them): the epics `⇧E` can file work
  under. A board whose query excludes epics could only offer the ones its issues already
  linked to, so an epic you had just created was unreachable. Fetched when the picker first
  opens on that board.

### Fixed

- A jump label typed at speed could be misread: each keystroke was matched against the state of
  the previous render, so the second key of a two-key label went missing.
- The epic picker (`⇧E`) offers every epic on the board, not only those some issue already
  links to. An epic you just created was missing from it until something pointed at it.

## [0.3.0] — 2026-09-21

### Added

- `--demo` as another name for `--mock`, the name the sibling tools use for their offline demo.

### Changed

- `marked` 18.0.13, oxlint 1.83, oxfmt 0.68; Astro 7.3.3 and Starlight 0.42.2 for the docs site.

## [0.2.0] — 2026-09-14

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
- The build now declares the minimum Bun it needs and refuses to run below it, so an incompatible
  runtime says so instead of failing later with an unexplained internal error.

### Fixed

- `n` in the detail view now files the new issue under the item the viewer's cursor is on, rather
  than under whatever card was left behind the overlay. Opening an epic and pressing `n` gave a
  sub-task under the story you had come from; it now opens a story under the epic.
- Keys in the detail view no longer reach the board behind it. Collapsing a column (`c` / `⇧C`),
  toggling card tags (`t e/l/a`), changing the sub-task layout (`v o/u/c/g`), folding everything
  (`z ⇧R` / `z ⇧M`) and the tab chord (`⇧T c/r/x`) all used to act unseen; they are now ignored
  while the viewer is up, and the command palette stops offering them there. Switching view
  (`v b/l/k`) closes the viewer first, as switching tab already did.
- The palette's filter commands act on the viewer's child filter while it is open, rather than on
  the board's.

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

[Unreleased]: https://github.com/candril/lane/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/candril/lane/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/candril/lane/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/candril/lane/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/candril/lane/releases/tag/v0.1.0
