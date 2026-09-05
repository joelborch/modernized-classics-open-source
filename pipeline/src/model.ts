import fs from 'node:fs/promises';
import path from 'node:path';
import { z, toJSONSchema } from 'zod';
import { PROMPTS_DIR } from './config.js';
import { complete } from './providers/cli.js';
import type { Request, Usage } from './providers/types.js';
export { zeroUsage, addUsage, RefusalError, type Usage, type Effort } from './providers/types.js';

export const modelAbort = new AbortController();
export class ModelResponseError extends Error {
  constructor(message: string, readonly usage: Usage) {
    super(message);
  }
}
export function usageFromError(error: unknown): Usage | undefined {
  return error instanceof ModelResponseError ? error.usage : undefined;
}
export async function loadPrompt(name: string): Promise<string> {
  return (await fs.readFile(path.join(PROMPTS_DIR, `${name}.md`), 'utf8')).trim();
}
export async function completeText(opts: Request): Promise<{ text: string; usage: Usage }> {
  const result = await complete({ ...opts, signal: opts.signal ?? modelAbort.signal });
  const text = result.text.trim();
  if (!text) throw new ModelResponseError('Empty response from model', result.usage);
  return { text, usage: result.usage };
}
export async function completeStructured<T extends z.ZodType>(opts: Request & { schema: T }): Promise<{ data: z.infer<T>; usage: Usage }> {
  const { $schema: _drop, ...jsonSchema } = toJSONSchema(opts.schema) as Record<string, unknown>;
  void _drop;
  const result = await complete({ ...opts, jsonSchema, signal: opts.signal ?? modelAbort.signal });
  let raw = result.data;
  if (raw === undefined) {
    try { raw = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1')); }
    catch { throw new ModelResponseError('Model response was not valid JSON', result.usage); }
  }
  const checked = opts.schema.safeParse(raw);
  if (!checked.success) throw new ModelResponseError(`Structured output failed validation: ${checked.error.issues.map(i => i.path.join('.') + ': ' + i.code).join(', ')}`, result.usage);
  return { data: checked.data as z.infer<T>, usage: result.usage };
}

/** Simple worker pool for concurrent model calls. */
export async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  const outcomes = await Promise.allSettled(workers);
  const failed = outcomes.find((outcome) => outcome.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}
