// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { validateSlug, getWorkRoot, PIPELINE_DIR } from '../src/config';
import { Workspace, slugify } from '../src/state';

describe('validateSlug', () => {
  it('accepts valid canonical slugs', () => {
    expect(validateSlug('walden')).toBe('walden');
    expect(validateSlug('the-great-gatsby')).toBe('the-great-gatsby');
    expect(validateSlug('1984')).toBe('1984');
    expect(validateSlug('book-123-abc')).toBe('book-123-abc');
  });

  it('rejects path traversal attempts', () => {
    expect(() => validateSlug('..')).toThrow(/path traversal/);
    expect(() => validateSlug('../walden')).toThrow(/path traversal/);
    expect(() => validateSlug('walden/..')).toThrow(/path traversal/);
    expect(() => validateSlug('sub/slug')).toThrow(/path traversal/);
    expect(() => validateSlug('sub\\slug')).toThrow(/path traversal/);
    expect(() => validateSlug('..\\walden')).toThrow(/path traversal/);
  });

  it('rejects non-canonical slug formats', () => {
    expect(() => validateSlug('')).toThrow(/non-empty/);
    expect(() => validateSlug('Walden')).toThrow(/must match pattern/);
    expect(() => validateSlug('-leading-hyphen')).toThrow(/must match pattern/);
    expect(() => validateSlug('trailing-hyphen-')).toThrow(/must match pattern/);
    expect(() => validateSlug('double--hyphen')).toThrow(/must match pattern/);
    expect(() => validateSlug('with space')).toThrow(/must match pattern/);
    expect(() => validateSlug('special@char')).toThrow(/must match pattern/);
    expect(() => validateSlug('walden.epub')).toThrow(/must match pattern/);
  });

  it('slugify normalizes and validates titles', () => {
    expect(slugify('The Great Gatsby')).toBe('the-great-gatsby');
    expect(slugify('Café & Restaurant')).toBe('cafe-restaurant');
    expect(() => slugify('---')).toThrow();
  });
});

describe('getWorkRoot', () => {
  const originalEnv = process.env.MODERNIZE_WORK_ROOT;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MODERNIZE_WORK_ROOT = originalEnv;
    } else {
      delete process.env.MODERNIZE_WORK_ROOT;
    }
  });

  it('defaults to pipeline/work in repository', () => {
    delete process.env.MODERNIZE_WORK_ROOT;
    expect(getWorkRoot()).toBe(path.join(PIPELINE_DIR, 'work'));
  });

  it('respects MODERNIZE_WORK_ROOT environment variable', () => {
    process.env.MODERNIZE_WORK_ROOT = '/custom/env/work';
    expect(getWorkRoot()).toBe(path.resolve('/custom/env/work'));
  });

  it('prioritizes explicit custom work root argument', () => {
    process.env.MODERNIZE_WORK_ROOT = '/custom/env/work';
    expect(getWorkRoot('/explicit/arg/work')).toBe(path.resolve('/explicit/arg/work'));
  });

  it('Workspace uses provided work root or default', () => {
    delete process.env.MODERNIZE_WORK_ROOT;
    const wsDefault = new Workspace('test-slug');
    expect(wsDefault.workRoot).toBe(path.join(PIPELINE_DIR, 'work'));
    expect(wsDefault.dir).toBe(path.join(PIPELINE_DIR, 'work', 'test-slug'));

    const wsCustom = new Workspace('test-slug', '/custom/work/path');
    expect(wsCustom.workRoot).toBe(path.resolve('/custom/work/path'));
    expect(wsCustom.dir).toBe(path.join(path.resolve('/custom/work/path'), 'test-slug'));
  });

  it('Workspace rejects invalid slugs on instantiation', () => {
    expect(() => new Workspace('../invalid')).toThrow(/path traversal/);
    expect(() => new Workspace('Invalid Slug')).toThrow(/must match pattern/);
  });
});
