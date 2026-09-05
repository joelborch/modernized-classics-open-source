import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './process.js';
import { type Request, type Result, RefusalError } from './types.js';

export interface ProviderConfig {
  provider: 'claude' | 'codex' | 'agy' | 'custom';
  model: string;
  executable: string;
  args: string[];
  timeoutMs: number;
}
export function providerConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const requested = env.MODERNIZE_PROVIDER ?? 'claude';
  const provider = requested === 'gemini' ? 'agy' : requested;
  if (!['claude', 'codex', 'agy', 'custom'].includes(provider)) throw new Error('Unknown MODERNIZE_PROVIDER');
  const model = env.MODERNIZE_MODEL ?? (provider === 'claude' ? 'opus' : '');
  if (!model.trim()) throw new Error('Set MODERNIZE_MODEL explicitly for this provider');
  const executable = env.MODERNIZE_CLI ?? (provider === 'custom' ? '' : provider);
  if (!executable) throw new Error('Set MODERNIZE_CLI for the custom provider');
  let args: unknown;
  try { args = JSON.parse(env.MODERNIZE_CLI_ARGS ?? '[]'); } catch { throw new Error('MODERNIZE_CLI_ARGS must be a JSON array'); }
  if (!Array.isArray(args) || !args.every(x => typeof x === 'string')) throw new Error('MODERNIZE_CLI_ARGS must contain only strings');
  if (provider !== 'custom' && args.length) throw new Error('Extra CLI arguments are supported only by the custom adapter');
  const timeoutMs = Number(env.MODERNIZE_TIMEOUT_MS ?? 300_000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('MODERNIZE_TIMEOUT_MS must be a positive integer');
  return { provider: provider as ProviderConfig['provider'], model,
    executable: executable.includes('/') || executable.includes('\\') ? path.resolve(executable) : executable,
    args, timeoutMs };
}
const metric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
function object(text: string): any {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new Error('Model CLI returned an invalid JSON envelope'); }
}

export function parseResult(provider: ProviderConfig['provider'], output: string): Result {
  if (provider === 'codex') {
    const events = output.trim().split('\n').filter(Boolean).map(object);
    if (events.some(e => e.type === 'turn.failed' || e.type === 'error')) throw new Error('Codex reported a failed turn');
    const completed = [...events].reverse().find(e => e.type === 'turn.completed');
    if (!completed) throw new Error('Codex output has no completed turn');
    const message = [...events].reverse().find(e => e.type === 'item.completed' && e.item?.type === 'agent_message');
    return { text: message?.item?.text ?? '', usage: { input: metric(completed.usage?.input_tokens), output: metric(completed.usage?.output_tokens), cacheRead: metric(completed.usage?.cached_input_tokens), usd: null } };
  }
  if (provider === 'agy') {
    const events = output.trim().split('\n').filter(Boolean).map(object);
    const result = [...events].reverse().find(e => e.event === 'result')?.result;
    if (!result) throw new Error('AGY output has no completed result');
    if (result.status !== 'SUCCESS' || result.error) throw new Error('AGY reported a failed model call');
    return { text: result.response ?? '', data: result.structured_output, usage: {
      input: metric(result.usage?.input_tokens), output: metric(result.usage?.output_tokens),
      cacheRead: metric(result.usage?.cache_read_tokens), usd: null,
    } };
  }
  const result = object(output);
  if (result.refusal || result.stop_reason === 'refusal') throw new RefusalError('Model declined the request');
  if (result.error || result.is_error) throw new Error(`${provider} reported a failed model call`);
  if (provider === 'claude') {
    return { text: result.result ?? '', data: result.structured_output, usage: {
      input: metric(result.usage?.input_tokens), output: metric(result.usage?.output_tokens),
      cacheRead: metric(result.usage?.cache_read_input_tokens), usd: metric(result.total_cost_usd),
    } };
  }
  if (result.protocol !== 1) throw new Error('Custom CLI response must declare protocol: 1');
  return { text: result.text ?? '', data: result.data, usage: {
    input: metric(result.usage?.input), output: metric(result.usage?.output),
    cacheRead: metric(result.usage?.cacheRead), usd: metric(result.usage?.usd),
  } };
}

export async function complete(request: Request, config = providerConfig()): Promise<Result> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'modernize-model-'));
  try {
    let args: string[];
    let input = request.user;
    const env = { ...process.env };
    const combined = `${request.system}\n\nRespond only with the requested output; do not use tools.\n${request.jsonSchema ? `Return JSON conforming to this schema: ${JSON.stringify(request.jsonSchema)}\n` : ''}\n${request.user}`;
    if (config.provider === 'claude') {
      args = ['-p', '--output-format', 'json', '--model', config.model, '--effort', request.effort,
        '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
        '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence', '--system-prompt', request.system];
      if (request.jsonSchema) args.push('--json-schema', JSON.stringify(request.jsonSchema));
    } else if (config.provider === 'codex') {
      args = ['exec', '--json', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check',
        '--sandbox', 'read-only', '-c', 'approval_policy="never"', '-c', 'features.shell_tool=false',
        '--model', config.model, '-c', `model_reasoning_effort=${JSON.stringify(request.effort)}`];
      if (request.jsonSchema) {
        const file = path.join(cwd, 'schema.json');
        await fs.writeFile(file, JSON.stringify(request.jsonSchema));
        args.push('--output-schema', file);
      }
      args.push('-'); input = combined;
    } else if (config.provider === 'agy') {
      if (!['low', 'medium', 'high'].includes(request.effort)) throw new Error('AGY effort must be low, medium, or high');
      args = ['--input-format', 'stream-json', '--output-format', 'stream-json',
        '--model', config.model, '--effort', request.effort, '--sandbox', '--disable-slash-commands'];
      if (request.jsonSchema) args.push('--json-schema', JSON.stringify(request.jsonSchema));
      input = JSON.stringify({ event: 'user', message: { role: 'user', content: combined } }) + '\n';
    } else {
      args = config.args;
      input = JSON.stringify({ protocol: 1, model: config.model, system: request.system, prompt: request.user,
        effort: request.effort, schema: request.jsonSchema ?? null }) + '\n';
    }
    const output = await runCommand({ executable: config.executable, args, input, cwd, env,
      timeoutMs: config.timeoutMs, signal: request.signal });
    const result = parseResult(config.provider, output);
    if (typeof result.text !== 'string') throw new Error('Model text response must be a string');
    return result;
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
}
