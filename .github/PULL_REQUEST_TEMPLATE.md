## Summary

<!-- Brief description of the change and the rationale behind it. -->

## Change Type

- [ ] **New Modernized Book**: New title processed through the pipeline and added to `src/content/books/`.
- [ ] **Book Revision / Fix**: Typo fixes, modernization refinements, formatting, or footnote corrections.
- [ ] **Pipeline / Prompts**: Changes to pipeline stages (`pipeline/src/`), prompts (`pipeline/prompts/`), or CLI tooling.
- [ ] **Web UI / Site**: Astro components, styling, search, or reader experience enhancements.
- [ ] **Infrastructure / CI**: Workflows, build scripts, npm scripts, dependencies, or configuration.
- [ ] **Documentation / Metadata**: Updates to `SOURCES.md`, `README.md`, `AGENTS.md`, or licensing.

---

## Checklists

### Common Checks
- [ ] Ran `npm run verify` and all checks passed (`typecheck`, `test`, `astro check`, `build`).
- [ ] Working tree is clean and no stray or generated files are tracked (`dist/`, `build-txt/`, `.epub`, `pipeline/work/`).
- [ ] Commits are focused and commit messages follow standard conventions.

### Book Checks (if modifying or adding books)
- [ ] Exact source edition, translator/editor, rights information and selection decisions are included in the contribution notes following `SOURCES.md`.
- [ ] Book directory `src/content/books/<slug>/` includes `index.md` and `cover.png`.
- [ ] Markdown frontmatter satisfies `src/content/config.ts` schema.
- [ ] Formatted with `npm run format:books`.
- [ ] Pipeline QA report (`pipeline/work/<slug>/qa/`) was reviewed for flagged sections.
- [ ] Generated EPUB builds cleanly during `npm run build`.

### Pipeline Checks (if modifying the modernization pipeline)
- [ ] Stages read and write only through `Workspace` abstraction.
- [ ] Stage execution is idempotent and safe to re-run.
- [ ] Prompts are kept in `pipeline/prompts/*.md` rather than hardcoded in source strings.
- [ ] Provider/model and CLI version are recorded; relevant live smoke results or unavailable-account limitations are stated (CI uses no paid models).
- [ ] Vitest test suite in `pipeline/tests/` passes and new test cases were added for new behavior.

### Security-Sensitive Checks
- [ ] No API keys, credentials, or `.env` files are committed.
- [ ] Dependencies added or updated have been audited.
- [ ] `allowScripts` in `package.json` reviewed if npm dependencies were updated.
