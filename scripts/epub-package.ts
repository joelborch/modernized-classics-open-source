import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';

export const EPUB_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const EPUB_RIGHTS =
  'To the extent Modernized Classics holds copyright or related rights in this modern-English adaptation, those rights are licensed under CC BY 4.0. No rights are claimed in underlying public-domain source text or third-party material.';

export interface EpubChapter {
  title: string;
  html: string;
  includeInToc?: boolean;
}

export interface EpubCover {
  data: Buffer;
  mediaType: 'image/jpeg' | 'image/png';
}

export interface EpubPackageOptions {
  title: string;
  author: string;
  chapters: EpubChapter[];
  cover?: EpubCover;
  description?: string;
  language?: string;
  publicationYear?: string;
  modifiedYear?: string;
  publisher?: string;
  tocTitle?: string;
}

const ZIP_TIMESTAMP = new Date(2000, 0, 1, 0, 0, 0);
const XHTML_MEDIA_TYPE = 'application/xhtml+xml';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeXhtmlFragment(html: string): string {
  return html.replace(
    /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\b[^>]*)>/gi,
    (tag, name: string, attributes: string) =>
      attributes.trimEnd().endsWith('/') ? tag : `<${name}${attributes} />`
  );
}

function addEntry(zip: AdmZip, name: string, data: Buffer | string, stored = false): void {
  const entry = zip.addFile(name, Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'));
  entry.header.time = ZIP_TIMESTAMP;
  if (stored) entry.header.method = 0;
}

function stableIdentifier(options: EpubPackageOptions): string {
  const coverHash = options.cover
    ? createHash('sha256').update(options.cover.data).digest('hex')
    : null;
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        title: options.title,
        author: options.author,
        chapters: options.chapters,
        coverHash,
        description: options.description,
        language: options.language,
        publicationYear: options.publicationYear,
        modifiedYear: options.modifiedYear,
        publisher: options.publisher,
        tocTitle: options.tocTitle
      })
    )
    .digest('hex');
  return `urn:sha256:${digest}`;
}

function chapterDocument(title: string, html: string, language: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="../style.css" />
</head>
<body>
  <section epub:type="chapter">
    <h1>${escapeXml(title)}</h1>
${normalizeXhtmlFragment(html)}
  </section>
</body>
</html>
`;
}

function navigationDocument(options: EpubPackageOptions, language: string): string {
  const tocItems = options.chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => chapter.includeInToc !== false)
    .map(
      ({ chapter, index }) =>
        `      <li><a href="text/chapter-${String(index + 1).padStart(3, '0')}.xhtml">${escapeXml(chapter.title)}</a></li>`
    )
    .join('\n');
  const coverLandmark = options.cover
    ? '      <li><a epub:type="cover" href="cover.xhtml">Cover</a></li>\n'
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(options.tocTitle ?? 'Table of Contents')}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(options.tocTitle ?? 'Table of Contents')}</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
  <nav epub:type="landmarks" hidden="hidden">
    <ol>
${coverLandmark}      <li><a epub:type="bodymatter" href="text/chapter-001.xhtml">Start reading</a></li>
    </ol>
  </nav>
</body>
</html>
`;
}

function ncxDocument(options: EpubPackageOptions, identifier: string, language: string): string {
  const navPoints = options.chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => chapter.includeInToc !== false)
    .map(
      ({ chapter, index }, navIndex) => `    <navPoint id="nav-${navIndex + 1}" playOrder="${navIndex + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="text/chapter-${String(index + 1).padStart(3, '0')}.xhtml" />
    </navPoint>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(language)}">
  <head>
    <meta name="dtb:uid" content="${identifier}" />
    <meta name="dtb:depth" content="1" />
    <meta name="dtb:totalPageCount" content="0" />
    <meta name="dtb:maxPageNumber" content="0" />
  </head>
  <docTitle><text>${escapeXml(options.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`;
}

function coverDocument(options: EpubPackageOptions, extension: string, language: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8" />
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body class="cover-page" epub:type="cover">
  <img src="cover.${extension}" alt="Cover for ${escapeXml(options.title)}" />
</body>
</html>
`;
}

function packageDocument(options: EpubPackageOptions, identifier: string, language: string): string {
  const publisher = options.publisher ?? 'Modernized Books';
  const modifiedYear = options.modifiedYear ?? '2025';
  const coverManifest = options.cover
    ? `    <item id="cover-image" href="cover.${options.cover.mediaType === 'image/png' ? 'png' : 'jpg'}" media-type="${options.cover.mediaType}" properties="cover-image" />
    <item id="cover-page" href="cover.xhtml" media-type="${XHTML_MEDIA_TYPE}" />\n`
    : '';
  const chapterManifest = options.chapters
    .map(
      (_, index) =>
        `    <item id="chapter-${index + 1}" href="text/chapter-${String(index + 1).padStart(3, '0')}.xhtml" media-type="${XHTML_MEDIA_TYPE}" />`
    )
    .join('\n');
  const coverSpine = options.cover ? '    <itemref idref="cover-page" linear="no" />\n' : '';
  const chapterSpine = options.chapters
    .map((_, index) => `    <itemref idref="chapter-${index + 1}" />`)
    .join('\n');
  const description = options.description
    ? `    <dc:description>${escapeXml(options.description)}</dc:description>\n`
    : '';
  const publicationYear = options.publicationYear
    ? `    <dc:date>${escapeXml(options.publicationYear)}</dc:date>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(language)}" prefix="dcterms: http://purl.org/dc/terms/">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${identifier}</dc:identifier>
    <dc:title>${escapeXml(options.title)}</dc:title>
    <dc:creator>${escapeXml(options.author)}</dc:creator>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:publisher>${escapeXml(publisher)}</dc:publisher>
${description}${publicationYear}    <meta property="dcterms:modified">${escapeXml(modifiedYear)}-01-01T00:00:00Z</meta>
    <meta property="dcterms:rights">${escapeXml(EPUB_RIGHTS)}</meta>
    <dc:rights>${escapeXml(EPUB_RIGHTS)}</dc:rights>
    <link rel="license" href="${EPUB_LICENSE_URL}" />
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="${XHTML_MEDIA_TYPE}" properties="nav" />
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
    <item id="style" href="style.css" media-type="text/css" />
${coverManifest}${chapterManifest}
  </manifest>
  <spine toc="ncx">
${coverSpine}${chapterSpine}
  </spine>
</package>
`;
}

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`;

const stylesheet = `body { font-family: serif; line-height: 1.5; margin: 5%; }
h1 { break-before: page; font-size: 1.6em; }
nav ol { padding-left: 1.5em; }
.cover-page { margin: 0; text-align: center; }
.cover-page img { height: auto; max-height: 100%; max-width: 100%; }
`;

export function detectCover(data: Buffer): EpubCover {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { data, mediaType: 'image/png' };
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { data, mediaType: 'image/jpeg' };
  }
  throw new Error('Unsupported cover image type; expected PNG or JPEG data');
}

export function createEpub(options: EpubPackageOptions): Buffer {
  if (options.chapters.length === 0) throw new Error('An EPUB requires at least one chapter');

  const language = options.language ?? 'en';
  const identifier = stableIdentifier(options);
  const zip = new AdmZip(undefined, { noSort: true });

  addEntry(zip, 'mimetype', 'application/epub+zip', true);
  addEntry(zip, 'META-INF/container.xml', containerXml);
  addEntry(zip, 'OEBPS/content.opf', packageDocument(options, identifier, language));
  addEntry(zip, 'OEBPS/nav.xhtml', navigationDocument(options, language));
  addEntry(zip, 'OEBPS/toc.ncx', ncxDocument(options, identifier, language));
  addEntry(zip, 'OEBPS/style.css', stylesheet);

  if (options.cover) {
    const extension = options.cover.mediaType === 'image/png' ? 'png' : 'jpg';
    addEntry(zip, `OEBPS/cover.${extension}`, options.cover.data);
    addEntry(zip, 'OEBPS/cover.xhtml', coverDocument(options, extension, language));
  }

  options.chapters.forEach((chapter, index) => {
    addEntry(
      zip,
      `OEBPS/text/chapter-${String(index + 1).padStart(3, '0')}.xhtml`,
      chapterDocument(chapter.title, chapter.html, language)
    );
  });

  return zip.toBuffer();
}
