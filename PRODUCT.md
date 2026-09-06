# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the curious adult self-learner. Someone who has always meant to read
*Meditations*, *The Wealth of Nations*, or *The Art of War*, tried the original,
and bounced off the archaic prose. They read on a phone in bed and on a laptop
at a desk, in sessions of twenty minutes to an hour, with no academic
requirement and no citation needs. Success for them is finishing a classic
they had given up on.

Secondary (confirmed as present, not designed around): open-source
contributors who run the pipeline to add a book, and readers who download the
EPUB to read elsewhere.

## Product Purpose

Modernized Classics rewrites public-domain classics into clear, modern English
and publishes them free: read online, download as EPUB, and for most titles an
MP3 narration. It exists because the ideas in these books are still relevant
and the language barrier keeps most people out. Success is a reader who
finishes.

## Positioning

Every edition is a complete, sentence-by-sentence rewrite of the whole work
(never a summary or abridgement), produced by an open, inspectable pipeline
with fail-closed QA that compares every rewritten chunk against its source for
dropped content, changed meaning, summarizing, and stray commentary. The
catalogue is non-fiction philosophy, politics, economics, and science, not the
novels most "modern English classics" projects pick. The whole thing is free
and open source; there is no account, subscription, or paywall.

## Operating Context

- 28 titles, all non-fiction: Stoic and Greek philosophy, Enlightenment
  political theory, economics, early psychology, natural science, and
  New Thought self-help. Original dates run from roughly 500 BC to 1919.
- Texts are long: 40k to 160k words each. A single title is a 4 to 11 hour
  read. Readers return across many sessions; the site remembers reading
  position, theme, font size, and line spacing in localStorage.
- Each title ships as one markdown file with `##` and `###` headings that
  form the table of contents; there is no per-chapter data model.
- Every title has an illustrated cover (`src/content/books/<slug>/cover.png`,
  roughly 2:3 portrait) in a consistent flat-illustration style. These covers
  are the project's primary visual asset.
- Contributors add books by running the pipeline locally with their own
  model CLI (Claude, Codex, Gemini, or a custom command) and opening a PR.

## Capabilities and Constraints

- Static Astro 7 site, deployed on Cloudflare Pages, Tailwind 3, React
  islands only where interactivity needs them (library search and filters).
- Fonts are self-hosted through Astro's fonts API; any Google Fonts face can
  be added without a runtime request.
- The build must stay pure: `npm run verify` (repository check, typecheck,
  tests, `astro check`, full site and EPUB build) is the CI gate and must
  pass. Build scripts never modify tracked markdown.
- Book URLs (`/books/<slug>/`) and EPUB URLs (`/downloads/<slug>.epub`) are
  public and linked from elsewhere; `public/_redirects` preserves legacy slugs.
- Decision (2026-09-05): each book stays one long page at its existing URL.
  No per-chapter routes. The reader must therefore handle very long documents
  well: wayfinding, position memory, and performance on one page.
- Decision (2026-09-05): audio is a secondary download link beside the EPUB,
  not an in-page player.
- Reader features that already exist and must survive: light, sepia, and
  dark themes; three font sizes; three line spacings; focus mode; reading
  progress; saved scroll position per book; table of contents.
- Google Analytics 4 runs through Partytown. The contact form posts to an
  external endpoint behind Cloudflare Turnstile.
- Terminology: "edition" for a modernized title; "original" for the source
  work; "modernized" not "translated" or "simplified".

## Brand Commitments

- Name: Modernized Classics. Domain: modernizedclassicsbooks.com.
- Existing logo files in `src/assets/` (an open-book mark) are available but
  not binding; the wordmark may be re-set.
- Prose voice of the editions (from the pipeline's rewrite prompt, binding on
  site copy too): authoritative explanatory prose in the register of *The
  Atlantic* or Oliver Sacks. No AI clichés, no conversational filler, no hype.
- The illustrated covers are a commitment: the design must present them as
  the primary imagery and never crop, tint, or hide them.

## Evidence on Hand

- 28 real editions with real covers, descriptions, tags, original dates, and
  EPUBs generated at build time.
- Real pipeline documentation in `README.md`, `AGENTS.md`, `docs/providers.md`,
  and `pipeline/prompts/*.md` for the colophon.
- No testimonials, press, download counts, or reader numbers exist. Do not
  invent any. Do not name specific AI models in site copy; the About page's
  "Gemini 2.5 Pro" and "Kokoro-82M" claims are stale and are to be replaced
  by an honest description of the open pipeline (decision 2026-09-05).

## Product Principles

1. The text is the product. Every surface exists to get someone reading and
   keep them reading; nothing on the site should compete with the page.
2. Honesty about method. Say plainly that editions are machine-rewritten and
   QA-checked against the source, and that the pipeline is open.
3. Free means no friction: no accounts, no gates, no dark patterns, downloads
   one click away.
4. Respect the original: dates, authors, and provenance are always visible;
   the modernization is an edition of a work, not a replacement for it.
5. Built for the long read: hours-long texts on phones, returning readers,
   position memory, and wayfinding through very long documents.

## Accessibility & Inclusion

Reading surfaces must meet WCAG AA contrast in all three themes, support
keyboard navigation of the table of contents and controls, respect
`prefers-reduced-motion`, and keep the reader's own font-size and spacing
choices effective. No product-specific standard beyond AA was established.
