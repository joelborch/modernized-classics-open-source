#!/usr/bin/env tsx
/**
 * modernize — EPUB in, modernized book on the site out.
 *
 *   npm run modernize -- <book.epub> [--slug name] [options]
 *   npm run modernize -- --slug name --status
 *   npm run modernize -- unlock --slug name
 *
 * Stages run in order and resume from state.json, so re-running after a
 * failure (or after hand-editing selection.json / a rewrite) just continues.
 */
import fs from 'node:fs/promises';
import { modelAbort, zeroUsage, addUsage } from './model.js';
import { currentRunConfig, bindRunConfig } from './provenance.js';
import path from 'node:path';
import { readEpub } from './epub.js';
import { getWorkRoot, validateSlug } from './config.js';
import {
  acquireSlugLock,
  releaseSlugLock,
  STAGES,
  Workspace,
  slugify,
  type BookState,
  type Stage,
  assertStageReady,
  restartFromStage,
} from './state.js';
import { extract } from './stages/extract.js';
import { select } from './stages/select.js';
import { rewrite } from './stages/rewrite.js';
import { qa } from './stages/qa.js';
import { assemble } from './stages/assemble.js';
import { publish } from './stages/publish.js';

interface Args {
  command: 'run' | 'unlock';
  epub?: string;
  slug?: string;
  workRoot?: string;
  from?: Stage;
  to?: Stage;
  concurrency: number;
  noEpub: boolean;
  force: boolean;
  forceQa: boolean;
  reselect: boolean;
  status: boolean;
  help: boolean;
  adoptRunConfig: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    command: 'run',
    concurrency: 4,
    noEpub: false,
    force: false,
    forceQa: false,
    reselect: false,
    status: false,
    help: false,
    adoptRunConfig: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const next = () => argv[++i];
    if (t === 'unlock') a.command = 'unlock';
    else if (t === '--slug') a.slug = next();
    else if (t === '--work-root') a.workRoot = next();
    else if (t === '--force') a.force = true;
    else if (t === '--from') a.from = stage(next());
    else if (t === '--to') a.to = stage(next());
    else if (t === '--concurrency') a.concurrency = Number(next());
    else if (t === '--no-epub') a.noEpub = true;
    else if (t === '--force-qa') a.forceQa = true;
    else if (t === '--reselect') a.reselect = true;
    else if (t === '--status') a.status = true;
    else if (t === '--adopt-run-config') a.adoptRunConfig = true;
    else if (t === '-h' || t === '--help') a.help = true;
    else if (t.startsWith('-')) throw new Error(`Unknown option ${t}`);
    else if (!a.epub && a.command !== 'unlock') a.epub = t;
  }
  return a;
}

function stage(s: string | undefined): Stage {
  if (!s || !STAGES.includes(s as Stage)) throw new Error(`Stage must be one of ${STAGES.join(', ')}`);
  return s as Stage;
}

const HELP = `
modernize — turn a public-domain EPUB into a modernized book on the site

Usage:
  npm run modernize -- <book.epub> [--slug my-book] [--from STAGE] [--to STAGE]
  npm run modernize -- --slug my-book --status
  npm run modernize -- unlock --slug my-book

Stages (in order): ${STAGES.join(' → ')}

Options:
  --slug NAME        Folder name under src/content/books and pipeline/work (default: from EPUB title)
  --work-root DIR    Custom directory for work files (default: pipeline/work, or MODERNIZE_WORK_ROOT)
  --from STAGE       Re-run from this stage even if it already completed
  --to STAGE         Stop after this stage
  --concurrency N    Parallel model calls (default 4)
  --force            Overwrite existing published book or force execution
  --reselect         Ask the model to choose chapters again, ignoring selection.json
  --force-qa         Re-review every chunk, not just unreviewed ones
  --no-epub          Skip EPUB generation at the end
  --status           Print progress for a slug and exit
  --adopt-run-config Explicitly record settings for legacy output of unknown provenance

Commands:
  unlock             Release stale file lock for --slug

Choose MODERNIZE_PROVIDER=claude|codex|agy|custom and MODERNIZE_MODEL (gemini is an alias for AGY).
Claude defaults to opus; other providers require an explicit model. Authenticate your CLI locally.
See docs/providers.md for executable settings, the custom protocol and isolation limits.

Typical flow:
  1. npm run modernize -- pipeline/input/walden.epub --to select
     (inspect pipeline/work/walden/selection.json; edit if the model picked wrong)
  2. npm run modernize -- --slug walden
     (rewrite, QA, assemble, publish; safe to re-run)
  3. Add cover.png to src/content/books/walden/, then npm run build
`.trim();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (args.command === 'run' && !args.epub && !args.slug)) {
    console.log(HELP);
    return;
  }

  const workRoot = getWorkRoot(args.workRoot);

  if (args.command === 'unlock') {
    if (!args.slug) throw new Error('Missing --slug for unlock command.');
    const validSlug = validateSlug(args.slug);
    const released = await releaseSlugLock(validSlug, workRoot);
    if (released) {
      console.log(`[lock] released lock for slug "${validSlug}" in ${workRoot}`);
    } else {
      console.log(`[lock] no active lock found for slug "${validSlug}" in ${workRoot}`);
    }
    return;
  }

  let slug = args.slug;
  let epubPath = args.epub ? path.resolve(args.epub) : undefined;
  let meta = { title: '', author: '' };
  if (epubPath) {
    const book = await readEpub(epubPath);
    meta = { title: book.title, author: book.author };
    slug ??= slugify(book.title);
  }
  if (!slug) throw new Error('Need an EPUB path or --slug.');
  slug = validateSlug(slug);

  const ws = new Workspace(slug, workRoot);
  if (args.status) {
    const state = await ws.load().catch(() => {
      throw new Error(`No workspace for "${slug}" under ${workRoot}. Run without --status and pass the EPUB path to start one.`);
    });
    return printStatus(ws, state);
  }
  await acquireSlugLock(ws);
  try {
    let state: BookState;
    if (epubPath) {
      state = await ws.init(epubPath, meta);
    } else {
      state = await ws.load().catch(() => {
        throw new Error(`No workspace for "${slug}" under ${workRoot}. Pass the EPUB path to start one.`);
      });
    }
    if (args.status) return printStatus(ws, state);

    const fromIdx = args.from ? STAGES.indexOf(args.from) : 0;
    const toIdx = args.to ? STAGES.indexOf(args.to) : STAGES.length - 1;
    if (fromIdx > toIdx) throw new Error('--from must not be later than --to');
    if (!Number.isSafeInteger(args.concurrency) || args.concurrency < 1) throw new Error('--concurrency must be a positive integer');
    if (toIdx >= STAGES.indexOf('select')) {
      const config = await currentRunConfig();
      if (args.from && fromIdx <= STAGES.indexOf('select') && state.runConfig?.fingerprint !== config.fingerprint) args.reselect = true;
      bindRunConfig(state, config, {
        restartSelection: !!args.from && fromIdx <= STAGES.indexOf('select'), adoptLegacy: args.adoptRunConfig,
      });
    }
    if (args.from) restartFromStage(state, args.from);
    if (args.from && fromIdx <= STAGES.indexOf('qa')) {
      // Re-running selection/rewrite/QA invalidates downstream QA state.
      if (fromIdx <= STAGES.indexOf('rewrite')) await fs.rm(ws.file('rewrites'), { recursive: true, force: true });
      await fs.rm(ws.file('qa'), { recursive: true, force: true });
      await fs.mkdir(ws.file('rewrites'), { recursive: true });
      await fs.mkdir(ws.file('qa'), { recursive: true });
    }
    await ws.save(state);

    console.log(`modernize "${state.title}" by ${state.author} → ${slug} (${state.runConfig?.details.provider ?? 'no model'} / ${state.runConfig?.details.model ?? 'extract only'})`);
    const started = Date.now();
    for (let i = fromIdx; i <= toIdx; i++) {
      const s = STAGES[i];
      if (modelAbort.signal.aborted) throw new Error('Run cancelled');
      if (state.completed.includes(s)) {
        console.log(`— ${s}: done`);
        continue;
      }
      assertStageReady(state, s);
      console.log(`▶ ${s}`);
      switch (s) {
        case 'extract':
          await extract(ws, state);
          break;
        case 'select':
          await select(ws, state, { reuseSelection: !args.reselect });
          break;
        case 'rewrite':
          await rewrite(ws, state, { concurrency: args.concurrency });
          break;
        case 'qa':
          await qa(ws, state, { concurrency: args.concurrency, force: args.forceQa });
          break;
        case 'assemble':
          await assemble(ws, state);
          break;
        case 'publish':
          await publish(ws, state, { epub: !args.noEpub, force: args.force });
          break;
      }
      if (modelAbort.signal.aborted) throw new Error('Run cancelled');
    }
    console.log(`\nfinished in ${Math.round((Date.now() - started) / 1000)}s`);
    await printStatus(ws, state);
  } finally {
    await releaseSlugLock(ws);
  }
}

async function printStatus(ws: Workspace, state: BookState) {
  const chunkList = Object.entries(state.chunks);
  const rewritten = chunkList.filter(([, c]) => c.rewritten).length;
  const pass = chunkList.filter(([, c]) => c.qa === 'pass').length;
  const flagged = chunkList.filter(([, c]) => c.qa === 'flagged');
  console.log(`\n${state.title} — ${state.author}`);
  console.log(`workspace: ${ws.dir}`);
  console.log(`stages: ${STAGES.map((s) => (state.completed.includes(s) ? `✔ ${s}` : `· ${s}`)).join('  ')}`);
  if (chunkList.length) console.log(`chunks: ${chunkList.length} total, ${rewritten} rewritten, ${pass} QA pass, ${flagged.length} flagged`);
  for (const [id, c] of flagged) console.log(`  ⚑ ${id}${c.lastError ? ` — ${c.lastError}` : ''} (see qa/${id}.json)`);
  const totals = zeroUsage();
  for (const u of Object.values(state.usage)) addUsage(totals, u);
  const count = (n: number | null) => n === null ? 'unknown' : n.toLocaleString();
  if (Object.keys(state.usage).length) console.log(`tokens: ${count(totals.input)} in, ${count(totals.output)} out, ${count(totals.cacheRead)} cached; reported cost: ${totals.usd === null ? 'unknown' : '$' + totals.usd.toFixed(2)}`);
}

process.once('SIGINT', () => modelAbort.abort());
process.once('SIGTERM', () => modelAbort.abort());

main().catch((err) => {
  console.error(`\n✖ ${err.message ?? err}`);
  process.exit(1);
});
