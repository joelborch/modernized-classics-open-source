import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bulletShare, checkBookText, MAX_BULLET_SHARE, type BookTextAllowance } from './book-text-checks';

const booksRoot = path.join(process.cwd(), 'src/content/books');

// Every exception needs a reason. Remove an entry as soon as the text is fixed.
const ALLOWANCES: Record<string, BookTextAllowance[]> = {
};

// Books whose text is known to be broken and is being repaired separately.
const PENDING: Record<string, string> = {
};

// Books that still read as outlines in places. Remove an entry once the book is redone as prose.
const OUTLINE_PENDING: Record<string, string> = {
  'art-of-war': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'communist-manifesto-and-das-kapital': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'economic-consequences-of-the-peace': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'enquiry-concerning-human-understanding': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'nicomachean-ethics': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'on-liberty-utilitarianism-other-essays': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'origin-of-species': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'second-treatise-of-government': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'varieties-of-religious-experience': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'vindication-rights-of-woman': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'walden': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
  'wealth-of-nations': 'written partly as bullet-point notes by the old pipeline; queued for a full redo',
};

describe('book text', () => {
  const slugs = readdirSync(booksRoot).filter(s => existsSync(path.join(booksRoot, s, 'index.md')));

  for (const slug of slugs) {
    it.skipIf(slug in PENDING)(`${slug} has no pipeline leftovers, repeated passages or broken numbering`, () => {
      const markdown = readFileSync(path.join(booksRoot, slug, 'index.md'), 'utf8');
      const problems = checkBookText(markdown, ALLOWANCES[slug]);
      expect(problems.map(p => `${p.kind} line ${p.line}: ${p.detail}`)).toEqual([]);
    });
  }

  for (const slug of slugs) {
    it.skipIf(slug in OUTLINE_PENDING)(`${slug} is written as prose, not bullet-point notes`, () => {
      const { share } = bulletShare(readFileSync(path.join(booksRoot, slug, 'index.md'), 'utf8'));
      expect(share, `${(share * 100).toFixed(1)}% of lines are bullets`).toBeLessThanOrEqual(MAX_BULLET_SHARE);
    });
  }

  it('every outline exception is still an outline, so fixed books come off the list', () => {
    for (const slug of Object.keys(OUTLINE_PENDING)) {
      const { share } = bulletShare(readFileSync(path.join(booksRoot, slug, 'index.md'), 'utf8'));
      expect(share, `${slug} is now prose; remove it from OUTLINE_PENDING`).toBeGreaterThan(MAX_BULLET_SHARE);
    }
  });

  it('every allowance still matches something, so stale exceptions get removed', () => {
    for (const [slug, allowances] of Object.entries(ALLOWANCES)) {
      const markdown = readFileSync(path.join(booksRoot, slug, 'index.md'), 'utf8');
      const unallowed = checkBookText(markdown);
      for (const a of allowances) {
        expect(unallowed.some(p => p.kind === a.kind
          && markdown.replace(/\r\n/g, '\n').split('\n')[p.line - 1].trim().startsWith(a.startsWith)),
        `${slug}: allowance "${a.startsWith}" no longer matches`).toBe(true);
      }
    }
  });
});

describe('checkBookText', () => {
  it('flags refusals, pipeline notes, repeats and backwards numbering', () => {
    const para = 'This is a long paragraph of ordinary book prose that goes on for quite a while so that it passes the minimum length used for the duplicate paragraph check in these tests.';
    const md = [
      '---', 'title: Test', '---',
      '## Book 1', para,
      "I'm only a language model and can't help with that.",
      'The provided text consists of footnotes and endnotes.',
      '## Book 2', para,
      '## Book 2',
    ].join('\n');
    expect(checkBookText(md).map(p => p.kind)).toEqual(['leftover', 'leftover', 'duplicate', 'numbering']);
  });

  it('restarts chapter numbering under a new Book or Part', () => {
    const md = ['### Book I', '### Chapter 1', '### Chapter 2', '### Book II', '### Chapter 1'].join('\n');
    expect(checkBookText(md)).toEqual([]);
  });

  it('honours an allowance', () => {
    const para = 'Another long paragraph of ordinary book prose that goes on for quite a while so that it passes the minimum length used for the duplicate paragraph check in these tests.';
    const md = [para, para].join('\n');
    expect(checkBookText(md, [{ kind: 'duplicate', startsWith: 'Another long', reason: 'test' }])).toEqual([]);
  });

  it('measures bullet share, ignoring headings, tables, quotes and numbered lists', () => {
    const md = ['---', 'title: T', '---', '# H', 'Prose.', '* a', '- b', '1. one', '| x |', '> q', ''].join('\n');
    expect(bulletShare(md)).toEqual({ bullets: 2, blocks: 4, share: 0.5 });
  });
});
