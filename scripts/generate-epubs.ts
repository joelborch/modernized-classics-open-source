import { promises as fs } from 'fs';
import { createHash } from 'node:crypto';
import type { Definition, Image, Root, RootContent } from 'mdast';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import gfm from 'remark-gfm';
import { createEpub, detectCover, detectInlineImage, type EpubImage } from './epub-package.js';

const generatorSourcePath = fileURLToPath(import.meta.url);
const epubPackageSourcePath = fileURLToPath(new URL('./epub-package.ts', import.meta.url));

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function visitNodes(node: Root | RootContent, visit: (node: RootContent) => void): void {
  if (node.type !== 'root') visit(node);
  if ('children' in node) for (const child of node.children) visitNodes(child, visit);
}

async function inlineImages(content: string, bookDir: string) {
  const tree = remark().use(gfm).parse(content);
  const definitions = new Map<string, Definition>();
  visitNodes(tree, node => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node);
  });
  const urls = new Set<string>();
  visitNodes(tree, node => {
    if (node.type === 'image') urls.add(node.url);
    if (node.type === 'imageReference') {
      const definition = definitions.get(node.identifier);
      if (!definition) throw new Error(`Unresolved image reference: ${node.identifier}`);
      urls.add(definition.url);
    }
    // Raw HTML is stripped by remark-html; fail rather than silently lose an authored figure.
    if (node.type === 'html' && /<(?:img|svg)\b/i.test(node.value)) {
      throw new Error('Use Markdown image syntax for inline book figures');
    }
  });
  const root = await fs.realpath(bookDir);
  const images: EpubImage[] = [];
  const references = new Map<string, string>();
  for (const url of urls) {
    const decoded = decodeURIComponent(url);
    const parts = decoded.split('/');
    if (!decoded || /[\\?#\x00-\x1f]/.test(decoded) || decoded.startsWith('/') ||
      /^[a-z][a-z0-9+.-]*:/i.test(decoded) || parts.some(part => !part || part === '..')) {
      throw new Error(`Inline image must be a local path inside its book: ${url}`);
    }
    const file = await fs.realpath(path.resolve(bookDir, decoded));
    if (!file.startsWith(root + path.sep)) throw new Error(`Inline image escapes its book: ${url}`);
    const data = await fs.readFile(file);
    const mediaType = await detectInlineImage(data);
    const extension = mediaType === 'image/png' ? 'png' : mediaType === 'image/jpeg' ? 'jpg' : 'svg';
    const href = `images/figure-${String(images.length + 1).padStart(3, '0')}.${extension}`;
    images.push({ href, data, mediaType });
    references.set(url, `../${href}`);
  }
  return { images, references, definitions, definitionMarkdown: remark().use(gfm).stringify({ type: 'root', children: [...definitions.values()] }) };
}

// Resolve image references across the full book, then render individual chapters.
async function markdownToHtml(md: string, assets: Awaited<ReturnType<typeof inlineImages>>): Promise<string> {
  const result = await remark().use(gfm).use(() => (tree: Root) => {
    visitNodes(tree, node => {
      if (node.type !== 'image' && node.type !== 'imageReference') return;
      const definition = node.type === 'imageReference' ? assets.definitions.get(node.identifier) : undefined;
      const url = node.type === 'image' ? node.url : definition?.url;
      const href = url && assets.references.get(url);
      if (!href) throw new Error('Inline image was not resolved before EPUB generation');
      const image: Image = { type: 'image', alt: node.alt, title: node.type === 'image' ? node.title : definition?.title, url: href };
      Object.assign(node, image);
    });
  }).use(html).process(`${md}\n\n${assets.definitionMarkdown}`);
  return String(result);
}

// Extract chapters from markdown content
function extractChapters(content: string, bookTitle: string): Array<{title: string, data: string}> {
  const chapters: Array<{title: string, data: string}> = [];
  
  // Split by chapter headers (## or ###)
  const lines = content.split('\n');
  let currentChapter = { title: 'Introduction', content: [] as string[] };
  let foundFirstChapter = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // An opening source-level title can name the first essay. Use it once as
    // the chapter heading and navigation label rather than inventing Introduction.
    if (!foundFirstChapter && currentChapter.content.every(part => !part.trim()) && /^#\s+/.test(line)) {
      currentChapter = { title: line.replace(/^#\s+/, '').trim(), content: [] };
      foundFirstChapter = true;
      continue;
    }
    
    // Check for chapter headers
    if (line.match(/^#{2,3}\s+/)) {
      // Keep authored group headings even when the next heading follows immediately.
      if (currentChapter.content.length > 0 || foundFirstChapter) {
        const chapterContent = currentChapter.content.join('\n');
        if (chapterContent.trim() || foundFirstChapter) {
          chapters.push({
            title: currentChapter.title,
            data: chapterContent
          });
        }
      }
      
      // Start new chapter
      foundFirstChapter = true;
      currentChapter = {
        title: line.replace(/^#{2,3}\s+/, '').trim(),
        content: []
      };
    } else {
      currentChapter.content.push(line);
    }
  }
  
  // Don't forget the last chapter
  if (currentChapter.content.length > 0 || foundFirstChapter) {
    const chapterContent = currentChapter.content.join('\n');
    if (chapterContent.trim() || foundFirstChapter) {
      chapters.push({
        title: currentChapter.title,
        data: chapterContent
      });
    }
  }
  
  // If no chapters were found, return the entire content as one chapter
  if (chapters.length === 0) {
    chapters.push({
      title: bookTitle,
      data: content
    });
  }
  
  return chapters;
}

async function generate() {
  const booksRoot = path.join(process.cwd(), 'src/content/books');
  const downloadDir = path.join(process.cwd(), 'public/downloads');
  const txtDir = path.join(process.cwd(), 'build-txt');
  await fs.mkdir(downloadDir, { recursive: true });
  await fs.mkdir(txtDir, { recursive: true });
  const generatorInputs = await Promise.all([
    fs.readFile(generatorSourcePath), fs.readFile(epubPackageSourcePath)
  ]);
  const folders = await fs.readdir(booksRoot);

  for (const folder of folders) {
    const bookDir = path.join(booksRoot, folder);
    const bookDirStat = await fs.stat(bookDir).catch(() => null);
    if (!bookDirStat || !bookDirStat.isDirectory()) continue;

    const indexPath = path.join(bookDir, 'index.md');
    const indexStat = await fs.stat(indexPath).catch(() => null);
    if (!indexStat) continue;

    const raw = await fs.readFile(indexPath, 'utf8');
    const { data, content } = matter(raw);

    // Canonical slug is the book folder name
    const slug = folder;
    const epubName = `${slug}.epub`;
    const epubPath = path.join(downloadDir, epubName);
    const txtPath = path.join(txtDir, `${slug}.txt`);

    const coverPath = path.join(bookDir, 'cover.png');
    const hasCover = await fileExists(coverPath);
    const cover = hasCover ? detectCover(await fs.readFile(coverPath)) : undefined;
    const assets = await inlineImages(content, bookDir);
    // Content hashes detect asset replacement/deletion even when mtimes are preserved.
    const fingerprint = createHash('sha256').update(raw);
    for (const input of generatorInputs) fingerprint.update(input);
    if (cover) fingerprint.update(cover.data);
    for (const image of assets.images) fingerprint.update(image.href).update(image.mediaType).update(image.data);
    const inputHash = fingerprint.digest('hex');
    const cachePath = path.join(downloadDir, `${slug}.inputs.sha256`);
    const previousHash = await fs.readFile(cachePath, 'utf8').catch(() => null);
    if (previousHash === inputHash && await fileExists(epubPath) && await fileExists(txtPath)) continue;

    console.log(`Generating EPUB for: ${data.title || slug} (${epubName})`);
    
    // Extract chapters from the markdown content
    const chapters = extractChapters(content, data.title || slug);
    
    // Convert each chapter's markdown to HTML
    const epubChapters = await Promise.all(
      chapters.map(async (chapter) => ({
        title: chapter.title,
        data: await markdownToHtml(chapter.data, assets)
      }))
    );
    
    const epub = createEpub({
      title: data.title || 'Untitled Book',
      author: data.author || 'Unknown Author',
      publisher: 'Modernized Books',
      chapters: epubChapters.map(chapter => ({ title: chapter.title, html: chapter.data })),
      tocTitle: 'Table of Contents',
      cover,
      images: assets.images,
      description: data.description,
      publicationYear: data.yearPublished ? String(data.yearPublished) : undefined,
      modifiedYear: data.yearModernized ? String(data.yearModernized) : undefined
    });

    await fs.writeFile(epubPath, epub);
    await fs.writeFile(txtPath, content);
    await fs.writeFile(cachePath, inputHash);
    
    console.log(`Generated: ${epubName}`);
  }
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
