import { z } from 'zod';
import { completeStructured, completeText, loadPrompt, pool, zeroUsage, addUsage, usageFromError, type Usage } from '../model.js';
import { SETTINGS } from '../config.js';
import type { Chunk } from '../chunk.js';
import { Workspace, markDone, addStageUsage, type BookState } from '../state.js';
import { rewriteUserMessage } from './rewrite.js';

const IssueType = z.enum([
  'dropped_content',
  'meaning_changed',
  'flawed_analogy',
  'persona_drift',
  'summarized',
  'structural_defect',
  'archaic_residue',
  'meta_or_editorial',
]);

export const QaSchema = z.object({
  verdict: z.enum(['pass', 'revise']),
  stray_lines: z.array(z.string()).describe('Whole lines to delete verbatim'),
  issues: z.array(
    z.object({
      type: IssueType,
      description: z.string(),
      original_quote: z.string().describe('Short quote from original, or empty'),
      rewrite_quote: z.string().describe('Snippet from draft with the defect, or empty'),
      fix_instruction: z.string().describe('Actionable repair directive'),
    }),
  ),
});
export type QaResult = z.infer<typeof QaSchema>;

function qaUserMessage(chunk: Chunk, rewrite: string): string {
  return ['<original>', chunk.text, '</original>', '', '<rewrite>', rewrite, '</rewrite>'].join('\n');
}

export function stripStrayLines(text: string, stray: string[]): string {
  if (!stray.length) return text;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const bad = new Set(stray.map(norm).filter(Boolean));
  return text
    .split('\n')
    .filter((line) => !bad.has(norm(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Review every rewrite against its source. Passing chunks get stray lines
 * stripped in place; failing chunks are revised and re-reviewed up to
 * SETTINGS.maxRevisions times, then flagged for a human.
 */
export async function qa(ws: Workspace, state: BookState, opts: { concurrency: number; force: boolean }): Promise<void> {
  const chunks = await ws.readJson<Chunk[]>('chunks.json');
  const qaSystem = await loadPrompt('qa');
  const rewriteSystem = await loadPrompt('rewrite');
  const reviseNote = await loadPrompt('revise');

  const pending = chunks.filter((c) => opts.force || !state.chunks[c.id]?.qa);
  if (!pending.length) {
    const flagged = chunks.filter((c) => state.chunks[c.id]?.qa === 'flagged');
    if (flagged.length > 0) {
      const flaggedIds = flagged.map((c) => c.id).join(', ');
      throw new Error(
        `QA failed closed: ${flagged.length} chunk(s) (${flaggedIds}) remained flagged after ${SETTINGS.maxRevisions} revision attempts.`
      );
    }
    console.log('[qa] all chunks already reviewed');
    markDone(state, 'qa');
    await ws.save(state);
    return;
  }
  console.log(`[qa] reviewing ${pending.length}/${chunks.length} chunk(s), concurrency ${opts.concurrency}`);

  const usage = zeroUsage();
  let poolFailure: unknown;
  try {
    await pool(pending, opts.concurrency, async (c) => {
      const status = state.chunks[c.id] ??= { rewritten: false, revisions: 0 };
      let current = (await ws.readText('rewrites', `${c.id}.md`)) ?? '';
      try {
        let result = await reviewOnce(c, current, qaSystem, usage);
        current = await applyVerdict(ws, c, current, result);

        while (result.verdict === 'revise' && status.revisions < SETTINGS.maxRevisions) {
          const round = status.revisions + 1;
          console.log(`[qa] revising ${c.id} (round ${round}): ${result.issues.map((i) => i.type).join(', ')}`);
          const issues = result.issues
            .map((i) => {
              const orig = i.original_quote ? `\n    Original snippet: "${i.original_quote}"` : '';
              const curr = i.rewrite_quote ? `\n    Draft location: "${i.rewrite_quote}"` : '';
              const fix = i.fix_instruction ? `\n    Action: ${i.fix_instruction}` : '';
              return `- [${i.type}] ${i.description}${orig}${curr}${fix}`;
            })
            .join('\n\n');
          let revised;
          try {
            revised = await completeText({
              system: rewriteSystem,
              user: `${rewriteUserMessage(c)}\n\n<previous_rewrite>\n${current}\n</previous_rewrite>\n\n${reviseNote}\n\n<issues>\n${issues}\n</issues>`,
              effort: SETTINGS.effort.revise,
            });
          } catch (error) {
            const failedUsage = usageFromError(error);
            if (failedUsage) addUsage(usage, failedUsage);
            throw error;
          }
          const { text, usage: ru } = revised;
          addUsage(usage, ru);
          const again = await reviewOnce(c, text, qaSystem, usage);
          status.revisions = round;
          result = again;
          current = await applyVerdict(ws, c, text, again);
        }
        status.qa = result.verdict === 'pass' ? 'pass' : 'flagged';
        status.lastError = undefined;
        console.log(`[qa] ${status.qa === 'pass' ? '✔' : '⚑'} ${c.id}${status.qa === 'flagged' ? ` — see qa/${c.id}.json` : ''}`);
      } catch (e) {
        status.qa = undefined;
        status.lastError = (e as Error).message;
        console.error(`[qa] ✖ ${c.id}: ${status.lastError}`);
        throw e;
      }
      await ws.save(state);
    });
  } catch (e) {
    poolFailure = e;
  }
  addStageUsage(state, 'qa', usage);
  if (poolFailure) {
    await ws.save(state);
    throw poolFailure;
  }

  const flagged = chunks.filter((c) => state.chunks[c.id]?.qa === 'flagged');
  if (flagged.length > 0) {
    const flaggedIds = flagged.map((c) => c.id).join(', ');
    await ws.save(state);
    throw new Error(
      `QA failed closed: ${flagged.length} chunk(s) (${flaggedIds}) remained flagged after ${SETTINGS.maxRevisions} revision attempts.`
    );
  }

  console.log(`[qa] done. All ${chunks.length} chunk(s) passed QA.`);
  markDone(state, 'qa');
  await ws.save(state);
}


/** Persist the verdict and the stray-line-stripped rewrite; return the cleaned text. */
async function applyVerdict(ws: Workspace, c: Chunk, text: string, r: QaResult): Promise<string> {
  await ws.writeJson(`qa/${c.id}.json`, r);
  const cleaned = stripStrayLines(text, r.stray_lines);
  await ws.writeText(`rewrites/${c.id}.md`, cleaned.trim() + '\n');
  return cleaned;
}

async function reviewOnce(chunk: Chunk, rewrite: string, system: string, u: Usage): Promise<QaResult> {
  try {
    const { data, usage } = await completeStructured({
      system,
      user: qaUserMessage(chunk, rewrite),
      effort: SETTINGS.effort.qa,
      schema: QaSchema,
    });
    addUsage(u, usage);
    return data;
  } catch (error) {
    const failedUsage = usageFromError(error);
    if (failedUsage) addUsage(u, failedUsage);
    throw error;
  }
}
