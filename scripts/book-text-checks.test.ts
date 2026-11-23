import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBookText, type BookTextAllowance } from './book-text-checks';

const booksRoot = path.join(process.cwd(), 'src/content/books');

// Every exception needs a reason. Remove an entry as soon as the text is fixed.
const ALLOWANCES: Record<string, BookTextAllowance[]> = {
};

// Books whose text is known to be broken and is being repaired separately.
const PENDING: Record<string, string> = {
  'economic-consequences-of-the-peace': 'Tables were summarized or altered and notes about the prompt remain; being checked against the source.',
  'communist-manifesto-and-das-kapital': 'Das Kapital chapters I–XI are missing, so chapter numbering restarts; being filled in.',
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
});
