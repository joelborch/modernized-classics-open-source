import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import { createEpub, detectCover } from './epub-package.js';

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

// Parse markdown to HTML using remark
async function markdownToHtml(md: string): Promise<string> {
  const result = await remark()
    .use(html)
    .process(md);
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
    
    // Check for chapter headers
    if (line.match(/^#{2,3}\s+/)) {
      // Save previous chapter if it has content
      if (currentChapter.content.length > 0 || foundFirstChapter) {
        const chapterContent = currentChapter.content.join('\n');
        if (chapterContent.trim()) {
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
  if (currentChapter.content.length > 0) {
    const chapterContent = currentChapter.content.join('\n');
    if (chapterContent.trim()) {
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
  const generatorInputStats = await Promise.all([
    fs.stat(generatorSourcePath),
    fs.stat(epubPackageSourcePath)
  ]);
  const generatorInputMtimeMs = Math.max(...generatorInputStats.map(stat => stat.mtimeMs));
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
    const coverStat = hasCover ? await fs.stat(coverPath).catch(() => null) : null;

    // Check if epub and txt exist and are up to date
    const epubStat = await fs.stat(epubPath).catch(() => null);
    const txtStat = await fs.stat(txtPath).catch(() => null);
    const coverNewerThanEpub = !!(coverStat && epubStat && coverStat.mtimeMs > epubStat.mtimeMs);
    const indexNewerThanEpub = !!(epubStat && indexStat.mtimeMs > epubStat.mtimeMs);
    const generatorNewerThanEpub = !!(epubStat && generatorInputMtimeMs > epubStat.mtimeMs);
    const shouldGenerate =
      !epubStat || !txtStat || coverNewerThanEpub || indexNewerThanEpub || generatorNewerThanEpub;
    if (!shouldGenerate) {
      // Skip when outputs exist and sources haven't changed.
      continue;
    }

    console.log(`Generating EPUB for: ${data.title || slug} (${epubName})`);
    
    // Extract chapters from the markdown content
    const chapters = extractChapters(content, data.title || slug);
    
    // Convert each chapter's markdown to HTML
    const epubChapters = await Promise.all(
      chapters.map(async (chapter) => ({
        title: chapter.title,
        data: await markdownToHtml(chapter.data)
      }))
    );
    
    const cover = hasCover ? detectCover(await fs.readFile(coverPath)) : undefined;
    const epub = createEpub({
      title: data.title || 'Untitled Book',
      author: data.author || 'Unknown Author',
      publisher: 'Modernized Books',
      chapters: epubChapters.map(chapter => ({ title: chapter.title, html: chapter.data })),
      tocTitle: 'Table of Contents',
      cover,
      description: data.description,
      publicationYear: data.yearPublished ? String(data.yearPublished) : undefined,
      modifiedYear: data.yearModernized ? String(data.yearModernized) : undefined
    });

    await fs.writeFile(epubPath, epub);
    await fs.writeFile(txtPath, content);
    
    console.log(`Generated: ${epubName}`);
  }
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
