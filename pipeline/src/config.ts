import path from 'node:path';
import type { Effort } from './providers/types.js';
import { fileURLToPath } from 'node:url';

/** Strict slug regex: lowercase alphanumeric words separated by single hyphens. */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validate a slug string, rejecting path traversal and non-canonical formats. */
export function validateSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') {
    throw new Error('Invalid slug: slug must be a non-empty string');
  }
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    throw new Error(`Invalid slug "${slug}": path traversal characters (.., /, \\) are not allowed`);
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`Invalid slug "${slug}": must match pattern ^[a-z0-9]+(?:-[a-z0-9]+)*$`);
  }
  return slug;
}

/** Repo root (the Astro project). The pipeline lives at <root>/pipeline. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PIPELINE_DIR = path.join(ROOT, 'pipeline');
export const PROMPTS_DIR = path.join(PIPELINE_DIR, 'prompts');

/** Resolve work root based on custom argument, MODERNIZE_WORK_ROOT env, or default pipeline/work. */
export function getWorkRoot(customWorkRoot?: string): string {
  if (customWorkRoot) return path.resolve(customWorkRoot);
  if (process.env.MODERNIZE_WORK_ROOT) return path.resolve(process.env.MODERNIZE_WORK_ROOT);
  return path.join(PIPELINE_DIR, 'work');
}

export const WORK_ROOT = getWorkRoot();
export const BOOKS_DIR = path.join(ROOT, 'src', 'content', 'books');

/** Tunables. Override via environment to experiment without editing code. */
export const SETTINGS = {
  /** Max characters of source text per rewrite request. */
  chunkChars: num('MODERNIZE_CHUNK_CHARS', 24_000),
  /** Characters of neighbouring text supplied as continuity context. */
  contextPrevChars: 400,
  contextNextChars: 500,
  /** Characters of preview shown per spine item in the selection catalogue. */
  previewChars: 300,
  /** Provider-specific effort hints. Gemini ignores these; see provider documentation. */
  effort: {
    select: effort('MODERNIZE_EFFORT_SELECT', 'high'),
    rewrite: effort('MODERNIZE_EFFORT_REWRITE', 'high'),
    qa: effort('MODERNIZE_EFFORT_QA', 'medium'),
    revise: effort('MODERNIZE_EFFORT_REVISE', 'high'),
    frontmatter: effort('MODERNIZE_EFFORT_FRONTMATTER', 'low'),
  } as const,
  /** How many QA→revise rounds a chunk gets before it is flagged for a human. */
  maxRevisions: 2,
};

function num(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const n = raw ? Number(raw) : NaN;
  if (!raw) return fallback;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${envKey} must be a positive integer`);
  return n;
}


function effort(key: string, fallback: Effort): Effort {
  const value = process.env[key] ?? fallback;
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(value)) throw new Error(`${key} has an unsupported effort`);
  return value as Effort;
}
