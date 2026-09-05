// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { assemble } from '../src/stages/assemble';
import { Workspace, type BookState } from '../src/state';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('assemble', () => {
  it('stitches rewrites in order, enforces one heading per chapter, and strips meta lines', async () => {
    const ws = new Workspace('t');
    (ws as any).dir = dir;
    await fs.mkdir(path.join(dir, 'rewrites'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'chunks.json'),
      JSON.stringify([
        { id: 'ch01-p01', chapterIndex: 1, chapterTitle: 'One', part: 1, partCount: 2 },
        { id: 'ch01-p02', chapterIndex: 1, chapterTitle: 'One', part: 2, partCount: 2 },
        { id: 'ch02-p01', chapterIndex: 2, chapterTitle: 'Two', part: 1, partCount: 1 },
      ]),
    );
    await fs.writeFile(path.join(dir, 'rewrites', 'ch01-p01.md'), "Here's the rewrite:\n\nBody one.\n");
    await fs.writeFile(path.join(dir, 'rewrites', 'ch01-p02.md'), '## One\n\nBody one continued.\n');
    await fs.writeFile(path.join(dir, 'rewrites', 'ch02-p01.md'), "Here's the rewrite:\n\n## Two\n\n## BODY12\n\nBody two.\n");
    const state = { chunks: {}, completed: [], usage: {}, batches: {} } as unknown as BookState;
    const book = await assemble(ws, state);
    expect(book).toBe('## One\n\nBody one.\n\nBody one continued.\n\n## Two\n\nBody two.\n');
    expect(state.completed).toContain('assemble');
  });
});
