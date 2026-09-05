// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { select } from '../src/stages/select';
import { Workspace, type BookState } from '../src/state';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'selection-state-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

it('replaces stale chunk status with the exact chunks from the current selection', async () => {
  const ws = new Workspace('selection-book', root);
  await ws.writeJson('items.json', [{
    id: 'chosen', href: 'chosen.xhtml', title: 'Chosen', text: 'Current source passage. '.repeat(20), ids: ['chosen'], inNav: true,
  }]);
  await ws.writeJson('selection.json', { include: [{ id: 'chosen', title: 'Chosen' }], reasoning: 'fixture' });
  const state: BookState = {
    slug: ws.slug, sourceEpub: '/fixture.epub', title: 'Book', author: 'Author', completed: ['extract'], usage: {}, updatedAt: '',
    chunks: {
      'ch01-p01': { rewritten: true, revisions: 1 },
      obsolete: { rewritten: false, qa: 'flagged', revisions: 2 },
    },
  };

  await select(ws, state, { reuseSelection: true });

  expect(Object.keys(state.chunks)).toEqual(['ch01-p01']);
  expect(state.chunks['ch01-p01']).toEqual({ rewritten: true, revisions: 1 });
});
