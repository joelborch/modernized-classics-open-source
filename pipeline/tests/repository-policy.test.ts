// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const roots: string[] = [];
const scripts = path.resolve(__dirname, '../../scripts');
function repo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'modernize-policy-'));
  roots.push(cwd);
  execFileSync('git', ['init', '-q'], { cwd });
  return cwd;
}
function add(cwd: string, file: string, contents: string | Buffer) {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), contents);
  execFileSync('git', ['add', file], { cwd });
}
function run(cwd: string, script: string) {
  return spawnSync(process.execPath, [path.join(scripts, script)], { cwd, encoding: 'utf8' });
}
afterEach(() => roots.splice(0).forEach(cwd => fs.rmSync(cwd, { recursive: true, force: true })));

it('allows source and example configuration but rejects source EPUBs, renamed ZIPs and scratch files', () => {
  const cwd = repo();
  add(cwd, '.env.example', '# provider configuration');
  add(cwd, 'pipeline/work/.gitkeep', '');
  add(cwd, 'src/book.md', '# Synthetic test text');
  expect(run(cwd, 'check-repository.mjs').status).toBe(0);
  add(cwd, 'source.EPUB', 'placeholder');
  add(cwd, 'renamed.bin', Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  add(cwd, 'pipeline/work/state.json', '{}');
  add(cwd, '.dev.vars', 'example');
  add(cwd, 'renamed-document.bin', '%PDF-1.7');
  add(cwd, 'llm_text_transcripts/session.md', 'private fixture');
  const result = run(cwd, 'check-repository.mjs');
  expect(result.status).toBe(1);
  for (const file of ['source.EPUB', 'renamed.bin', 'pipeline/work/state.json', '.dev.vars', 'renamed-document.bin', 'llm_text_transcripts/session.md']) expect(result.stderr).toContain(file);
});

it('allows a pure build with existing edits, but catches further edits to an already dirty file', () => {
  const cwd = repo();
  add(cwd, 'source.txt', 'original');
  add(cwd, 'package.json', JSON.stringify({ scripts: { build: 'node build.cjs' } }));
  add(cwd, 'build.cjs', '');
  fs.writeFileSync(path.join(cwd, 'source.txt'), 'intentional local edit');
  expect(run(cwd, 'verify-build.mjs').status).toBe(0);
  fs.writeFileSync(path.join(cwd, 'build.cjs'), "require('fs').writeFileSync('source.txt', 'build mutation')");
  const result = run(cwd, 'verify-build.mjs');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('source.txt');
});
