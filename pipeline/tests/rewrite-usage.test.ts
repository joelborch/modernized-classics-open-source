// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Workspace, type BookState } from '../src/state';

vi.mock('../src/model.js', () => ({
  loadPrompt: vi.fn().mockResolvedValue('system prompt'),
  pool: async (items: any[], _concurrency: number, fn: (item: any) => Promise<void>) => {
    for (const item of items) await fn(item);
  },
  completeText: vi.fn(),
  usageFromError: (error: any) => error.usage,
}));

import { completeText } from '../src/model';
import { rewrite } from '../src/stages/rewrite';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-usage-')); vi.clearAllMocks(); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

it('checkpoints each completed call before starting the next resumable rewrite', async () => {
  const ws = new Workspace('rewrite-book', root);
  const chunks = [1, 2].map((part) => ({
    id: `ch01-p0${part}`, chapterIndex: 1, chapterTitle: 'Chapter', part, partCount: 2,
    text: `Source ${part}`, prevContext: '', nextContext: '',
  }));
  await ws.writeJson('chunks.json', chunks);
  const state: BookState = {
    slug: ws.slug, sourceEpub: '/fixture.epub', title: 'Book', author: 'Author', completed: ['extract', 'select'],
    chunks: Object.fromEntries(chunks.map((chunk) => [chunk.id, { rewritten: false, revisions: 0 }])), usage: {}, updatedAt: '',
  };
  await ws.save(state);
  let call = 0;
  (completeText as any).mockImplementation(async () => {
    call += 1;
    if (call === 2) {
      const saved = await ws.load();
      expect(saved.usage.rewrite.output).toBe(2);
    }
    return { text: `Rewrite ${call}`, usage: { input: 3, output: 2, cacheRead: 0, usd: 0.01 } };
  });

  await rewrite(ws, state, { concurrency: 1 });

  expect(state.usage.rewrite).toEqual({ input: 6, output: 4, cacheRead: 0, usd: 0.02 });
});
