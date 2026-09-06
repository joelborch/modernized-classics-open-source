---
name: Modernized Classics
description: The scholarly reading edition brought to the web. A text block with a living apparatus around it.
colors:
  paper: "#f6f7f8"
  ink-1: "#eceef0"
  ink-2: "#e1e3e6"
  ink-3: "#d0d3d7"
  ink-4: "#b9b9b2"
  ink-5: "#96968f"
  ink-6: "#75756e"
  ink-7: "#585852"
  ink-8: "#3e3e39"
  ink-9: "#26261f"
  ink-10: "#14140f"
  series: "#2f4a7a"
  series-tint: "color-mix(in oklab, var(--series) 12%, var(--paper))"
typography:
  display:
    fontFamily: "Literata, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "clamp(2.25rem, 4.5vw + 0.5rem, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 72"
  headline:
    fontFamily: "Literata, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "1.75em"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'opsz' 40"
  title:
    fontFamily: "Literata, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "1.25em"
    fontWeight: 500
    lineHeight: 1.25
    fontVariation: "'opsz' 24"
  body:
    fontFamily: "Literata, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.65
    fontFeature: "'kern', 'liga', 'onum'"
    fontVariation: "'opsz' 14"
  note:
    fontFamily: "Literata, Iowan Old Style, Palatino, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  meta:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  none: "0"
  dot: "50%"
spacing:
  hair: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1.25rem"
  lg: "1.75rem"
  xl: "2.5rem"
  2xl: "3.5rem"
  section: "5rem"
components:
  action:
    backgroundColor: "transparent"
    textColor: "{colors.ink-10}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "2.75rem"
  action-hover:
    backgroundColor: "{colors.ink-1}"
  action-primary:
    backgroundColor: "{colors.ink-10}"
    textColor: "{colors.paper}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "2.75rem"
  action-primary-hover:
    backgroundColor: "{colors.ink-9}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-8}"
    rounded: "{rounded.none}"
    size: "2.25rem"
  icon-button-hover:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.ink-10}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-8}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0.2rem 0"
  chip-selected:
    textColor: "{colors.ink-10}"
  nav-link:
    textColor: "{colors.ink-8}"
    typography: "{typography.ui}"
    padding: "0.25rem 0"
  nav-link-current:
    textColor: "{colors.ink-10}"
  search-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink-10}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0"
  segmented-option:
    backgroundColor: "transparent"
    textColor: "{colors.ink-8}"
    typography: "{typography.meta}"
    height: "2.25rem"
  segmented-option-selected:
    backgroundColor: "{colors.series-tint}"
    textColor: "{colors.ink-10}"
  cover:
    backgroundColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
---

# Design System: Modernized Classics

## Overview

**Creative North Star: "The Critical Edition"**

The site is a scholarly reading edition brought to the web. Every page is a text block set in Literata on cool wove-white paper, with an apparatus around it (running head, chapter rail, contents, provenance line) that answers "where am I" without competing with the text. The apparatus is set small in Atkinson Hyperlegible Next, and it earns its place by being useful, not by being decorated. The world explicitly refuses the category's card-and-sidebar reader with a settings panel and a floating toolbar.

Colour is almost entirely grey. Every grey on the site comes from one fixed eleven-step ink ramp that is re-drawn for each of the three papers (light, sepia, dark), so a contributor never picks a grey; they pick a step. The single accent is the series colour: one colour per edition, sampled from its cover at build time, and used only for hairlines, ticks, the ribbon, the spine band, selection, focus, and caret. On surfaces with no edition it falls back to the site's own ink-blue.

Depth is flat. Structure is drawn with 1px hairlines and whitespace; the only shadows are the physical drop under a cover, because the cover is treated as an object on the desk rather than an image in a card. Nothing has a radius except dots (chapter ticks, theme swatches). Density is that of a well-set book: a 66ch measure, generous section padding, and small tracked-caps labels that sit in the margins.

**Key Characteristics:**
- One fixed eleven-step ink ramp per theme; no grey is ever picked outside it.
- One series colour per edition, confined to rules, ticks, ribbon, band, and state.
- Literata for every word the reader reads; Atkinson Hyperlegible Next for every word the apparatus says, at one small size.
- Hairline rules and whitespace instead of cards, panels, or shadows.
- Zero radius on every rectangle; circles only for dots.
- Covers are 2:3 objects with a spine edge and a drop shadow, never cropped or tinted.
- One authored motion (the ribbon settle); everything else is a 150ms exponential ease-out.

## Colors

A monochrome ink ramp on paper, with a single edition-specific accent confined to hairlines and marks.

### Primary
- **Series colour** (`--series`, default `#2f4a7a` ink-blue): the one accent. Set per edition from `src/data/series-colors.json` on the book page, home shelf items, and library items via an inline `--series` custom property; the default applies to any surface with no edition. Never applied raw: the build derives three roles from it.
  - **Series ink** (`--series-ink`): text-coloured uses of the accent (contents hover, current chapter in the dialog, link underline hairlines, the "clear filters" link, the caret). Light theme uses the series colour unchanged; sepia mixes it 88% toward ink-10; dark mixes it 62% toward white so it reads on dark paper.
  - **Series rule** (`--series-rule`): the hairline and mark colour (running-head underline, rail progress line, ticks, ribbon, spine band, primary action underline, focus ring, selected-state underlines). Dark theme lifts it 75% toward white.
  - **Series tint** (`--series-tint`): 12% of the series colour over paper (22% on dark), used only for text selection and the pressed state of segmented controls.

### Neutral
- **Paper** (`--paper`): the ground for every surface, including sticky chrome, menus, and the dialog. Cool wove-white in light (`#f6f7f8`), warm in sepia (`#f3ecdc`), near-black in dark (`#15161a`).
- **Ink 1 to 3** (`--ink-1` to `--ink-3`): surfaces and hairlines. Ink-1 is the hover wash on actions, icon buttons, segmented options, and spine rows. Ink-2 is the cover placeholder ground, list-row dividers, and the mobile edge rail track. Ink-3 is the default hairline (`--rule`, `--hairline`) and the rail track.
- **Ink 4 to 6** (`--ink-4` to `--ink-6`): quiet strokes and de-emphasised marks. Ink-4 is the default link underline, tick border, blockquote rule, text `hr`, and select underline. Ink-5 is the reader-menu border, the search input underline, and the provenance-line separators. Ink-6 is list markers, contents numbers, disclosure chevrons, placeholder text.
- **Ink 7 and 8** (`--ink-7`, `--ink-8`): apparatus text. Ink-7 is the colour of every label and meta line and the running-head chapter. Ink-8 is nav links, footer text, icon buttons at rest, segmented options at rest.
- **Ink 9 and 10** (`--ink-9`, `--ink-10`): reading text. Ink-9 is descriptions, ledes, blockquotes, and contents entries; ink-10 is the text block, headings, titles, and anything hovered or current.

### Named Rules
**The One Ramp Rule.** Every grey is one of the eleven ink steps or paper. No `rgba` greys, no Tailwind greys, no opacity-faded text except the two places the build already uses it (the resume chapter name at 0.9, the cover-board author at 0.85).

**The Margin Accent Rule.** The series colour lives in the margins and on marks: rules, ticks, the ribbon, the spine band, the primary action's underline, and state (focus, selection, pressed, current). Inside the text block it appears only as the hairline under a link. It never fills a panel, colours running text, or tints a heading.

**The Three Papers Rule.** Light, sepia, and dark are not three palettes; they are one ramp re-drawn three times under `html[data-theme]`. New colour roles must be defined once in `tokens.css` with a derivation per theme, never per component.

## Typography

**Display Font:** Literata (with Iowan Old Style, Palatino, Georgia, serif)
**Body Font:** Literata, same family, variable 200 to 900 with true italics
**Label/UI Font:** Atkinson Hyperlegible Next (with system-ui, sans-serif), variable 200 to 800

**Character:** Literata is a serif drawn for long screen reading and sets every word the reader reads: titles, the text block, descriptions, contents entries, the wordmark, and the running-head title. It always carries kerning, ligatures, and old-style figures (`.t-text`), and its optical size follows the role (72 for display, 40 and 24 for headings, 14 for the text). Atkinson Hyperlegible Next is the apparatus voice, chosen for legibility research rather than style, always with tabular lining figures, and it never exceeds 0.9375rem outside the search input.

### Hierarchy
- **Display** (500, `clamp(2.25rem, 4.5vw + 0.5rem, 3.5rem)`, 1.05, -0.015em, opsz 72): the edition title in the band. The home masthead uses the same role at a larger clamp (`clamp(2.5rem, 6vw + 0.5rem, 5.5rem)`, max 14ch); the colophon note h1 at 2.25rem. Always `text-wrap: balance`.
- **Headline** (500, 1.75em of the reader size, 1.15, -0.01em, opsz 40): `h2` inside the text block. Margins are 3.25em above and 0.75em below, so a chapter opens with air above it.
- **Title** (500, 1.25em, 1.25, opsz 24): `h3` inside the text block. Outside the reader the same role sets section titles at 1.5rem, pick titles at 1.25rem, shelf row titles at 1.125rem, and spine titles at 1.0625rem; `h4` is 1.05em at 600.
- **Body** (400, `--reader-size` 1.125rem, `--reader-leading` 1.65, opsz 14): the text block, at a 66ch measure. The reader can step size to 1rem or 1.3125rem and leading to 1.5 or 1.85 through `data-reader-size` and `data-reader-leading` on `html`; the text block is the only thing those attributes move.
- **Note** (400, 1.0625rem, 1.6): long-form prose outside the reader (band description, colophon, legal, the home "note on the text"), in ink-9.
- **UI** (Atkinson, 500, 0.9375rem): actions, nav links, chips, download links, contents entries at 0.9375rem.
- **Meta** (Atkinson, 400, 0.8125rem, ink-7, tabular lining figures): provenance lines, counts, percentages, shelf captions, footer notes.
- **Label** (Atkinson, 500, 0.6875rem, 0.12em tracking, uppercase, ink-7): functional labels only: the author in the running head, "Contents", the reader-menu section names ("Size", "Spacing", "Paper"), the wordmark tagline, table headers.

### Named Rules
**The Two Voices Rule.** Literata speaks for the book; Atkinson speaks for the apparatus. A word the reader reads is never set in the UI face, and a control, label, or count is never set in the serif, with one deliberate exception: the "Aa" settings glyph and the segmented size options, which show the reading face because they are about it.

**The Small Apparatus Rule.** Apparatus type stays small and marginal. Labels are 0.6875rem tracked caps, meta is 0.8125rem, and nothing in the chrome exceeds the wordmark's 1.1875rem. A label names a thing that exists on the page (a section of the menu, a column, a running-head slot); it is never a decorative kicker above a heading.

**The Optical Size Rule.** Every Literata role sets `font-variation-settings: 'opsz'` explicitly (72, 40, 24, 14) so headings tighten and text opens up as the family intends.

## Layout

One vertical axis rules position on every width. The page column is `.wrap`: `min(100% - 2.5rem, 78rem)` centred, widening to `100% - 4rem` at 768px. Inside it the reading edition is a three-column grid from 768px (`minmax(0,1fr) | minmax(0, 66ch) | minmax(4.5rem, 1fr)`, 2rem column gap) so the 66ch text block sits centred and the chapter rail takes the outer right column, sticky below the running head. Below 768px the text is a single column and the rail becomes a fixed 3px edge on the right of the viewport, same axis, same progress line.

Chrome is two stacked bars: the site header (`--site-header-h` 3.5rem, hairline beneath) and, on book pages, the sticky running head (`--running-head-h` 2.75rem, series hairline beneath, three-column grid `1fr | 2fr | 1fr` from 900px, two columns below). Anchor targets and heading `scroll-margin-top` offset by the running-head height plus 1.5rem so a chapter never lands under the head.

The edition band is a two-column grid from 768px (`240px | 1fr`, 3rem gap, padding 3.5rem top, 2.5rem bottom) with the cover sticky in the left column; on mobile it stacks with the cover at 168px and 2.5rem/2rem padding. Home and library shelves use the same widths: cover grids of 2 columns, then 4 at 640px, then `auto-fill` at 140 to 170px from 1024px, with 1.75rem to 2.25rem row gaps.

Spacing is a rem rhythm in quarter steps: 0.25 and 0.5rem inside controls, 0.75 and 1.25rem between related lines, 1.75 and 2.5rem between blocks, 3.5rem for section padding, and 5rem above the footer and the masthead. Breakpoints in use are 640, 768, 900, 1024, and 1100px; 768px is the one that changes structure (rail appears, band goes two-column), the others only re-flow grids or reveal chrome.

**The Hairline Section Rule.** Sections are separated by a `--rule` hairline (1px ink-3) and padding, never by a background change, a container, or a heavier line. Series-coloured rules are reserved for the running head.

## Elevation & Depth

Flat. Depth is conveyed by hairlines and by paper covering paper: the sticky running head, the reader menu, and the contents dialog all sit on `--paper` with a 1px border (ink-3 for the dialog and segmented groups, ink-5 for the menu) and no shadow. Rings around theme swatches are drawn as 1px `box-shadow` spread in the series-rule colour, which is a border on a circle, not a shadow.

The only true shadows belong to the cover, because it is an object.

### Shadow Vocabulary
- **Cover at rest** (`box-shadow: 0 1px 2px rgba(0,0,0,0.14), 0 12px 28px -12px rgba(0,0,0,0.35)`): every cover, every size. Dark theme deepens it (`0 1px 2px rgba(0,0,0,0.5), 0 14px 30px -12px rgba(0,0,0,0.8)`).
- **Cover lifted** (`transform: translateY(-3px)` and `0 2px 3px rgba(0,0,0,0.14), 0 18px 34px -12px rgba(0,0,0,0.4)`): hover on a linked cover, 200ms.
- **Dialog backdrop** (`rgba(20,20,15,0.35)` with `backdrop-filter: blur(2px)`; `rgba(0,0,0,0.6)` in dark): the contents dialog only.

### Named Rules
**The Object Shadow Rule.** A shadow means a physical object. Only covers cast one. Panels, menus, buttons, and rows are flat with a hairline.

## Shapes

Rectangles are square. `border-radius` is 0 on every button, input, select, menu, dialog, row, and cover; the focus ring itself has a 1px radius so its corners do not flare. The only circles are dots that mean a point rather than a container: chapter ticks (7px, 11px when current), theme swatches (0.875rem), reader-menu swatches (0.75rem), and the theme buttons around them.

Borders are 1px hairlines from the ink ramp; the only 2px strokes are state indicators (the current tick's ring, the primary action's series underline, the segmented control's pressed underline, the focus outline). The ribbon is a series-coloured rectangle with a clipped fishtail (`polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)`), 13x34px in the rail and 8x22px on the mobile edge. Covers are 2:3 with a shaded spine strip on the left (6% width, max 14px, a dark-to-light gradient) and an inset 1px hairline; the placeholder board fills the same frame with the series colour and white Literata.

Hairline underlines are the site's active-state device: nav links, chips, and the select all carry a 1px transparent bottom border that becomes ink-4 on hover and series-rule when current or pressed.

## Components

### Buttons
The action is a text-height ink outline; the primary is the same block filled.
- **Shape:** square (0 radius), 2.75rem tall, 1.125rem horizontal padding, UI type at 0.9375rem 500, 0.5rem gap to an inline 1rem SVG.
- **Action (secondary):** transparent with a 1px ink-10 border and ink-10 text; hover washes ink-1.
- **Primary:** ink-10 fill, paper text, 2px series-rule bottom border; hover lifts to ink-9. Used for "Start reading" / "Resume at <chapter>" in the edition band. (The direction contract asked for a text link here; the shipped fill is recorded as a known gap, not a preference. Do not add more filled blocks.)
- **Hover / Focus:** background, colour, and border transition 150ms `cubic-bezier(0.2, 0, 0, 1)`; focus is the global 2px series-rule outline at 2px offset.
- **Icon button:** 2.25rem square, transparent, ink-8, 1.125rem inline SVG at 1.5 stroke; hover ink-10 on an ink-1 wash. Used in the running head and dialog head.
- **Text links as actions:** downloads (EPUB, Audio) are UI-face links in ink-9 with an ink-4 underline and a 1rem leading SVG in ink-7, sitting beside the primary at a 1.25rem gap.

### Chips
- **Style:** bare text (UI, 0.9375rem, ink-8) with a 1px transparent bottom border, 0.2rem vertical padding, 0.75rem apart.
- **State:** hover ink-10 with an ink-4 underline; pressed ink-10 with a series-rule underline.

### Cards / Containers
There are no cards. A shelf item is a cover, a title (Literata 0.9375rem 500), and a meta line (0.75rem) stacked at a 0.35 to 0.5rem gap with no background or border. A spine row is a grid (`6px band | title | author | year | length | formats`, 0.7rem vertical padding, hairline beneath) whose band column is filled with series-rule; hover washes the row ink-1 and turns the title series-ink. The reader menu and the contents dialog are the only floating containers: paper, 1px border, 1rem or 1.25rem padding, no radius, no shadow.

### Inputs / Fields
- **Search:** Literata 1.25rem on a transparent ground with only a 1px ink-5 bottom border; italic ink-6 placeholder; focus swaps the underline to series-rule and suppresses the outline.
- **Select:** UI type, transparent, 1px ink-4 bottom border, 0 radius.
- **Segmented control (reader menu):** a hairline-bordered row of equal buttons, 2.25rem tall, hairlines between them, 0.8125rem ink-8; pressed shows series-tint with a 2px series-rule underline.
- **Checkbox:** native, `accent-color: var(--series)`.

### Navigation
- **Site header:** wordmark in Literata (1.0625rem, 1.1875rem from 640px, 500, -0.01em) with a tracked-caps tagline beneath from 900px; links in UI type ink-8 with the hairline-underline states (ink-4 hover, series-rule current); theme swatches as three circles, the current one ringed in series-rule; on mobile a single cycling swatch.
- **Running head (book pages):** sticky, paper, series hairline beneath. Author as a label (left, from 900px), work title in Literata italic with the current chapter appended in meta type (centre), percent in meta plus contents and "Aa" icon buttons (right). The title is itself the button that opens contents.
- **Contents:** an inline `<details>` in the band (two columns from 640px, ink-2 dividers, ink-6 numbers) and a `<dialog>` from the running head (40rem max, sticky head with label and close button, hairline list, current entry in series-ink).
- **Footer:** hairline above, 5rem margin, UI type ink-8, three columns from 768px, a second hairline before the base line.

### Chapter rail and ribbon
The signature apparatus. A 1px ink-3 track sticky in the outer column, with a series-rule progress line scaling from the top (120ms linear), one 7px paper dot per chapter with an ink-4 border that fills series-rule once passed and grows to an 11px ring when current, and a UI-type 0.75rem chapter name that appears on hover, focus, or current (hidden between 768 and 1100px where it would collide). The ribbon is a series-rule fishtail hung at the saved position; on return it plays the one authored motion, a 700ms `ribbon-settle` (translate up 14px, scaleY 0.6, fade in) on the same ease. Below 768px the whole rail collapses to a fixed 3px edge with the same progress line and a smaller ribbon.

### Cover
Always the `Cover` component: 2:3, ink-2 ground, spine-edge strip, inset hairline, the object shadow, `object-fit: cover` on a webp srcset. Rendered at 240px in the band, 220px in home picks, 150px on the shelf, 150 to 170px in the library grid, 168px on mobile bands. A missing cover renders a typographic board in the series colour with the title in Literata and the author as a tracked-caps label.

### Motion
One easing, `cubic-bezier(0.2, 0, 0, 1)`, at 150ms for every state change (colour, background, border, chevron rotation, tick), 200ms for the cover lift, 700ms for the ribbon settle. Progress lines move at 120ms linear because they track scroll. `prefers-reduced-motion` collapses all of it to 0.01ms and forces `scroll-behavior: auto`.

## Do's and Don'ts

### Do:
- **Do** take every grey from `--ink-1` through `--ink-10` and every ground from `--paper`; define any new role once in `tokens.css` with its sepia and dark derivations.
- **Do** set anything the reader reads in Literata via `.t-text` (kerning, ligatures, old-style figures) and everything the apparatus says in Atkinson via `.t-label`, `.t-meta`, or `font-family: var(--font-ui)` at 0.9375rem or smaller.
- **Do** separate sections with a `--rule` hairline and rem padding (1.75, 2.5, 3.5, 5rem) rather than a background or container.
- **Do** carry state with a hairline underline: transparent at rest, ink-4 on hover, series-rule when current or pressed.
- **Do** render covers only through the `Cover` component, 2:3, uncropped, with the spine edge and the object shadow.
- **Do** use inline stroke SVGs (`viewBox 0 0 20 20`, stroke 1.5, round caps) at 1rem or 1.125rem for icons; `.action svg` and `.icon-button svg` already size them.
- **Do** use `.wrap` for every page column and the 66ch `--measure` for any long-form prose (`.edition-text` or `.note`).
- **Do** transition state changes at 150ms `cubic-bezier(0.2, 0, 0, 1)` and nothing else; keep the ribbon settle the only authored motion.

### Don't:
- **Don't** build cards, tiles, or bordered boxes around content. A shelf item is a cover and two lines of text; a list is hairline rows.
- **Don't** add `border-radius` to any rectangle. Circles are for ticks and swatches only.
- **Don't** cast shadows on anything that is not a cover; menus and dialogs are paper with a 1px border.
- **Don't** add eyebrows or kickers above headings. `.t-label` names a thing that exists on the page; a heading stands on its own.
- **Don't** put the series colour inside the text block beyond a link's underline hairline, and never as a fill, a tint behind text, or the colour of running text or headings.
- **Don't** use icon fonts, emoji, or glyph characters as icons; the "Aa" mark is a typographic label for the type settings and the only text used that way.
- **Don't** set apparatus text larger than 0.9375rem or reading text in the UI face; the search input at Literata 1.25rem is the one input that takes the reading face because the reader types a title into it.
- **Don't** add a second filled action to a surface. One filled primary per page is the shipped ceiling, and even that is an open item; secondary actions are outlines or underlined text links.
- **Don't** invent a fourth theme or override a ramp step inside a component; themes switch only through `html[data-theme]`.
