// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Workspace, type BookState } from '../src/state';
import { BOOKS_DIR } from '../src/config';

const modelSignal = vi.hoisted(() => ({
  aborted: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
vi.mock('../src/model.js', () => ({
  loadPrompt: vi.fn().mockResolvedValue('system prompt'),
  completeStructured: vi.fn().mockResolvedValue({
    data: {
      title: 'Modern Title',
      author: 'Modern Author',
      yearPublished: 1920,
      description: 'A great modernized book description.',
      tags: ['classic', 'fiction', 'literature'],
      coverAlt: 'Cover art',
      coverPrompt: 'Prompt for cover generation',
    },
    usage: { input: 50, output: 50, cacheRead: 0, usd: 0.002 },
  }),
  modelAbort: { signal: modelSignal },
  usageFromError: (error: any) => error.usage,
}));

import { publish } from '../src/stages/publish';

let workDir: string;
const testSlug = 'test-published-book';
const targetDir = path.join(BOOKS_DIR, testSlug);

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pub-work-'));
  modelSignal.aborted = false;
  await fs.rm(targetDir, { recursive: true, force: true });
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.rm(targetDir, { recursive: true, force: true });
});

describe('publish stage validation and overwrite protection', () => {
  it('publishes successfully on fresh slug', async () => {
    const ws = new Workspace(testSlug, workDir);
    await ws.writeText('book.md', '## Chapter 1\n\nModern content.\n');

    const state: BookState = {
      slug: testSlug,
      sourceEpub: '/dummy.epub',
      title: 'Modern Title',
      author: 'Modern Author',
      completed: ['extract', 'select', 'rewrite', 'qa', 'assemble'],
      chunks: {},
      usage: {},
      updatedAt: new Date().toISOString(),
    };

    const target = await publish(ws, state, { epub: false });
    expect(target).toBe(path.join(targetDir, 'index.md'));

    const content = await fs.readFile(target, 'utf8');
    expect(content).toContain('title: "Modern Title"');
    expect(content).toContain('## Chapter 1');
    expect(state.completed).toContain('publish');
  });

  it('rejects accidental overwrite when destination exists without force option', async () => {
    const ws = new Workspace(testSlug, workDir);
    await ws.writeText('book.md', '## Chapter 1\n\nContent.\n');

    const state: BookState = {
      slug: testSlug,
      sourceEpub: '/dummy.epub',
      title: 'Modern Title',
      author: 'Modern Author',
      completed: ['extract', 'select', 'rewrite', 'qa', 'assemble'],
      chunks: {},
      usage: {},
      updatedAt: new Date().toISOString(),
    };

    // First publish succeeds
    await publish(ws, state, { epub: false });

    // Second publish without force must throw
    await expect(publish(ws, state, { epub: false })).rejects.toThrow(
      /already exists\. Pass --force to overwrite/
    );

    // Second publish with force: true succeeds
    await expect(publish(ws, state, { epub: false, force: true })).resolves.toBe(
      path.join(targetDir, 'index.md')
    );
  });

  it('validates slug and rejects invalid slugs / path escape', async () => {
    const ws = Object.create(Workspace.prototype);
    Object.assign(ws, {
      slug: '../escaped-slug',
      dir: path.join(workDir, 'escaped'),
      file: (...p: string[]) => path.join(workDir, 'escaped', ...p),
      readText: async () => 'book text',
      save: async () => {},
    });

    const state: BookState = {
      slug: '../escaped-slug',
      sourceEpub: '/dummy.epub',
      title: 'Escaped Title',
      author: 'Author',
      completed: ['assemble'],
      chunks: {},
      usage: {},
      updatedAt: new Date().toISOString(),
    };

    await expect(publish(ws, state, { epub: false })).rejects.toThrow(/path traversal/);
  });

  it('does not mark publish done when cancellation arrives before finalization', async () => {
    const ws = new Workspace(testSlug, workDir);
    await ws.writeText('book.md', '## Chapter 1\n\nModern content.\n');
    const state: BookState = {
      slug: testSlug, sourceEpub: '/dummy.epub', title: 'Title', author: 'Author',
      completed: ['extract', 'select', 'rewrite', 'qa', 'assemble'], chunks: {}, usage: {}, updatedAt: '',
    };
    modelSignal.aborted = true;

    await expect(publish(ws, state, { epub: false })).rejects.toThrow('cancelled');
    expect(state.completed).not.toContain('publish');
  });
});
