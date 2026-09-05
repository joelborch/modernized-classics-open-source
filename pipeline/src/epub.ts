/**
 * EPUB reading: spine/manifest parsing, nav titles, text extraction,
 * and reassembly of `_split_NN` files that some converters produce.
 */
import path from 'node:path';
import AdmZip from 'adm-zip';
import { parseStringPromise as parseXml } from 'xml2js';
import { parse as parseHtml, HTMLElement } from 'node-html-parser';

export interface SpineItem {
  /** Manifest id of the first file in this item. */
  id: string;
  href: string;
  /** Title detected from headings/nav, if any. */
  title: string | null;
  /** Plain text with paragraph breaks preserved as blank lines. */
  text: string;
  /** All manifest ids merged into this item (for _split_ sequences). */
  ids: string[];
  /** Whether the nav document references this item (a weak "is a real section" signal). */
  inNav: boolean;
}

export interface EpubBook {
  title: string;
  author: string;
  items: SpineItem[];
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

/** Keep paragraph gaps, collapse all other whitespace. */
export function cleanText(s: string): string {
  return s
    .replace(/\r?\n[ \t]*\r?\n/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectTitle(root: HTMLElement): string | null {
  const h = root.querySelector('h1,h2,h3,h4,h5,h6');
  if (h) return cleanText(h.innerText) || null;
  const ct = root.querySelector('.ct');
  const cn = root.querySelector('.cn');
  if (ct && cn) return `${cleanText(cn.innerText)} ${cleanText(ct.innerText)}`;
  if (ct) return cleanText(ct.innerText) || null;
  if (cn) return cleanText(cn.innerText) || null;
  return null;
}

/** Extract readable text from an XHTML document, paragraph-aware. */
function extractText(root: HTMLElement): string {
  root.querySelectorAll('script,style,head').forEach((el) => el.remove());
  const body = root.querySelector('body') ?? root;
  // structuredText separates block elements with single newlines; promote
  // those to paragraph gaps so chunking and the model see real paragraphs.
  const structured = body.structuredText.replace(/[ \t]*\n[ \t]*/g, '\n\n');
  return cleanText(structured);
}

export async function readEpub(epubPath: string): Promise<EpubBook> {
  const zip = new AdmZip(epubPath);
  const container = await parseXml(zip.readAsText('META-INF/container.xml'));
  const opfPath: string = container.container.rootfiles[0].rootfile[0].$['full-path'];
  const opfDir = path.posix.dirname(opfPath);
  const opf = await parseXml(zip.readAsText(opfPath));

  const meta = opf.package.metadata?.[0] ?? {};
  const title = textOf(meta['dc:title']) || path.basename(epubPath, '.epub');
  const author = textOf(meta['dc:creator']) || 'Unknown';

  const manifest: ManifestItem[] = (opf.package.manifest[0].item as any[]).map((i) => ({
    id: i.$.id,
    href: i.$.href,
    mediaType: i.$['media-type'] ?? '',
    properties: i.$.properties ?? '',
  }));
  const byId = new Map(manifest.map((m) => [m.id, m]));
  const byHref = new Map(manifest.map((m) => [m.href, m]));
  const spineIds: string[] = opf.package.spine[0].itemref.map((n: any) => n.$.idref);

  const resolve = (href: string) => path.posix.normalize(path.posix.join(opfDir, href));
  const readDoc = (href: string) => parseHtml(zip.readAsText(resolve(href)));

  // Nav titles (EPUB3 nav doc, falling back to NCX).
  const navTitles = new Map<string, string>();
  const navItem = manifest.find((m) => m.properties.includes('nav'));
  if (navItem) {
    const nav = readDoc(navItem.href);
    nav.querySelectorAll('nav a').forEach((a) => {
      const href = a.getAttribute('href')?.split('#')[0];
      const t = cleanText(a.textContent ?? '');
      if (href && t && !navTitles.has(href)) navTitles.set(href, t);
    });
  } else {
    const ncx = manifest.find((m) => m.mediaType === 'application/x-dtbncx+xml');
    if (ncx) {
      try {
        const doc = await parseXml(zip.readAsText(resolve(ncx.href)));
        const walk = (pts: any[]) =>
          pts?.forEach((p) => {
            const href = p.content?.[0]?.$?.src?.split('#')[0];
            const t = cleanText(p.navLabel?.[0]?.text?.[0] ?? '');
            if (href && t && !navTitles.has(href)) navTitles.set(href, t);
            if (p.navPoint) walk(p.navPoint);
          });
        walk(doc?.ncx?.navMap?.[0]?.navPoint ?? []);
      } catch {
        /* NCX is optional; ignore malformed files */
      }
    }
  }

  // Walk the spine, merging `_split_NN` sequences into one item.
  const items: SpineItem[] = [];
  const consumed = new Set<string>();
  for (const id of spineIds) {
    if (consumed.has(id)) continue;
    const m = byId.get(id);
    if (!m) continue;
    const group = splitGroup(m, manifest);
    const ids = group.map((g) => g.id);
    ids.forEach((g) => consumed.add(g));

    let title: string | null = null;
    const texts: string[] = [];
    for (const g of group) {
      let doc: HTMLElement;
      try {
        doc = readDoc(g.href);
      } catch {
        continue;
      }
      if (!title) title = detectTitle(doc);
      const t = extractText(doc);
      if (t) texts.push(t);
    }
    const navTitle = group.map((g) => navTitles.get(g.href)).find(Boolean) ?? null;
    items.push({
      id,
      href: m.href,
      title: navTitle ?? title,
      text: texts.join('\n\n'),
      ids,
      inNav: group.some((g) => navTitles.has(g.href)),
    });
  }
  // Silence unused-variable lint for byHref in case callers want href lookups later.
  void byHref;
  return { title, author, items };
}

/** Return the ordered `_split_NN` siblings of a manifest item (or just the item). */
function splitGroup(item: ManifestItem, manifest: ManifestItem[]): ManifestItem[] {
  const ext = path.posix.extname(item.href);
  const base = path.posix.basename(item.href, ext);
  const m = base.match(/^(.*)_split_(\d+)$/);
  if (!m) return [item];
  const prefix = m[1];
  const dir = path.posix.dirname(item.href);
  const re = new RegExp(`^${escapeRe(prefix)}_split_(\\d+)${escapeRe(ext)}$`);
  const siblings = manifest
    .filter((x) => path.posix.dirname(x.href) === dir && re.test(path.posix.basename(x.href)))
    .map((x) => ({ x, n: Number(path.posix.basename(x.href).match(re)![1]) }))
    .sort((a, b) => a.n - b.n)
    .map((s) => s.x);
  return siblings.length ? siblings : [item];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textOf(node: any): string {
  if (!node) return '';
  const first = Array.isArray(node) ? node[0] : node;
  if (typeof first === 'string') return first.trim();
  if (first && typeof first._ === 'string') return first._.trim();
  return '';
}

/** Human/LLM-readable catalogue of every spine item, for the selection stage. */
export function buildCatalogue(book: EpubBook, previewChars: number): string {
  const lines = [`Book: ${book.title}`, `Author: ${book.author}`, `Items: ${book.items.length}`, ''];
  book.items.forEach((it, i) => {
    lines.push(`--- Item ${i + 1} ---`);
    lines.push(`ID: ${it.id}`);
    lines.push(`Href: ${it.href}`);
    if (it.title) lines.push(`Title: ${it.title}`);
    lines.push(`Chars: ${it.text.length}${it.ids.length > 1 ? ` (merged from ${it.ids.length} split files)` : ''}`);
    lines.push(`Preview: ${it.text.slice(0, previewChars).replace(/\n+/g, ' ')}`);
    lines.push('');
  });
  return lines.join('\n');
}
