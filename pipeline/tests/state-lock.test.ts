// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  Workspace,
  writeJson,
  writeJsonAtomic,
  saveState,
  acquireSlugLock,
  releaseSlugLock,
  getSlugLock,
  type BookState,
} from '../src/state';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-lock-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('atomic JSON writes', () => {
  it('writes json atomically without leaving temp files behind', async () => {
    const targetFile = path.join(tmpDir, 'state.json');
    const data = { hello: 'world', count: 42 };
    await writeJson(targetFile, data);

    const contents = JSON.parse(await fs.readFile(targetFile, 'utf8'));
    expect(contents).toEqual(data);

    // Verify no temporary .tmp files left in the directory
    const files = await fs.readdir(tmpDir);
    expect(files).toEqual(['state.json']);
  });

  it('saveState atomically updates state file and timestamp', async () => {
    const ws = new Workspace('sample-slug', tmpDir);
    const state: BookState = {
      slug: 'sample-slug',
      sourceEpub: '/path/to/source.epub',
      title: 'Sample Book',
      author: 'Sample Author',
      completed: ['extract'],
      chunks: {},
      usage: {},
      updatedAt: '2000-01-01T00:00:00.000Z',
    };

    await saveState(ws, state);

    const loaded = await ws.load();
    expect(loaded.title).toBe('Sample Book');
    expect(loaded.completed).toEqual(['extract']);
    expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThan(new Date('2000-01-01').getTime());

    const files = await fs.readdir(ws.dir);
    expect(files).toEqual(['state.json']);
  });

  it('binds a workspace to source content and rejects a different EPUB for the same slug', async () => {
    const first = path.join(tmpDir, 'first.epub');
    const same = path.join(tmpDir, 'same.epub');
    const different = path.join(tmpDir, 'different.epub');
    await fs.writeFile(first, 'same source bytes');
    await fs.writeFile(same, 'same source bytes');
    await fs.writeFile(different, 'different source bytes');
    const ws = new Workspace('source-bound', tmpDir);

    const created = await ws.init(first, { title: 'One', author: 'Author' });
    expect(created.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(ws.init(same, { title: 'One', author: 'Author' })).resolves.toMatchObject({
      sourceSha256: created.sourceSha256,
    });
    await expect(ws.init(different, { title: 'Two', author: 'Other' })).rejects.toThrow('different source EPUB');
  });
});

describe('slug locking', () => {
  it('acquires and releases file lock with complete metadata', async () => {
    const ws = new Workspace('my-book', tmpDir);
    const lockInfo = await acquireSlugLock(ws);

    expect(lockInfo.pid).toBe(process.pid);
    expect(lockInfo.hostname).toBe(os.hostname());
    expect(typeof lockInfo.operator).toBe('string');
    expect(new Date(lockInfo.timestamp).getTime()).not.toBeNaN();

    const activeLock = await getSlugLock(ws);
    expect(activeLock).toEqual(lockInfo);

    const lockPath = ws.file('.lock');
    const exists = await fs.access(lockPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const released = await releaseSlugLock(ws);
    expect(released).toBe(true);

    const activeAfterRelease = await getSlugLock(ws);
    expect(activeAfterRelease).toBeNull();

    const releasedAgain = await releaseSlugLock(ws);
    expect(releasedAgain).toBe(false);
  });

  it('rejects concurrent lock acquisition on the same slug', async () => {
    const ws = new Workspace('locked-book', tmpDir);
    await acquireSlugLock(ws);

    await expect(acquireSlugLock(ws)).rejects.toThrow(
      /is locked by PID|is locked \(\.lock file exists\)/
    );

    await releaseSlugLock(ws);
    // Should be able to acquire again after release
    const lockInfo2 = await acquireSlugLock(ws);
    expect(lockInfo2.pid).toBe(process.pid);
    await releaseSlugLock(ws);
  });

  it('works with slug string and workRoot parameter', async () => {
    const lockInfo = await acquireSlugLock('string-slug', tmpDir);
    expect(lockInfo.pid).toBe(process.pid);

    const active = await getSlugLock('string-slug', tmpDir);
    expect(active?.pid).toBe(process.pid);

    const released = await releaseSlugLock('string-slug', tmpDir);
    expect(released).toBe(true);
  });
});
