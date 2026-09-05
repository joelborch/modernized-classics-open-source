# Modernized Classics

Public-domain classics rewritten into clear, modern English, and a site that
publishes them: **https://modernizedclassicsbooks.com**

Source and contributions live in the public
[Modernized Classics repository](https://github.com/joelborch/modernized-classics-open-source).

This repo is two things:

- **The site** — an Astro project. Book content lives in
  `src/content/books/<slug>/index.md`; EPUBs are generated into
  `public/downloads/`.
- **The pipeline** (`pipeline/`) — turns a public-domain EPUB into a
  modernized book on the site with locally configured Claude, Codex, Gemini via AGY, or custom CLI commands.
  Each contributor uses their own model account; see [provider setup](docs/providers.md).

## Quick start (site)

Use Node.js 22.19+ (22.x), 24.x, or 26+ and npm 11.17.0. CI uses Node 22
and installs the pinned npm version before `npm ci`. Install scripts are explicitly
allowed or denied in `package.json`; new scripts fail installation until reviewed.

```sh
npm ci
npm run dev        # http://localhost:4321
npm run build      # generates EPUBs, builds to dist/
```

## Quick start (pipeline)

Requires an installed, authenticated model CLI. Claude is the default; set
`MODERNIZE_PROVIDER` and `MODERNIZE_MODEL` to select another adapter.
[Provider setup](docs/providers.md) covers CLI requirements, limitations, and custom wrappers.

```sh
npm run modernize -- pipeline/input/walden.epub --to select
#   → inspect pipeline/work/walden/selection.json, edit if the model picked wrong
npm run modernize -- --slug walden
#   → rewrite, QA, assemble, publish to src/content/books/walden/
```

Then drop a `cover.png` into `src/content/books/walden/` (a generated
`cover-prompt.txt` is waiting there) and run `npm run build`.

`npm run modernize -- --help` lists every option. `--status` shows progress
for a book; re-running a command resumes wherever it stopped.

## How the pipeline works

Everything is in `pipeline/src`. Prompts are plain Markdown in
`pipeline/prompts/`. Stages call the shared `model.ts` interface; adapters in
`pipeline/src/providers/` translate that into CLI-specific requests and responses.
Structured responses are validated centrally. Working state records the requested
provider/model, prompt hashes and generation settings; configuration changes
require an explicit restart rather than silently mixing output.

| Stage | What it does | Model call |
|---|---|---|
| `extract` | Parses the EPUB, merges split files, writes a catalogue of every spine item | none |
| `select` | Chooses the author's chapters, excludes front/back matter and publisher notes, then cuts chapters into ~24k-char chunks at sentence boundaries | 1 structured call |
| `rewrite` | Rewrites every chunk with the master prompt, with neighbouring context for continuity | 1 per chunk, 4 in parallel |
| `qa` | Compares each rewrite to its source: dropped content, changed meaning, summarizing, stray commentary, internal-ID headings. Failing chunks are revised and re-reviewed up to twice, then flagged | 1 per chunk + revisions |
| `assemble` | Stitches chunks into `book.md`, normalizes chapter headings, strips leftovers | none |
| `publish` | Generates frontmatter, writes `src/content/books/<slug>/index.md` and `cover-prompt.txt`, runs `generate-epubs` | 1 structured call |

Working files live in `pipeline/work/<slug>/` (gitignored): the source EPUB,
`selection.json`, `chunks.json`, one Markdown file per rewritten chunk, one
JSON verdict per QA review, and `state.json` with progress and token usage.
You can hand-edit any of these and re-run from a stage with `--from`.

Model costs depend on your CLI, account, model and input. Metrics unavailable
from the provider are shown as unknown. Tests and the site build do not call models.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for book provenance, code changes,
fork-based reviews, local checks, and contributor rights. Run `npm run verify`
before submitting a change. This runs the file policy, type checks, tests, Astro
checks, and a full site/EPUB build that must preserve the starting source tree.
Generated EPUBs, source inputs and intermediate work are never committed.

The public repository is for source and collaboration. It is disconnected from
the private production repository and does not deploy the live site. Maintainers
use the separate [release checklist](docs/maintainers.md).

## Licenses

Code is MIT (`LICENSE`). The modernized texts are CC BY 4.0
(`CONTENT-LICENSE.md`). Source contribution guidelines are in `SOURCES.md`.
