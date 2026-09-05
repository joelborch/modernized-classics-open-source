---
version: 1
slug: "src-pages-books-slug-astro"
primary_target: "src/pages/books/[slug].astro"
related_targets: ["src/layouts/BookLayout.astro","src/pages/index.astro","src/pages/library.astro","src/pages/about.astro"]
---

# Surface brief: the reading edition (`/books/<slug>/`) and its siblings

## Scope and mode

Read. The book page is the flagship surface; the library (`/library/`, Operate), home (`/`, a shelf that persuades only by showing the collection), the colophon (`/about/`, Read), and 404 inherit this world. One long page per book at the existing URL; no chapter routes (user decision 2026-09-05). Audio is a secondary download beside the EPUB.

## Audience, job, content

A curious adult self-learner reading a 4-to-11-hour non-fiction classic across many sessions, phone in bed and laptop at a desk. Their question on arrival is "where was I, and where am I in this book?"; their job is to keep reading. Content is one markdown document per title with `##`/`###` headings, an illustrated 2:3 cover, description, original date, and tags. Constraints: light/sepia/dark, three font sizes, three spacings, focus mode, saved position, and progress must all survive; WCAG AA in every theme; `npm run verify` stays green.

## Direction contract

THESIS: The scholarly reading edition brought to the web: the page is a text block with a living apparatus around it, and the apparatus answers "where am I" without ever competing with the text. It refuses the category's card-and-sidebar reader with a settings panel and a floating toolbar.

OWN-WORLD: Cool wove-white text paper (not cream), ink set from one fixed 11-step ramp per theme, and exactly one series colour per edition sampled from its cover, used only for the running-head rule, the bookmark ribbon, chapter ticks, and the edition band. Text in Literata with optical sizing, true italics, old-style figures; apparatus in Atkinson Hyperlegible Next at one small size, caps tracked. Hairline rules, no cards, no rounded panels, no shadows except the cover's physical drop. Covers are objects with a spine edge, never cropped.

STORY: You land on an edition, see the cover as an object with its provenance (author, original year, modernized year, length), and either resume where you stopped or start reading. While reading, the running head names the work and current chapter, the outer rail shows chapter ticks and your progress, and a ribbon marks where you stopped. Downloads are one click and never in the way.

FIRST VIEWPORT (desktop 1440): a running head pinned at top (author small caps left, work title centre, chapter and percent right, series-colour hairline beneath). Below, the edition band: cover at 240px with spine edge on the left, title in Literata display at 56px, author, provenance line, description, then "Resume reading at Book 2" primary and EPUB/Audio secondary as text links with hairline underlines. The text block begins immediately in the same viewport at 66ch. The outer right rail carries roman/arabic chapter ticks and a thin progress line. Mobile: the running head collapses to work title and percent, the rail becomes a 3px edge with the ribbon, chapters open from the running head.

SIGNATURE INTERACTION: the ribbon. On return, a series-colour bookmark ribbon hangs in the rail at the saved position and the header offers "Resume at <chapter>"; choosing it scrolls with an eased travel and the ribbon settles. Progress line and running-head chapter update by scroll-driven observation, no polling.

MOTION GRAMMAR: one authored moment (the ribbon settle and resume travel); everything else is instant or a 150ms exponential ease-out; reduced-motion removes travel.

CROSS-SURFACE REACH: library as a shelf (cover grid and a spine view), home as the shelf with a masthead, colophon set as a critical edition's note on the text, 404 as an empty folio.

FORM: The Critical Edition, candidate 3 of the grounded list, assigned by seed key f519c537 (code-led; no image generation in this harness).

RAISES: fixed tonal ramp as the only greys (from exposure record); saved position as a visible ribbon plus Resume, never a silent jump (from cutting bench); one vertical axis rules position on every width (from deep dive); spine view for the library (from sneaker archive); apparatus type stays small and marginal (from labanotation).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

Series colours are sampled from covers at build time; a hand override per book in frontmatter is allowed later. Focus mode hides the site header and footer but keeps the running head.
