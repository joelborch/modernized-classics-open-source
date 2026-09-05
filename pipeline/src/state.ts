/**
 * Per-book working directory and resumable state.
 *
 *   pipeline/work/<slug>/
 *     source.epub        copy of the input (gitignored)
 *     state.json         stage progress, batch ids, usage
 *     catalogue.txt      what the selection model saw
 *     selection.json     chosen spine items
 *     chapters.json      extracted chapter text
 *     chunks.json        rewrite slices
 *     rewrites/<id>.md   model output per chunk
 *     qa/<id>.json       QA verdicts per chunk
 *     book.md            assembled book
 *     .lock              lock file when process is running
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import type { RunConfig } from './provenance.js';
import { getWorkRoot, validateSlug } from './config.js';

export { validateSlug } from './config.js';

export type Stage = 'extract' | 'select' | 'rewrite' | 'qa' | 'assemble' | 'publish';
export const STAGES: Stage[] = ['extract', 'select', 'rewrite', 'qa', 'assemble', 'publish'];

import { addUsage, zeroUsage, type Usage } from './providers/types.js';
export type { Usage } from './providers/types.js';

export interface ChunkStatus {
  rewritten: boolean;
  qa?: 'pass' | 'revise' | 'flagged';
  revisions: number;
  lastError?: string;
}

export interface BookState {
  runConfig?: RunConfig;
  configHistory?: { previous: RunConfig | null; next: string; reason: string; at: string }[];
  slug: string;
  sourceEpub: string;
  sourceSha256?: string;
  title: string;
  author: string;
  completed: Stage[];
  chunks: Record<string, ChunkStatus>;
  usage: Record<string, Usage>;
  updatedAt: string;
}

export interface LockInfo {
  pid: number;
  hostname: string;
  operator: string;
  timestamp: string;
}

export class Workspace {
  readonly slug: string;
  readonly workRoot: string;
  readonly dir: string;

  constructor(slug: string, workRoot?: string) {
    this.slug = validateSlug(slug);
    this.workRoot = getWorkRoot(workRoot);
    this.dir = path.join(this.workRoot, this.slug);
  }

  file(...parts: string[]) {
    return path.join(this.dir, ...parts);
  }

  async init(sourceEpub: string, meta: { title: string; author: string }) {
    await fs.mkdir(this.file('rewrites'), { recursive: true });
    await fs.mkdir(this.file('qa'), { recursive: true });
    const sourceSha256 = await sha256File(sourceEpub);
    const existing = await this.load().catch(() => null);
    if (existing) {
      let recorded = existing.sourceSha256;
      if (!recorded) {
        const generated = existing.completed.length > 0 || Object.keys(existing.chunks).length > 0;
        if (generated) {
          recorded = await sha256File(this.file('source.epub')).catch(() => undefined);
          if (!recorded) {
            throw new Error(`Workspace "${this.slug}" has generated output but no verifiable source fingerprint. Resume with --slug only or start a new workspace.`);
          }
        } else {
          recorded = sourceSha256;
        }
      }
      if (recorded !== sourceSha256) {
        throw new Error(`Workspace "${this.slug}" belongs to a different source EPUB. Use its existing source or choose a new slug.`);
      }
      if (!existing.sourceSha256) {
        existing.sourceSha256 = recorded;
        await this.save(existing);
      }
      return existing;
    }
    const state: BookState = {
      slug: this.slug,
      sourceEpub,
      sourceSha256,
      title: meta.title,
      author: meta.author,
      completed: [],
      chunks: {},
      usage: {},
      updatedAt: new Date().toISOString(),
    };
    await this.save(state);
    return state;
  }

  async load(): Promise<BookState> {
    return JSON.parse(await fs.readFile(this.file('state.json'), 'utf8'));
  }

  async save(state: BookState) {
    await saveState(this, state);
  }

  async readJson<T>(name: string): Promise<T> {
    return JSON.parse(await fs.readFile(this.file(name), 'utf8'));
  }

  async writeJson(name: string, data: unknown) {
    await writeJson(this.file(name), data);
  }

  async readText(...parts: string[]): Promise<string | null> {
    try {
      return await fs.readFile(this.file(...parts), 'utf8');
    } catch {
      return null;
    }
  }

  async writeText(name: string, text: string) {
    await fs.mkdir(path.dirname(this.file(name)), { recursive: true });
    await fs.writeFile(this.file(name), text, 'utf8');
  }
}

async function sha256File(file: string): Promise<string> {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

/** Atomic write to JSON file via temporary file rename in the same directory. */
export async function writeJson(file: string, data: unknown): Promise<void> {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const tmpFile = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`);
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmpFile, file);
}

export const writeJsonAtomic = writeJson;

/** Persist state.json atomically with updated timestamp. */
export async function saveState(target: string | Workspace, state: BookState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  const file = typeof target === 'string' ? target : target.file('state.json');
  await writeJson(file, state);
}

function resolveLockDetails(slugOrWs: string | Workspace, workRoot?: string): { slug: string; lockPath: string } {
  if (typeof slugOrWs === 'string') {
    const slug = validateSlug(slugOrWs);
    const root = getWorkRoot(workRoot);
    return { slug, lockPath: path.join(root, slug, '.lock') };
  }
  return { slug: slugOrWs.slug, lockPath: slugOrWs.file('.lock') };
}

function getOperator(): string {
  try {
    return process.env.MODERNIZE_OPERATOR || process.env.USER || process.env.USERNAME || os.userInfo().username || 'unknown';
  } catch {
    return process.env.MODERNIZE_OPERATOR || process.env.USER || process.env.USERNAME || 'unknown';
  }
}

/** Acquire exclusive file lock for the given slug. */
export async function acquireSlugLock(slugOrWs: string | Workspace, workRoot?: string): Promise<LockInfo> {
  const { slug, lockPath } = resolveLockDetails(slugOrWs, workRoot);
  const info: LockInfo = {
    pid: process.pid,
    hostname: os.hostname(),
    operator: getOperator(),
    timestamp: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  try {
    await fs.writeFile(lockPath, JSON.stringify(info, null, 2) + '\n', { flag: 'wx' });
    return info;
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      let existing: LockInfo | null = null;
      try {
        existing = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      } catch {}
      if (existing && existing.pid) {
        throw new Error(
          `Slug "${slug}" is locked by PID ${existing.pid} (${existing.operator}@${existing.hostname}) since ${existing.timestamp}. Run "modernize unlock --slug ${slug}" to force unlock if stale.`
        );
      }
      throw new Error(
        `Slug "${slug}" is locked (.lock file exists). Run "modernize unlock --slug ${slug}" to force unlock if stale.`
      );
    }
    throw err;
  }
}

/** Release file lock for the given slug. Returns true if lock was removed, false if none existed. */
export async function releaseSlugLock(slugOrWs: string | Workspace, workRoot?: string): Promise<boolean> {
  const { lockPath } = resolveLockDetails(slugOrWs, workRoot);
  try {
    await fs.unlink(lockPath);
    return true;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

/** Inspect current lock status for a slug. */
export async function getSlugLock(slugOrWs: string | Workspace, workRoot?: string): Promise<LockInfo | null> {
  const { lockPath } = resolveLockDetails(slugOrWs, workRoot);
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function markDone(state: BookState, stage: Stage) {
  if (!state.completed.includes(stage)) state.completed.push(stage);
}

export function restartFromStage(state: BookState, stage: Stage): void {
  const fromIdx = STAGES.indexOf(stage);
  state.completed = state.completed.filter((s) => STAGES.indexOf(s) < fromIdx);
  if (fromIdx > STAGES.indexOf('qa')) return;
  for (const chunk of Object.values(state.chunks)) {
    if (fromIdx <= STAGES.indexOf('rewrite')) chunk.rewritten = false;
    chunk.qa = undefined;
    chunk.revisions = 0;
    chunk.lastError = undefined;
  }
}

/** Explicit --from must not bypass unfinished upstream work or failed QA. */
export function assertStageReady(state: BookState, stage: Stage): void {
  const prior = STAGES.slice(0, STAGES.indexOf(stage));
  const missing = prior.filter(s => !state.completed.includes(s));
  if (missing.length) throw new Error(`Cannot run ${stage}: unfinished stages ${missing.join(', ')}`);
  if (stage === 'assemble' || stage === 'publish') {
    const chunks = Object.values(state.chunks);
    if (!chunks.length || chunks.some(c => !c.rewritten || c.qa !== 'pass')) {
      throw new Error(`Cannot run ${stage}: every chunk must have a rewrite and passing QA`);
    }
  }
}

export function addStageUsage(state: BookState, stage: string, u: Usage) {
  const cur = state.usage[stage] ?? zeroUsage();
  addUsage(cur, u);
  state.usage[stage] = cur;
}

export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return validateSlug(slug);
}
