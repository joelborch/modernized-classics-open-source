// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { readEpub, buildCatalogue } from '../src/epub';
import { makeFixture } from './fixtures/make-fixture';

let directory: string;
let fixture: string;
beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'modernize-epub-test-'));
  fixture = path.join(directory, 'treatise.epub');
  await makeFixture(fixture);
});
afterAll(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

describe('readEpub', () => {
  it('reads metadata and spine items in order with titles and text', async () => {
    const book = await readEpub(fixture);
    expect(book.title).toBe('A Treatise on Testing');
    expect(book.author).toBe('Ada Fixture');
    const titles = book.items.map((i) => i.title);
    expect(titles).toContain('Chapter II. On Middles');
    const ch2 = book.items.find((i) => i.title === 'Chapter II. On Middles')!;
    expect(ch2.text).toContain('Sentence 120 of the passage');
    expect(ch2.text).not.toMatch(/<[^>]+>/);
    // Paragraph breaks survive extraction.
    expect(ch2.text.split('\n\n').length).toBeGreaterThan(100);
    const idx = (t: string) => titles.indexOf(t);
    expect(idx('Chapter I. On Beginnings')).toBeLessThan(idx('Chapter II. On Middles'));
    expect(idx('Chapter II. On Middles')).toBeLessThan(idx('Chapter III. On Endings'));
  });

  it('builds a catalogue the selection model can read', async () => {
    const book = await readEpub(fixture);
    const cat = buildCatalogue(book, 80);
    expect(cat).toMatch(/^Book: A Treatise on Testing/);
    expect(cat).toContain('Title: Chapter III. On Endings');
    expect(cat).toContain('Preview: ');
  });
});
