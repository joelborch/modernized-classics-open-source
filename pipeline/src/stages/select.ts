import { z } from 'zod';
import { completeStructured, loadPrompt, usageFromError } from '../model.js';
import { SETTINGS } from '../config.js';
import { chunkChapters, type Chapter } from '../chunk.js';
import type { SpineItem } from '../epub.js';
import { Workspace, markDone, addStageUsage, type BookState } from '../state.js';

const SelectionSchema = z.object({
  include: z.array(
    z.object({
      id: z.string().describe('Manifest id exactly as shown in the catalogue'),
      title: z.string().describe('Chapter title, or empty string when not confidently known'),
    }),
  ),
  reasoning: z.string(),
});
export type Selection = z.infer<typeof SelectionSchema>;

const BACKMATTER = /^(index|references|further reading|bibliography|appendix|notes?|glossary)\b/i;

/**
 * Ask the model which spine items are the author's work, then cut the chosen
 * chapters into rewrite chunks. A human can edit selection.json and re-run
 * with --from select to override the model.
 */
export async function select(ws: Workspace, state: BookState, opts: { reuseSelection: boolean }): Promise<void> {
  const items = await ws.readJson<SpineItem[]>('items.json');
  let selection = opts.reuseSelection ? await ws.readJson<Selection>('selection.json').catch(() => null) : null;

  if (!selection) {
    const catalogue = (await ws.readText('catalogue.txt'))!;
    console.log(`[select] asking ${SETTINGS.effort.select}-effort model to choose chapters...`);
    try {
      const { data, usage } = await completeStructured({
        system: await loadPrompt('selection'),
        user: catalogue,
        effort: SETTINGS.effort.select,
        schema: SelectionSchema,
      });
      selection = data;
      addStageUsage(state, 'select', usage);
    } catch (error) {
      const usage = usageFromError(error);
      if (usage) addStageUsage(state, 'select', usage);
      await ws.save(state);
      throw error;
    }
    // Record a billable response before accepting its resumable artifact.
    await ws.save(state);
    await ws.writeJson('selection.json', selection);
    console.log(`[select] ${selection.include.length} item(s) chosen. ${selection.reasoning}`);
  } else {
    console.log(`[select] using existing selection.json (${selection.include.length} items)`);
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const chapters: Chapter[] = [];
  for (const sel of selection.include) {
    const item = byId.get(sel.id);
    if (!item) {
      console.warn(`[select] id "${sel.id}" not in manifest; skipping`);
      continue;
    }
    const title = sel.title?.trim() || item.title || '';
    if (BACKMATTER.test(title)) {
      console.warn(`[select] skipping "${title}" (looks like back matter)`);
      continue;
    }
    if (item.text.length < 50) {
      console.warn(`[select] skipping ${sel.id}: only ${item.text.length} chars`);
      continue;
    }
    chapters.push({ index: chapters.length + 1, id: item.id, title: title || `Section ${chapters.length + 1}`, text: item.text });
  }
  if (!chapters.length) throw new Error('Selection produced no usable chapters. Inspect selection.json.');

  const chunks = chunkChapters(chapters, {
    chunkChars: SETTINGS.chunkChars,
    prevChars: SETTINGS.contextPrevChars,
    nextChars: SETTINGS.contextNextChars,
  });
  await ws.writeJson('chapters.json', chapters);
  await ws.writeJson('chunks.json', chunks);
  state.chunks = Object.fromEntries(
    chunks.map((c) => [c.id, state.chunks[c.id] ?? { rewritten: false, revisions: 0 }]),
  );
  const totalChars = chapters.reduce((n, c) => n + c.text.length, 0);
  console.log(`[select] ${chapters.length} chapter(s), ${chunks.length} chunk(s), ${totalChars.toLocaleString()} chars`);
  chapters.forEach((c) => console.log(`  ${String(c.index).padStart(2)}. ${c.title} (${c.text.length.toLocaleString()})`));
  markDone(state, 'select');
  await ws.save(state);
}
