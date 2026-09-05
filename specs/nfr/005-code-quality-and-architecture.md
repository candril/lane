# NFR: Code Quality, Architecture & Tooling

**Status**: Draft

## Requirement

The codebase stays small, typed, and consistent, with a strict separation between the UI and
the data source, and a `just`-driven workflow.

## Criteria

- `just check` (typecheck + lint + fmt-check) passes with no errors before work is considered done.
- Strict TypeScript; no implicit `any`. `oxlint` clean; `oxfmt` formatting enforced.
- The UI depends only on `types.ts`, never on a concrete provider — the provider seam in
  `index.tsx` is the only place a data source is chosen
  ([../004-data-model-and-provider](../004-data-model-and-provider.md)).
- Components are presentational; board state and key handling live in `App.tsx`. Colours come
  from `theme.ts`; glyphs from `utils/glyphs.ts`.
- Comments explain *why*, not *what*.
- All routine tasks run through the `justfile` (`just run`, `just dev`, `just check`, …).

## Criteria — Version Control

- The project is a **jj (jujutsu)** repository; use `jj` for version control.
- Avoid force-pushing / rewriting already-pushed changes; stack new changes instead.
- Start each new topic on a fresh empty change.

## Notes

- Tooling and conventions mirror [`../../monq`](../../../monq) so the two projects feel the same.
- Tests are not yet set up; `just test` (bun test) is the intended runner when they are added.
