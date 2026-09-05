/** Explicit opt-in integration smoke test. Never called by CI. */
import { z } from 'zod';
import { completeText, completeStructured } from '../pipeline/src/model.js';
import { providerConfig } from '../pipeline/src/providers/cli.js';

if (!process.argv.includes('--live')) {
  console.error('Live smoke tests consume your configured model account. Pass --live explicitly.');
  process.exitCode = 1;
} else {
  const config = providerConfig();
  const opts = { system: 'Follow the instruction exactly. Do not use tools.', effort: 'low' as const };
  const text = await completeText({ ...opts, user: 'Return only the word READY.' });
  if (text.text.trim() !== 'READY') throw new Error('Text smoke test did not return READY');
  const result = await completeStructured({ ...opts, user: 'Return ready=true.', schema: z.object({ ready: z.boolean() }) });
  if (!result.data.ready) throw new Error('Structured smoke test did not return ready=true');
  console.log(JSON.stringify({ provider: config.provider, requestedModel: config.model, text: 'passed', structured: 'passed', usage: [text.usage, result.usage] }));
}
