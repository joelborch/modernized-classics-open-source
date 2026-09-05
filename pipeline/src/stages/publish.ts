import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { completeStructured, loadPrompt, modelAbort, usageFromError } from '../model.js';
import { BOOKS_DIR, ROOT, SETTINGS, validateSlug } from '../config.js';
import { Workspace, markDone, addStageUsage, type BookState } from '../state.js';

const FrontmatterSchema = z.object({
  title: z.string(),
  author: z.string(),
  yearPublished: z.number().int(),
  description: z.string(),
  tags: z.array(z.string()).min(3).max(6),
  coverAlt: z.string(),
  coverPrompt: z.string(),
});

/**
 * Write src/content/books/<slug>/index.md with generated frontmatter,
 * plus cover-prompt.txt for whoever makes the cover, then build the EPUB.
 */
export async function publish(ws: Workspace, state: BookState, opts: { epub: boolean; force?: boolean }): Promise<string> {
  validateSlug(ws.slug);
  validateSlug(state.slug);

  const dir = path.join(BOOKS_DIR, ws.slug);
  const rel = path.relative(BOOKS_DIR, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escape detected: target directory "${dir}" is outside "${BOOKS_DIR}"`);
  }

  const target = path.join(dir, 'index.md');
  const alreadyExists = await fs
    .access(target)
    .then(() => true)
    .catch(() => false);

  if (alreadyExists && !opts.force) {
    throw new Error(`Destination "${target}" already exists. Pass --force to overwrite published book.`);
  }

  const book = await ws.readText('book.md');
  if (!book) throw new Error('book.md missing; run assemble first.');

  let generated;
  try {
    generated = await completeStructured({
      system: await loadPrompt('frontmatter'),
      user: `Source title: ${state.title}\nSource author: ${state.author}\n\nOpening of the modernized text:\n\n${book.slice(0, 6000)}`,
      effort: SETTINGS.effort.frontmatter,
      schema: FrontmatterSchema,
    });
  } catch (error) {
    const failedUsage = usageFromError(error);
    if (failedUsage) addStageUsage(state, 'frontmatter', failedUsage);
    await ws.save(state);
    throw error;
  }
  const { data: fm, usage } = generated;
  addStageUsage(state, 'frontmatter', usage);
  await ws.save(state);
  throwIfCancelled(modelAbort.signal);

  await fs.mkdir(dir, { recursive: true });
  const hasCover = await fs
    .access(path.join(dir, 'cover.png'))
    .then(() => true)
    .catch(() => false);

  const frontmatter = [
    '---',
    `title: ${yaml(fm.title)}`,
    `author: ${yaml(fm.author)}`,
    `yearPublished: ${fm.yearPublished}`,
    `yearModernized: ${new Date().getFullYear()}`,
    `description: ${yaml(fm.description)}`,
    'tags:',
    ...fm.tags.map((t) => `  - ${yaml(t)}`),
    ...(hasCover ? ['coverImage: ./cover.png', `coverAlt: ${yaml(fm.coverAlt)}`] : []),
    'downloads:',
    `  epub: /downloads/${ws.slug}.epub`,
    '---',
    '',
  ].join('\n');

  await fs.writeFile(target, frontmatter + book, 'utf8');

  if (!hasCover) {
    await fs.writeFile(path.join(dir, 'cover-prompt.txt'), fm.coverPrompt + '\n', 'utf8');
    console.log(`[publish] no cover.png yet; wrote cover-prompt.txt (generate-epubs removes it once a cover exists)`);
  }
  console.log(`[publish] wrote ${path.relative(ROOT, target)}`);

  if (opts.epub) {
    console.log('[publish] generating EPUBs...');
    await run('npm', ['run', 'generate-epubs', '--silent'], modelAbort.signal);
  }
  throwIfCancelled(modelAbort.signal);
  markDone(state, 'publish');
  await ws.save(state);
  return target;
}

function yaml(s: string): string {
  return JSON.stringify(s);
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('Run cancelled');
}

function run(cmd: string, args: string[], signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Run cancelled'));
    const p = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
    });
    let cancelled = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const kill = (childSignal: NodeJS.Signals) => {
      if (!p.pid) return;
      try {
        if (process.platform === 'win32') p.kill(childSignal);
        else process.kill(-p.pid, childSignal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') reject(error);
      }
    };
    const abort = () => {
      if (cancelled) return;
      cancelled = true;
      kill('SIGTERM');
      escalation = setTimeout(() => kill('SIGKILL'), 1000);
    };
    const cleanup = () => {
      if (escalation) clearTimeout(escalation);
      signal.removeEventListener('abort', abort);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    p.on('error', (error) => {
      cleanup();
      reject(error);
    });
    p.on('close', (code) => {
      cleanup();
      if (cancelled) reject(new Error('Run cancelled'));
      else if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}
