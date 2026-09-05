import fs from 'node:fs/promises';
import { readEpub, buildCatalogue, type SpineItem } from '../epub.js';
import { SETTINGS } from '../config.js';
import { Workspace, markDone, type BookState } from '../state.js';

/** Copy the EPUB into the workspace, parse it, and write the catalogue. */
export async function extract(ws: Workspace, state: BookState): Promise<void> {
  const src = ws.file('source.epub');
  try {
    await fs.access(src);
  } catch {
    await fs.copyFile(state.sourceEpub, src);
  }
  const book = await readEpub(src);
  state.title ||= book.title;
  state.author ||= book.author;

  const items: SpineItem[] = book.items;
  await ws.writeJson('items.json', items);
  await ws.writeText('catalogue.txt', buildCatalogue(book, SETTINGS.previewChars));
  console.log(`[extract] ${items.length} spine item(s), ${items.reduce((n, i) => n + i.text.length, 0).toLocaleString()} chars`);
  markDone(state, 'extract');
  await ws.save(state);
}
