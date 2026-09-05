export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export interface Usage {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  usd: number | null;
}
export const zeroUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, usd: 0 });
export const unknownUsage = (): Usage => ({ input: null, output: null, cacheRead: null, usd: null });
export function addUsage(target: Usage, source: Usage): void {
  for (const key of ['input', 'output', 'cacheRead', 'usd'] as const) {
    const a = target[key], b = source[key];
    target[key] = a === null || b === null ? null : a + b;
  }
}
export interface Request {
  system: string;
  user: string;
  effort: Effort;
  jsonSchema?: object;
  signal?: AbortSignal;
}
export interface Result { text: string; data?: unknown; usage: Usage }
export class RefusalError extends Error {}
