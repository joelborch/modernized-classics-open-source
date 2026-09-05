// @vitest-environment node
import { expect, it } from 'vitest';
import { bindRunConfig, type RunConfig } from '../src/provenance';
import type { BookState } from '../src/state';
import { assertStageReady, restartFromStage } from '../src/state';

const config = { fingerprint: 'first', details: {} } as RunConfig;
const state = (): BookState => ({ slug: 'fixture', sourceEpub: '', title: '', author: '', completed: ['extract', 'rewrite'], chunks: {}, usage: {}, updatedAt: '' });

it('requires explicit adoption of old output and preserves that uncertainty in history', () => {
  const s = state();
  expect(() => bindRunConfig(s, config, { restartSelection: false, adoptLegacy: false })).toThrow('Legacy workspace');
  bindRunConfig(s, config, { restartSelection: false, adoptLegacy: true });
  expect(s.configHistory?.[0]).toMatchObject({ previous: null, reason: 'explicit-legacy-adoption' });
});
it('rejects a changed fingerprint even with legacy adoption, and records an explicit restart', () => {
  const s = state(); s.runConfig = config;
  const changed = { ...config, fingerprint: 'second' };
  expect(() => bindRunConfig(s, changed, { restartSelection: false, adoptLegacy: true })).toThrow('changed');
  expect(s.runConfig).toEqual(config);
  bindRunConfig(s, changed, { restartSelection: true, adoptLegacy: false });
  expect(s.configHistory?.[0]).toMatchObject({ previous: config, next: 'second', reason: 'restart-selection' });
});

it('prevents --from from skipping QA even if the operator requests assembly or publication', () => {
  const s = state();
  expect(() => assertStageReady(s, 'publish')).toThrow('unfinished stages');
  s.completed = ['extract', 'select', 'rewrite', 'qa', 'assemble'];
  s.chunks = { first: { rewritten: true, qa: 'flagged', revisions: 2 } };
  expect(() => assertStageReady(s, 'publish')).toThrow('passing QA');
  s.chunks.first.qa = 'pass';
  expect(() => assertStageReady(s, 'publish')).not.toThrow();
});

it('makes --from qa re-review every chunk and resets its revision budget', () => {
  const s = state();
  s.completed = ['extract', 'select', 'rewrite', 'qa', 'assemble', 'publish'];
  s.chunks = {
    first: { rewritten: true, qa: 'pass', revisions: 2, lastError: 'old failure' },
  };
  restartFromStage(s, 'qa');
  expect(s.completed).toEqual(['extract', 'select', 'rewrite']);
  expect(s.chunks.first).toEqual({ rewritten: true, qa: undefined, revisions: 0, lastError: undefined });
});
