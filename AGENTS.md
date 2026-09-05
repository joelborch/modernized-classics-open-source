# Repository Guidelines & Architecture Status

## Current State & Collaboration Model
- Canonical checkout: this monorepo, combining the site, book content and pipeline.
- Public collaboration repository: `https://github.com/joelborch/modernized-classics-open-source`.
- Contributors use forks or collaborator branches and reviewed PRs. Main requires the `test` CI check and one approving CODEOWNER review from `@joelborch`; force pushes and branch deletion are disabled.
- The owner retains administrator bypass and may push directly to main. Other collaborators have branch write access and use PRs for main.
- The private production repository is separate and disconnected. Work here must not perform deployments, Cloudflare operations, or changes to that repository.
- Keep source EPUBs, generated downloads, model workspaces and credentials out of Git. See `CONTRIBUTING.md` and `docs/maintainers.md`.

## Layout
- `src/pages/`: Route entry points; `src/components/`, `src/layouts/`, `src/lib/` UI and utilities.
  - `src/layouts/BookLayout.astro` + `src/scripts/reader.ts`: the reading edition (running head, chapter rail, resume ribbon, reading settings).
  - `src/lib/edition.ts`: display helpers, chapter derivation from headings, and the editorial shelves used by the home page and library.
  - `src/styles/tokens.css`: the design tokens (paper, an eleven-step ink ramp per theme, the per-edition series colour, type). `DESIGN.md` documents the system; read it before UI work.
- `src/content/books/<slug>/index.md`: Book text with frontmatter; schema in `src/content.config.ts`.
- `src/data/series-colors.json`: one colour per edition sampled from its cover by `npm run series-colors`; regenerate after adding a cover.
- `public/downloads/`: Generated EPUBs (`${slug}.epub`, gitignored). `public/_redirects`: Cloudflare Pages 301 redirects.
- `scripts/`:
  - `generate-epubs.ts`: Non-mutating EPUB generator creating `${slug}.epub`.
  - `fix-markdown.ts`: Explicit markdown formatter (`npm run format:books`).
  - `check-epubs.ts`: Post-build EPUB verification.
  - `series-colors.mjs`: Samples a series colour from each `cover.png` into `src/data/series-colors.json` (`npm run series-colors`).
- `pipeline/`: EPUB → modernized book pipeline.
  - `pipeline/src/stages/*`: Extract, select, rewrite, qa, assemble, publish.
  - `pipeline/prompts/*.md`: Core prompts (`rewrite.md`, `revise.md`, `qa.md`, `selection.md`, `frontmatter.md`).
  - `pipeline/tests/`: Vitest specs (state lock, slug security, assemble, epub, qa-failclosed).
  - `pipeline/work/`: Per-book working data and `.lock` files (gitignored).
  - `pipeline/input/`: Drop public-domain EPUBs here (gitignored).
- `dist/`: Static build output (gitignored).

## Commands
- `npm run dev`: Start Astro dev server at `localhost:4321`.
- `npm run build`: Generate EPUBs into `public/downloads/` and build static site to `dist/` (non-mutating).
- `npm run format:books`: Run explicit markdown lint formatting across book content.
- `npm test`: Run Vitest unit test suite.
- `npm run typecheck`: Typecheck pipeline and Astro codebase.
- `npm run verify`: Full release gate (`npm run check:repository && npm run typecheck && npm test && npx astro check && npm run verify:build`).
- `npm run modernize -- <epub> [--slug s] [--from stage] [--to stage]`: Run modernization pipeline.
- `npm run modernize -- unlock --slug <s>`: Release stale lockfile.

## Pipeline & Prompt Invariants
1. **Audio-First Non-Fiction Voice (`rewrite.md`):** Authoritative explanatory prose (*The Atlantic*, Oliver Sacks), natural sentence rhythm. Banned AI clichés (*delve, testament to, crucial role, tapestry, intricate dance, beacon*), no conversational filler ("Here's why this matters"), no modern analogy substitutions, no standalone introductory/concluding runway in chunks.
2. **Surgical Revisions (`revise.md`):** Targeted repairs against `<previous_rewrite>` addressing specific QA `fix_instruction` directives without regenerating whole chunks.
3. **Fail-Closed QA (`qa.md`, `stages/qa.ts`):** Evaluates propositional completeness rather than rigid length percentages. Hard fail if issues persist after 2 revision rounds.
4. **Pure Builds:** Build and generation scripts must never modify tracked source markdown or move files outside their isolated targets.
5. **Slug Security:** Strict slug validation (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) prevents path escape.

## Adding a Book
1. Drop a public-domain EPUB in `pipeline/input/`.
2. Run `npm run modernize -- pipeline/input/<file>.epub --slug <slug> --to select` and verify `pipeline/work/<slug>/selection.json`.
3. Run `npm run modernize -- --slug <slug>` to rewrite, QA, assemble, and publish.
4. Add `cover.png` (a real PNG, roughly 2:3) in `src/content/books/<slug>/`, update frontmatter `coverImage`, run `npm run series-colors`, and include source details in the contribution notes following `SOURCES.md`.
5. Run `npm run verify` and commit.

## Model providers
- Stages use `pipeline/src/model.ts`, never a provider executable directly.
- Configure providers locally; see `docs/providers.md` for Claude, Codex, Gemini via AGY and custom adapters.
- Do not silently map unsupported effort/model combinations or replace missing cost data with zero.
- Preserve schema validation, cancellation, bounded process output, configuration provenance, and fail-closed QA.
- `npm test` must never call paid models. Live smoke checks require `npm run smoke:model -- --live` and an explicitly chosen local provider/model.
