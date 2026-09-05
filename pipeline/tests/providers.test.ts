// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { complete, parseResult, providerConfig } from '../src/providers/cli';
import { runCommand } from '../src/providers/process';
import { completeStructured, usageFromError } from '../src/model';
import { addUsage, zeroUsage } from '../src/providers/types';

const dirs: string[] = [];
async function executable(code: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modernize-fake-'));
  dirs.push(dir);
  const file = path.join(dir, 'fake-cli.cjs');
  await fs.writeFile(file, '#!/usr/bin/env node\n' + code, { mode: 0o700 });
  return file;
}
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });
const request = { system: 'Return a short answer', user: 'A naïve reader says “hello”.', effort: 'high' as const };

describe('CLI contracts with real subprocesses (no model accounts)', () => {
  it.each(['claude', 'codex', 'agy', 'custom'] as const)('runs %s through its wire protocol in a disposable directory', async provider => {
    const cli = await executable(`
      const fs = require('fs');
      const args = process.argv.slice(2);
      let input = '';
      process.stdin.setEncoding('utf8'); process.stdin.on('data', x => input += x);
      process.stdin.on('end', () => {
        if (${JSON.stringify(provider)} === 'claude') {
          if (args[args.indexOf('--tools') + 1] !== '') process.exit(11);
          console.log(JSON.stringify({result:input, usage:{output_tokens:3}}));
        } else if (${JSON.stringify(provider)} === 'codex') {
          if (!args.includes('read-only') || !args.includes('--ignore-user-config')) process.exit(12);
          console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:input}}));
          console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:4,output_tokens:3}}));
        } else if (${JSON.stringify(provider)} === 'agy') {
          if (!args.includes('--sandbox') || !args.includes('stream-json') || args.includes('-p')) process.exit(13);
          const r = JSON.parse(input);
          if (r.event !== 'user' || r.message.role !== 'user') process.exit(15);
          console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:r.message.content}}));
        } else {
          const r = JSON.parse(input);
          if (r.protocol !== 1 || r.model !== 'fixture-model') process.exit(14);
          console.log(JSON.stringify({protocol:1,text:r.prompt}));
        }
      });
    `);
    const result = await complete(request, { provider, model: 'fixture-model', executable: cli, args: [], timeoutMs: 5000 });
    expect(result.text).toContain(request.user);
    expect(result.usage.usd).toBeNull();
  });

  it('validates custom structured responses centrally and does not print rejected content', async () => {
    const cli = await executable("process.stdin.resume(); process.stdin.on('end',()=>console.log(JSON.stringify({protocol:1,data:{answer:'private-invalid-value'},usage:{input:7,output:3,cacheRead:0,usd:0.01}})));");
    vi.stubEnv('MODERNIZE_PROVIDER', 'custom'); vi.stubEnv('MODERNIZE_MODEL', 'fixture'); vi.stubEnv('MODERNIZE_CLI', cli);
    const error = await completeStructured({ ...request, schema: z.object({ answer: z.number() }) }).catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Structured output failed validation');
    expect(usageFromError(error)).toEqual({ input: 7, output: 3, cacheRead: 0, usd: 0.01 });
  });

  it('times out and cancels a process, bounds its output and reports startup failures', async () => {
    const config = { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], input: '', cwd: os.tmpdir(), timeoutMs: 50 };
    await expect(runCommand(config)).rejects.toThrow('timed out');
    const controller = new AbortController();
    const pending = runCommand({ ...config, timeoutMs: 5000, signal: controller.signal });
    controller.abort(); await expect(pending).rejects.toThrow('cancelled');
    const alreadyAborted = new AbortController(); alreadyAborted.abort();
    await expect(runCommand({ ...config, signal: alreadyAborted.signal })).rejects.toThrow('cancelled');
    await expect(runCommand({ ...config, timeoutMs: 5000, args: ['-e', "console.log('x'.repeat(100))"], maxBytes: 8 })).rejects.toThrow('byte limit');
    await expect(runCommand({ ...config, executable: '/nonexistent/modernize-cli' })).rejects.toThrow('Could not start');
  });

  it('preserves UTF-8 when a multi-byte character crosses output chunks', async () => {
    const out = await runCommand({ executable: process.execPath, args: ['-e', "const b=Buffer.from('é');process.stdout.write(b.subarray(0,1));setTimeout(()=>process.stdout.write(b.subarray(1)),20)"], input: '', cwd: os.tmpdir(), timeoutMs: 5000 });
    expect(out).toBe('é');
  });
});

it('requires explicit non-Claude models and distinguishes missing usage from zero', () => {
  expect(() => providerConfig({ MODERNIZE_PROVIDER: 'codex' })).toThrow('MODERNIZE_MODEL');
  expect(() => providerConfig({ MODERNIZE_CLI_ARGS: '[1]' })).toThrow('strings');
  const total = zeroUsage();
  addUsage(total, { input: 2, output: 3, cacheRead: null, usd: null });
  addUsage(total, { input: 4, output: null, cacheRead: 0, usd: 1 });
  expect(total).toEqual({ input: 6, output: null, cacheRead: null, usd: null });
});

it('rejects provider errors, refusals, missing completion and malformed envelopes', () => {
  expect(() => parseResult('claude', '{"stop_reason":"refusal"}')).toThrow('declined');
  expect(() => parseResult('agy', '{"event":"result","result":{"status":"ERROR"}}')).toThrow('failed');
  expect(() => parseResult('custom', 'hello')).toThrow('invalid JSON');
  expect(() => parseResult('custom', '{}')).toThrow('protocol');
  expect(() => parseResult('codex', '{"type":"item.completed"}')).toThrow('completed turn');
  expect(() => parseResult('codex', '{"type":"turn.failed"}')).toThrow('failed turn');
});

it('routes Gemini through AGY and reads native schema and usage', () => {
  expect(providerConfig({ MODERNIZE_PROVIDER: 'gemini', MODERNIZE_MODEL: 'fixture' })).toMatchObject({ provider: 'agy', executable: 'agy' });
  const result = parseResult('agy', JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'prose', structured_output: { ready: true }, usage: { input_tokens: 5, output_tokens: 2, cache_read_tokens: 1 } } }));
  expect(result.data).toEqual({ ready: true });
  expect(result.usage).toEqual({ input: 5, output: 2, cacheRead: 1, usd: null });
  expect(() => parseResult('agy', '{"event":"init"}')).toThrow('completed result');
});
