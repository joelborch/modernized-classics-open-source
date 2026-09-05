import { completeText, loadPrompt, pool, usageFromError } from '../model.js';
import { SETTINGS } from '../config.js';
import type { Chunk } from '../chunk.js';
import { Workspace, markDone, addStageUsage, type BookState } from '../state.js';

export function rewriteUserMessage(chunk: Chunk): string {
  const heading = chunk.part === 1 ? `## ${chunk.chapterTitle}\n\n` : '';
  return [
    `Passage: "${chunk.chapterTitle}" (part ${chunk.part} of ${chunk.partCount})`,
    'Notice: This passage is a continuous excerpt. Do not add standalone introductions or concluding summaries.',
    '',
    '<previous_context>',
    chunk.prevContext || '(start of chapter/book)',
    '</previous_context>',
    '',
    '<next_context>',
    chunk.nextContext || '(end of chapter/book)',
    '</next_context>',
    '',
    '<passage>',
    heading + chunk.text,
    '</passage>',
  ].join('\n');
}

/** Rewrite every chunk that doesn't have output yet, `concurrency` at a time. */
export async function rewrite(ws: Workspace, state: BookState, opts: { concurrency: number }): Promise<void> {
  const chunks = await ws.readJson<Chunk[]>('chunks.json');
  const system = await loadPrompt('rewrite');
  const pending: Chunk[] = [];
  for (const c of chunks) {
    const existing = await ws.readText('rewrites', `${c.id}.md`);
    if (existing && existing.trim().length > 60) {
      state.chunks[c.id] = { ...state.chunks[c.id], rewritten: true, revisions: state.chunks[c.id]?.revisions ?? 0 };
    } else {
      pending.push(c);
    }
  }
  if (!pending.length) {
    console.log('[rewrite] all chunks already rewritten');
    markDone(state, 'rewrite');
    await ws.save(state);
    return;
  }
  console.log(`[rewrite] ${pending.length}/${chunks.length} chunk(s), concurrency ${opts.concurrency}`);

  let done = 0;
  await pool(pending, opts.concurrency, async (c) => {
    try {
      const { text, usage: u } = await completeText({ system, user: rewriteUserMessage(c), effort: SETTINGS.effort.rewrite });
      addStageUsage(state, 'rewrite', u);
      await ws.save(state);
      await ws.writeText(`rewrites/${c.id}.md`, text.trim() + '\n');
      state.chunks[c.id] = { ...state.chunks[c.id], rewritten: true, revisions: state.chunks[c.id]?.revisions ?? 0, lastError: undefined };
      console.log(`[rewrite] ✔ ${c.id} (${++done}/${pending.length}, ${u.output?.toLocaleString() ?? 'unknown'} tokens out)`);
    } catch (e) {
      const usage = usageFromError(e);
      if (usage) addStageUsage(state, 'rewrite', usage);
      state.chunks[c.id] = { ...state.chunks[c.id], rewritten: false, revisions: state.chunks[c.id]?.revisions ?? 0, lastError: (e as Error).message };
      console.error(`[rewrite] ✖ ${c.id}: ${(e as Error).message}`);
    }
    await ws.save(state);
  });
  const failed = chunks.filter((c) => !state.chunks[c.id]?.rewritten);
  if (failed.length) {
    await ws.save(state);
    throw new Error(`${failed.length} chunk(s) still missing: ${failed.map((c) => c.id).join(', ')}. Re-run to retry.`);
  }
  markDone(state, 'rewrite');
  await ws.save(state);
}
