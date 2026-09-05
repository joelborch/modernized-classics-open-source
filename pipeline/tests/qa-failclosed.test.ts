// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Workspace, type BookState } from '../src/state';
import { SETTINGS } from '../src/config';

// Mock model interface
vi.mock('../src/model.js', () => ({
  loadPrompt: vi.fn().mockResolvedValue('system prompt'),
  zeroUsage: () => ({ input: 0, output: 0, cacheRead: 0, usd: 0 }),
  addUsage: (target: any, src: any) => {
    target.input += src.input;
    target.output += src.output;
    target.cacheRead += src.cacheRead;
    target.usd += src.usd;
  },
  usageFromError: (error: any) => error.usage,
  pool: async (items: any[], _concurrency: number, fn: (item: any) => Promise<void>) => {
    for (const item of items) {
      await fn(item);
    }
  },
  completeStructured: vi.fn(),
  completeText: vi.fn(),
}));

import { qa } from '../src/stages/qa';
import { completeStructured, completeText } from '../src/model';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-test-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('qa fail-closed logic', () => {
  it('throws error and does not mark QA stage done when chunks remain flagged after max revisions', async () => {
    const ws = new Workspace('qa-book', tmpDir);
    await fs.mkdir(ws.file('rewrites'), { recursive: true });
    await fs.mkdir(ws.file('qa'), { recursive: true });

    const chunks = [
      { id: 'ch01-p01', chapterIndex: 1, chapterTitle: 'Ch1', part: 1, partCount: 1, text: 'Original text 1' },
      { id: 'ch01-p02', chapterIndex: 1, chapterTitle: 'Ch1', part: 2, partCount: 1, text: 'Original text 2' },
    ];
    await ws.writeJson('chunks.json', chunks);
    await ws.writeText('rewrites/ch01-p01.md', 'Rewrite 1');
    await ws.writeText('rewrites/ch01-p02.md', 'Rewrite 2');

    // Ch01-p01 passes; Ch01-p02 always returns 'revise'
    (completeStructured as any).mockImplementation(async (opts: any) => {
      const isCh02 = opts.user.includes('Original text 2');
      if (isCh02) {
        return {
          data: {
            verdict: 'revise',
            stray_lines: [],
            issues: [{ type: 'dropped_content', description: 'Missing half the paragraph', original_quote: 'test' }],
          },
          usage: { input: 10, output: 10, cacheRead: 0, usd: 0.001 },
        };
      }
      return {
        data: {
          verdict: 'pass',
          stray_lines: [],
          issues: [],
        },
        usage: { input: 10, output: 10, cacheRead: 0, usd: 0.001 },
      };
    });

    (completeText as any).mockResolvedValue({
      text: 'Revised rewrite 2',
      usage: { input: 10, output: 10, cacheRead: 0, usd: 0.001 },
    });

    const state: BookState = {
      slug: 'qa-book',
      sourceEpub: '/dummy/source.epub',
      title: 'QA Book',
      author: 'QA Author',
      completed: ['extract', 'select', 'rewrite'],
      chunks: {
        'ch01-p01': { rewritten: true, revisions: 0 },
        'ch01-p02': { rewritten: true, revisions: 0 },
      },
      usage: {},
      updatedAt: new Date().toISOString(),
    };

    await ws.save(state);

    await expect(qa(ws, state, { concurrency: 1, force: false })).rejects.toThrow(
      /QA failed closed: 1 chunk\(s\) \(ch01-p02\) remained flagged after 2 revision attempts/
    );

    // Verify state was saved with the flagged status and revisions recorded
    const savedState = await ws.load();
    expect(savedState.completed).not.toContain('qa');
    expect(savedState.chunks['ch01-p01'].qa).toBe('pass');
    expect(savedState.chunks['ch01-p02'].qa).toBe('flagged');
    expect(savedState.chunks['ch01-p02'].revisions).toBe(SETTINGS.maxRevisions);
  });

  it('completes QA stage and marks stage done when all chunks pass', async () => {
    const ws = new Workspace('qa-pass-book', tmpDir);
    await fs.mkdir(ws.file('rewrites'), { recursive: true });
    await fs.mkdir(ws.file('qa'), { recursive: true });

    const chunks = [
      { id: 'ch01-p01', chapterIndex: 1, chapterTitle: 'Ch1', part: 1, partCount: 1, text: 'Original text 1' },
    ];
    await ws.writeJson('chunks.json', chunks);
    await ws.writeText('rewrites/ch01-p01.md', 'Rewrite 1');

    (completeStructured as any).mockResolvedValue({
      data: {
        verdict: 'pass',
        stray_lines: [],
        issues: [],
      },
      usage: { input: 10, output: 10, cacheRead: 0, usd: 0.001 },
    });

    const state: BookState = {
      slug: 'qa-pass-book',
      sourceEpub: '/dummy/source.epub',
      title: 'QA Book',
      author: 'QA Author',
      completed: ['extract', 'select', 'rewrite'],
      chunks: {
        'ch01-p01': { rewritten: true, revisions: 0 },
      },
      usage: {},
      updatedAt: new Date().toISOString(),
    };

    await ws.save(state);
    await qa(ws, state, { concurrency: 1, force: false });

    const savedState = await ws.load();
    expect(savedState.completed).toContain('qa');
    expect(savedState.chunks['ch01-p01'].qa).toBe('pass');
  });

  it('leaves a cancelled review retryable and completes it on the next run', async () => {
    const ws = new Workspace('qa-retry-book', tmpDir);
    const chunks = [
      { id: 'ch01-p01', chapterIndex: 1, chapterTitle: 'Ch1', part: 1, partCount: 1, text: 'Original text' },
    ];
    await ws.writeJson('chunks.json', chunks);
    await ws.writeText('rewrites/ch01-p01.md', 'Rewrite 1');
    const state: BookState = {
      slug: ws.slug,
      sourceEpub: '/dummy/source.epub',
      title: 'QA Book',
      author: 'QA Author',
      completed: ['extract', 'select', 'rewrite'],
      chunks: { 'ch01-p01': { rewritten: true, revisions: 0 } },
      usage: {},
      updatedAt: '',
    };
    await ws.save(state);

    (completeStructured as any).mockRejectedValueOnce(new Error('Model call cancelled'));
    await expect(qa(ws, state, { concurrency: 1, force: false })).rejects.toThrow('cancelled');
    expect(state.chunks['ch01-p01'].qa).toBeUndefined();
    expect(state.chunks['ch01-p01'].lastError).toBe('Model call cancelled');

    (completeStructured as any).mockResolvedValueOnce({
      data: { verdict: 'pass', stray_lines: [], issues: [] },
      usage: { input: 10, output: 10, cacheRead: 0, usd: 0.001 },
    });
    await qa(ws, state, { concurrency: 1, force: false });
    expect(state.chunks['ch01-p01'].qa).toBe('pass');
    expect(state.chunks['ch01-p01'].lastError).toBeUndefined();
  });
});
