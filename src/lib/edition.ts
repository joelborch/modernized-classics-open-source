import type { CollectionEntry } from 'astro:content';
import type { MarkdownHeading } from 'astro';
import seriesColors from '../data/series-colors.json';

export type Edition = CollectionEntry<'books'>;

/** The author as printed: frontmatter carries a ", simplified" suffix on some titles. */
export function displayAuthor(author: string): string {
  return author.replace(/,\s*simplified\s*$/i, '').trim();
}

/** Original publication year as a label: "AD 180", "524", "1776". */
export function yearLabel(year?: number): string | undefined {
  if (year === undefined || year === null) return undefined;
  if (year < 0) return `${Math.abs(year)} BC`;
  if (year < 1000) return `AD ${year}`;
  return String(year);
}

export function wordCount(body: string | undefined): number {
  return (body || '').split(/\s+/).filter(Boolean).length;
}

/** Reading time at roughly 230 words a minute, printed as "10 h 30 min" or "48 min". */
export function readingTime(words: number): string {
  const minutes = Math.max(1, Math.round(words / 230));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}

export function formatWords(words: number): string {
  if (words >= 1000) return `${Math.round(words / 1000)},000 words`;
  return `${words} words`;
}

/** One colour per edition, sampled from its cover by scripts/series-colors.mjs. */
export function seriesColor(slug: string): string | undefined {
  return (seriesColors as Record<string, string>)[slug];
}

export interface Chapter {
  slug: string;
  text: string;
  depth: number;
  index: number;
}

/**
 * Chapters for wayfinding. Editions use `##` for their major divisions; a few
 * carry a single `##` (the work's title) and divide with `###`, so those fall
 * back one level. The opening heading that merely repeats the title is kept
 * out of the list.
 */
export function chaptersFrom(headings: MarkdownHeading[], title: string): Chapter[] {
  const normalized = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const isTitle = (h: MarkdownHeading) => normalized(h.text) === normalized(title);
  let level2 = headings.filter((h) => h.depth === 2 && !isTitle(h));
  let picked = level2;
  if (level2.length < 3) {
    picked = headings.filter((h) => h.depth === 3);
    if (picked.length < 2) picked = level2;
  }
  return picked.map((h, index) => ({ slug: h.slug, text: cleanHeading(h.text), depth: h.depth, index: index + 1 }));
}

function cleanHeading(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/^[#\s]+/, '').trim();
}

export function editionHref(slug: string): string {
  return `/books/${slug}/`;
}

/** Editorial shelving for the home page. Any slug not listed lands in "Further reading". */
export const shelves: { id: string; title: string; note: string; slugs: string[] }[] = [
  {
    id: 'stoics',
    title: 'The Stoics and the Greeks',
    note: 'How to live, from the people who asked first.',
    slugs: ['meditations', 'enchiridion', 'nicomachean-ethics', 'consolation-of-philosophy'],
  },
  {
    id: 'power',
    title: 'Power and the state',
    note: 'The arguments behind every constitution written since.',
    slugs: ['the-prince', 'art-of-war', 'leviathan', 'second-treatise-of-government', 'the-social-contract', 'common-sense', 'on-liberty-utilitarianism-other-essays'],
  },
  {
    id: 'mind',
    title: 'Reason and the mind',
    note: 'What we can know, and how we know it.',
    slugs: ['enquiry-concerning-human-understanding', 'critique-of-pure-reason', 'problems-of-philosophy', 'interpretation-of-dreams', 'varieties-of-religious-experience', 'thus-spoke-zarathustra'],
  },
  {
    id: 'economy',
    title: 'Markets, money, and the world',
    note: 'The books the modern economy still argues with.',
    slugs: ['wealth-of-nations', 'communist-manifesto-and-das-kapital', 'economic-consequences-of-the-peace', 'origin-of-species'],
  },
  {
    id: 'self',
    title: 'The self and society',
    note: 'Independence, conscience, and the good life, American style.',
    slugs: ['walden', 'self-reliance', 'civil-disobedience', 'vindication-rights-of-woman', 'as-a-man-thinketh', 'how-to-get-what-you-want', 'the-game-of-life-and-how-to-play-it'],
  },
];

export const startHere: { slug: string; line: string }[] = [
  { slug: 'meditations', line: 'A Roman emperor’s private notes on keeping your head. The best first classic there is.' },
  { slug: 'the-prince', line: 'Machiavelli on power, without flinching. Five hundred years old and still uncomfortable.' },
  { slug: 'art-of-war', line: 'Sun Tzu’s short, exact manual on strategy, read by generals and founders alike.' },
];

export function sortByTitle<T extends { data: { title: string }; id: string }>(entries: T[]): T[] {
  return [...entries].sort(
    (left, right) => left.data.title.localeCompare(right.data.title, 'en') || left.id.localeCompare(right.id, 'en'),
  );
}
