# Contributing

Use a fork and a focused branch, then open a pull request to the canonical public
repository at <https://github.com/joelborch/modernized-classics-open-source>.
Collaborators with write access may create branches in the repository, but changes
to `main` go through a pull request with the `test` CI check and one approving
CODEOWNER review from `@joelborch`. Force pushes and branch deletion are disabled.
The owner retains the GitHub administrator bypass and may push directly to `main`.

This collaboration repository has no production or Cloudflare access and does
not deploy the live site. Contributors never need production credentials.

Run `npm ci`, then `npm run verify`. The site, synthetic EPUB fixtures and
deterministic tests work without any model account. `npm run dev` currently runs
the explicit Markdown formatter first and may change book files; inspect those
changes before committing. `npm run build` must not modify tracked source.

## Books

Open a book-proposal issue first to coordinate the source edition and slug.
Record author, translator, edition/year, source URL, and evidence supporting use
in the contribution notes, following `SOURCES.md`. A public-domain original does not establish the status of a
modern translation, introduction, notes, illustrations or publisher apparatus.
Clearly report unresolved provenance; do not present uncertainty as clearance.

Keep the input EPUB in the ignored `pipeline/input/` folder and generated state
in `pipeline/work/`, or use `--work-root` outside the repository. Generate the
selection first with `--to select`, inspect it, and exclude editorial material
that you cannot redistribute. With unchanged generation settings, editing
`selection.json` and rerunning `--from select` preserves your selection unless
you specify `--reselect`. A changed model/prompt configuration forces reselection.

Review the rewritten text against the source, including chapter completeness,
meaning, citations and retained notes. Resolve failed QA before publication.
The pipeline's `publish` stage writes local site content; it does not commit,
push, or deploy. Add a cover only with documented origin and license, using a
`cover-license.txt` when a specific notice is needed. Avoid copied publisher covers.

Commit the reviewed Markdown, permitted cover asset, and source record together.
Do not commit source/download EPUBs, generated `dist`, logs, model transcripts,
archives, or working state. The generated download is checked during the build.
Include a concise review summary in the PR, with provider/model, CLI version,
selection decisions and any uncertainty. Share small permitted excerpts when
needed for review, not a dump of private model sessions or source books.

## Code and providers

Keep changes scoped to the issue. Add tests for observable behavior, especially
failure handling and resume behavior. Provider adapters must pass text, structured
output, failure, timeout and cancellation tests without real accounts in CI.
Use [provider documentation](docs/providers.md) for live opt-in verification and
the custom command protocol. Do not add repository secrets to PR workflows.

By contributing code, you agree to make your contribution available under MIT.
For content, supply source and rights information supporting the intended license
in `CONTENT-LICENSE.md`; do not claim rights you do not hold. Report questionable
material to the maintainer rather than including more copies in an issue.
