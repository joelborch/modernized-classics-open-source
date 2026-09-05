import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { providerConfig } from './providers/cli.js';
import { PROMPTS_DIR, SETTINGS } from './config.js';
import type { BookState } from './state.js';

export interface RunConfig {
  fingerprint: string;
  details: { adapterVersion: number; provider: string; model: string; executable: string; args: string[]; settings: typeof SETTINGS; prompts: Record<string, string> };
}
export async function currentRunConfig(): Promise<RunConfig> {
  const provider = providerConfig();
  const prompts: Record<string, string> = {};
  for (const name of (await fs.readdir(PROMPTS_DIR)).filter(n => n.endsWith('.md')).sort()) {
    prompts[name] = createHash('sha256').update(await fs.readFile(path.join(PROMPTS_DIR, name))).digest('hex');
  }
  const details = { adapterVersion: 1, provider: provider.provider, model: provider.model,
    executable: provider.executable, args: provider.args, settings: SETTINGS, prompts };
  return { fingerprint: createHash('sha256').update(JSON.stringify(details)).digest('hex'), details };
}

/** Never silently label older output with a newly selected model or prompt set. */
export function bindRunConfig(state: BookState, config: RunConfig, opts: { restartSelection: boolean; adoptLegacy: boolean }): void {
  const generated = state.completed.some(s => s !== 'extract') || Object.keys(state.chunks).length > 0;
  if (!state.runConfig && generated && !opts.restartSelection && !opts.adoptLegacy) {
    throw new Error('Legacy workspace has no recorded model configuration. Use a new workspace, restart with --from select, or explicitly --adopt-run-config (prior output remains of unknown provenance).');
  }
  if (state.runConfig && state.runConfig.fingerprint !== config.fingerprint && !opts.restartSelection) {
    throw new Error('Provider, model, prompts or generation settings changed. Restart with --from select or use a new workspace; mixed output cannot resume silently.');
  }
  if (state.runConfig?.fingerprint !== config.fingerprint) {
    state.configHistory ??= [];
    state.configHistory.push({ previous: state.runConfig ?? null, next: config.fingerprint,
      reason: opts.restartSelection ? 'restart-selection' : generated ? 'explicit-legacy-adoption' : 'initial', at: new Date().toISOString() });
  }
  state.runConfig = config;
}
