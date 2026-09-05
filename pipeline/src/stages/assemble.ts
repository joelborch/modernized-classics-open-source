import type { Chunk } from '../chunk.js';
import { Workspace, markDone, type BookState } from '../state.js';

const INTERNAL_ID_HEADING = /^#{1,6}\s+(BODY|CHAP|PART|SECTION|TEXT|ITEM|id|x|part)[_\s]?\d+\s*$/i;
const META_LINE = /^\s*(here'?s|here is|here are|below is|below are|in this rewrite|this rewrite|the rewrite|note:|comment:|explanation:)/i;

/** Stitch chunk rewrites into one Markdown document in reading order. */
export async function assemble(ws: Workspace, state: BookState): Promise<string> {
  const chunks = await ws.readJson<Chunk[]>('chunks.json');
  const parts: string[] = [];
  let lastChapter = -1;
  for (const c of chunks) {
    let text = ((await ws.readText('rewrites', `${c.id}.md`)) ?? '').trim();
    if (!text) throw new Error(`Missing rewrite for ${c.id}; run the rewrite stage first.`);

    text = text
      .split('\n')
      .filter((line) => !INTERNAL_ID_HEADING.test(line) && !META_LINE.test(line))
      .join('\n')
      .trim();

    // Guarantee exactly one chapter heading per chapter, even if the model dropped or duplicated it.
    const heading = `## ${c.chapterTitle}`;
    if (c.chapterIndex !== lastChapter) {
      if (!text.startsWith('## ')) text = `${heading}\n\n${text}`;
      lastChapter = c.chapterIndex;
    } else if (text.startsWith('## ')) {
      text = text.replace(/^## [^\n]*\n+/, '');
    }
    parts.push(text.trim());
  }
  const book = parts.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
  await ws.writeText('book.md', book);
  console.log(`[assemble] book.md: ${book.length.toLocaleString()} chars, ${book.split(/\s+/).length.toLocaleString()} words`);
  markDone(state, 'assemble');
  await ws.save(state);
  return book;
}
