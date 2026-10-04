// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, stat, symlink, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { parseStringPromise as parseXml } from 'xml2js';
import { createEpub, detectCover, detectInlineImage, EPUB_RIGHTS } from './epub-package.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fixtureRoot: string;
const pngFigure = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const jpegFigure = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64');
const svgFigure = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="black"/></svg>');
function generateAt(cwd: string) {
  return execFileSync(path.join(repositoryRoot, 'node_modules/.bin/tsx'),
    [path.join(repositoryRoot, 'scripts/generate-epubs.ts')], { cwd, stdio: 'pipe' });
}

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

  const verseBookDir = path.join(fixtureRoot, 'src/content/books/verse-book');

  const essayDir = path.join(fixtureRoot, 'src/content/books/collected-essays');
  await mkdir(essayDir, { recursive: true });
  await writeFile(path.join(essayDir, 'index.md'), `---
title: Collected Essays
author: Fixture Author
---

# The First Essay

The first essay remains complete.

## The Second Essay

The second essay remains complete.
`);
  await mkdir(verseBookDir, { recursive: true });
  await writeFile(path.join(verseBookDir, 'index.md'), `---
title: Verse Book
author: Fixture Author
---
## Book One

### Song One

First verse line  
Second verse line

Third verse line  
Fourth verse line

### Closing heading
`);

  const imageDir = path.join(fixtureRoot, 'src/content/books/illustrated-book/source-assets');
  await mkdir(imageDir, { recursive: true });
  await writeFile(path.join(imageDir, 'diagram.png'), pngFigure);
  await writeFile(path.join(imageDir, 'map.jpg'), jpegFigure);
  await writeFile(path.join(imageDir, 'vector.svg'), svgFigure);
  await writeFile(path.join(imageDir, '../index.md'), `---
title: Illustrated Book
author: Fixture Author
---
## First figure

![Diagram & chart](source-assets/diagram.png)

![Map][map]

## Second figure

![Diagram repeated](source-assets/diagram.png)

![Vector](source-assets/vector.svg)

[map]: source-assets/map.jpg "Original map"
`);

  const tableDir = path.join(fixtureRoot, 'src/content/books/naval-costs');
  await mkdir(tableDir, { recursive: true });
  await writeFile(path.join(tableDir, 'index.md'), `---
title: Naval Costs
author: Thomas Paine
---
## Naval costs

| Ships | Guns | Cost of one (£) | Cost of all (£) |
| --- | --- | --- | --- |
| 6 | 100 | 35,553 | 213,318 |
| 12 | 90 | 29,886 | 358,632 |
| 12 | 80 | 23,638 | 283,656 |
| 43 | 70 | 17,785 | 764,755 |
| 35 | 60 | 14,197 | 496,895 |
| 40 | 50 | 10,606 | 424,240 |
| 45 | 40 | 7,558 | 340,110 |
| 58 | 20 | 3,710 | 215,180 |
| 85 | Sloops, bombs, and fireships, averaged | 2,000 | 170,000 |
| **Cost of ships** | | | **3,266,786** |
| **Remaining for guns** | | | **233,214** |
| **Total** | | | **3,500,000** |
`);

  execFileSync(
    path.join(repositoryRoot, 'node_modules/.bin/tsx'),
    [path.join(repositoryRoot, 'scripts/generate-epubs.ts')],
    { cwd: fixtureRoot, stdio: 'pipe' }
  );
});

it('names an opening level-one essay in EPUB contents without duplicating its heading', async () => {
  const zip = new AdmZip(await readFile(path.join(fixtureRoot, 'public/downloads/collected-essays.epub')));
  const navigation = zip.readAsText('OEBPS/nav.xhtml');
  const first = zip.readAsText('OEBPS/text/chapter-001.xhtml');
  expect(navigation).toContain('>The First Essay</a>');
  expect(navigation).toContain('>The Second Essay</a>');
  expect(navigation).not.toContain('>Introduction</a>');
  expect(first.match(/<h1>The First Essay<\/h1>/g)).toHaveLength(1);
  expect(first).toContain('The first essay remains complete.');
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
      rel: 'dcterms:license',
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

  it('preserves adjacent and trailing authored headings plus verse lines and stanzas', async () => {
    const epub = await readFile(path.join(fixtureRoot, 'public/downloads/verse-book.epub'));
    const zip = new AdmZip(epub);
    const nav = zip.readAsText('OEBPS/nav.xhtml');
    const chapters = [1, 2, 3].map(index => zip.readAsText(
      `OEBPS/text/chapter-${String(index).padStart(3, '0')}.xhtml`
    ));

    expect(nav).toContain('>Book One</a>');
    expect(nav).toContain('>Song One</a>');
    expect(nav).toContain('>Closing heading</a>');
    expect(chapters[0]).toContain('<h1>Book One</h1>');
    expect(chapters[1]).toContain('<h1>Song One</h1>');
    expect(chapters[2]).toContain('<h1>Closing heading</h1>');
    expect(chapters[1]).toContain('<p>First verse line<br />\nSecond verse line</p>');
    expect(chapters[1]).toContain('<p>Third verse line<br />\nFourth verse line</p>');
    await Promise.all(chapters.map(chapter => parseXml(chapter)));
  });

  it('embeds each local figure unchanged, resolves book-wide references, and manifests every media type', async () => {
    const zip = new AdmZip(await readFile(path.join(fixtureRoot, 'public/downloads/illustrated-book.epub')));
    expect(zip.readFile('OEBPS/images/figure-001.png')).toEqual(pngFigure);
    expect(zip.readFile('OEBPS/images/figure-002.jpg')).toEqual(jpegFigure);
    expect(zip.readFile('OEBPS/images/figure-003.svg')).toEqual(svgFigure);
    expect(zip.getEntries().filter(entry => entry.entryName.startsWith('OEBPS/images/'))).toHaveLength(3);
    const first = zip.readAsText('OEBPS/text/chapter-001.xhtml');
    const second = zip.readAsText('OEBPS/text/chapter-002.xhtml');
    expect(first).toContain('src="../images/figure-001.png"');
    expect(first).toContain('src="../images/figure-002.jpg"');
    expect(first).toContain('alt="Diagram &#x26; chart"');
    expect(second).toContain('src="../images/figure-001.png"');
    expect(second).toContain('src="../images/figure-003.svg"');
    const opf = await parseXml(zip.readAsText('OEBPS/content.opf'));
    const manifest = opf.package.manifest[0].item.map((item: { $: Record<string, string> }) => item.$);
    for (const [index, extension, mediaType] of [[1, 'png', 'image/png'], [2, 'jpg', 'image/jpeg'], [3, 'svg', 'image/svg+xml']]) {
      expect(manifest).toContainEqual(expect.objectContaining({
        href: `images/figure-00${index}.${extension}`, 'media-type': mediaType
      }));
    }
    await Promise.all([parseXml(first), parseXml(second)]);
  });

  it('regenerates when figure bytes change despite preserved timestamps', async () => {
    const asset = path.join(fixtureRoot, 'src/content/books/illustrated-book/source-assets/diagram.png');
    const before = await stat(asset);
    const epubPath = path.join(fixtureRoot, 'public/downloads/illustrated-book.epub');
    const original = await readFile(epubPath);
    const updated = Buffer.concat([pngFigure, Buffer.from('original figure metadata')]);
    await writeFile(asset, updated);
    await utimes(asset, before.atime, before.mtime);
    generateAt(fixtureRoot);
    const epub = await readFile(epubPath);
    expect(epub).not.toEqual(original);
    expect(new AdmZip(epub).readFile('OEBPS/images/figure-001.png')).toEqual(updated);
    const generationTime = (await stat(epubPath)).mtimeMs;
    generateAt(fixtureRoot);
    expect((await stat(epubPath)).mtimeMs).toBe(generationTime);
  });

  it('does not reuse a cached EPUB after a referenced original asset disappears', async () => {
    const asset = path.join(fixtureRoot, 'src/content/books/illustrated-book/source-assets/map.jpg');
    await rm(asset);
    try { expect(() => generateAt(fixtureRoot)).toThrow(); }
    finally { await writeFile(asset, jpegFigure); }
  });

  it.each(['../outside.png', 'source-assets/%2e%2e/%2e%2e/outside.png', '/tmp/image.png',
    'https://example.com/image.png', '//example.com/image.png', 'data:image/png;base64,AAAA',
    'source-assets/missing.png', 'source-assets/escape.png'])('rejects missing, remote, or escaping image %s', async reference => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'epub-unsafe-image-'));
    try {
      const book = path.join(root, 'src/content/books/unsafe');
      await mkdir(path.join(book, 'source-assets'), { recursive: true });
      await writeFile(path.join(root, 'outside.png'), pngFigure);
      await symlink(path.join(root, 'outside.png'), path.join(book, 'source-assets/escape.png'));
      await writeFile(path.join(book, 'index.md'), `---\ntitle: Unsafe\nauthor: Fixture\n---\n## Figure\n\n![Figure](${reference})\n`);
      expect(() => generateAt(root)).toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects unsafe package paths and external or active SVG content', async () => {
    expect(() => createEpub({ title: 'Unsafe', author: 'Fixture', chapters: [{ title: 'C', html: '' }],
      images: [{ href: '../escape.png', data: pngFigure, mediaType: 'image/png' }] })).toThrow('Unsafe');
    for (const body of ['<image href="https://example.com/figure.png"/>', '<script>alert(1)</script>',
      '<rect onclick="alert(1)"/>', '<style>rect { fill: url(https://example.com/image); }</style>',
      '<style onload="void 0">rect { fill: black; }</style>',
      '<s:style xmlns:s="http://www.w3.org/2000/svg">@import "https://example.com/style.css";</s:style>']) {
      await expect(detectInlineImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`))).rejects.toThrow();
    }
  });

  it('renders Common Sense naval costs as a semantic table with every cell and total preserved', async () => {
    const zip = new AdmZip(await readFile(path.join(fixtureRoot, 'public/downloads/naval-costs.epub')));
    const chapter = zip.readAsText('OEBPS/text/chapter-001.xhtml');
    const parsed = await parseXml(chapter);
    const table = parsed.html.body[0].section[0].table[0];
    expect(table.thead[0].tr[0].th).toEqual(['Ships', 'Guns', 'Cost of one (£)', 'Cost of all (£)']);
    const cellText = (cell: string | { strong: string[] }) => typeof cell === 'string' ? cell : cell.strong[0];
    expect(table.tbody[0].tr.map((row: { td: Array<string | { strong: string[] }> }) => row.td.map(cellText))).toEqual([
      ['6', '100', '35,553', '213,318'], ['12', '90', '29,886', '358,632'],
      ['12', '80', '23,638', '283,656'], ['43', '70', '17,785', '764,755'],
      ['35', '60', '14,197', '496,895'], ['40', '50', '10,606', '424,240'],
      ['45', '40', '7,558', '340,110'], ['58', '20', '3,710', '215,180'],
      ['85', 'Sloops, bombs, and fireships, averaged', '2,000', '170,000'],
      ['Cost of ships', '', '', '3,266,786'], ['Remaining for guns', '', '', '233,214'],
      ['Total', '', '', '3,500,000']
    ]);
    expect(chapter).not.toContain('| --- |');
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
