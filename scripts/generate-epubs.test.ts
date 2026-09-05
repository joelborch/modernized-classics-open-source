// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { parseStringPromise as parseXml } from 'xml2js';
import { createEpub, detectCover, EPUB_RIGHTS } from './epub-package.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fixtureRoot: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'modernized-epub-metadata-'));
  const bookDir = path.join(fixtureRoot, 'src/content/books/sample-book');
  await mkdir(bookDir, { recursive: true });
  await writeFile(
    path.join(bookDir, 'index.md'),
    `---
title: Sample Book
author: Sample Author
yearPublished: 1907
---

## First chapter

Sample text.

---
`
  );
  await writeFile(
    path.join(bookDir, 'cover.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    )
  );

  execFileSync(
    path.join(repositoryRoot, 'node_modules/.bin/tsx'),
    [path.join(repositoryRoot, 'scripts/generate-epubs.ts')],
    { cwd: fixtureRoot, stdio: 'pipe' }
  );
});

afterAll(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe('generated EPUB', () => {
  it('is a readable EPUB3 archive with navigation, chapters, and a cover', async () => {
    const epub = await readFile(path.join(fixtureRoot, 'public/downloads/sample-book.epub'));
    const zip = new AdmZip(epub);
    const entries = zip.getEntries();

    expect(entries[0].entryName).toBe('mimetype');
    expect(entries[0].header.method).toBe(0);
    expect(zip.readAsText('mimetype')).toBe('application/epub+zip');
    expect(zip.test()).toBe(true);
    expect(entries.map(entry => entry.entryName)).toEqual(
      expect.arrayContaining([
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/nav.xhtml',
        'OEBPS/toc.ncx',
        'OEBPS/cover.png',
        'OEBPS/cover.xhtml',
        'OEBPS/text/chapter-001.xhtml'
      ])
    );
    expect(zip.readAsText('OEBPS/nav.xhtml')).toContain(
      '<a href="text/chapter-001.xhtml">First chapter</a>'
    );
    expect(zip.readFile('OEBPS/cover.png')).toEqual(
      await readFile(path.join(fixtureRoot, 'src/content/books/sample-book/cover.png'))
    );
    const chapter = zip.readAsText('OEBPS/text/chapter-001.xhtml');
    expect(chapter).toContain('<p>Sample text.</p>');
    expect(chapter).toContain('<hr />');
  });

  it('writes well-formed XML and scoped CC BY 4.0 metadata', async () => {
    const epub = await readFile(path.join(fixtureRoot, 'public/downloads/sample-book.epub'));
    const zip = new AdmZip(epub);
    const opfText = zip.readAsText('OEBPS/content.opf');
    const opf = await parseXml(opfText);

    await Promise.all([
      parseXml(zip.readAsText('META-INF/container.xml')),
      parseXml(zip.readAsText('OEBPS/nav.xhtml')),
      parseXml(zip.readAsText('OEBPS/toc.ncx')),
      parseXml(zip.readAsText('OEBPS/cover.xhtml')),
      parseXml(zip.readAsText('OEBPS/text/chapter-001.xhtml'))
    ]);

    const metadata = opf.package.metadata[0];
    expect(metadata['dc:title'][0]).toBe('Sample Book');
    expect(metadata['dc:creator'][0]).toBe('Sample Author');
    expect(metadata['dc:date'][0]).toBe('1907');
    expect(metadata['dc:rights'][0]).toBe(EPUB_RIGHTS);
    expect(metadata.link[0].$).toMatchObject({
      rel: 'license',
      href: 'https://creativecommons.org/licenses/by/4.0/'
    });
    const manifest = opf.package.manifest[0].item.map((item: { $: Record<string, string> }) => item.$);
    expect(manifest).toContainEqual(
      expect.objectContaining({
        id: 'cover-image',
        href: 'cover.png',
        'media-type': 'image/png',
        properties: 'cover-image'
      })
    );
    expect(manifest).toContainEqual(
      expect.objectContaining({ id: 'nav', href: 'nav.xhtml', properties: 'nav' })
    );
    expect(opfText).not.toContain('All rights reserved');
    expect(opfText).not.toContain('Copyright ©');
    expect(opfText).not.toContain('Copyright &#x00A9;');
  });

  it('creates identical bytes for identical content', () => {
    const options = {
      title: 'Deterministic Book',
      author: 'Fixture Author',
      publicationYear: '1907',
      modifiedYear: '2025',
      chapters: [{ title: 'Chapter One', html: '<p>Stable content.</p>' }]
    };

    expect(createEpub(options)).toEqual(createEpub(options));
  });

  it('derives cover media type from the file data', () => {
    expect(detectCover(Buffer.from([0xff, 0xd8, 0xff, 0x00])).mediaType).toBe('image/jpeg');
    expect(
      detectCover(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).mediaType
    ).toBe('image/png');
  });
});
