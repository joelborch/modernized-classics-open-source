import { spawn } from 'node:child_process';

export interface Command {
  executable: string;
  args: string[];
  input: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBytes?: number;
  signal?: AbortSignal;
}

/** No shell interpolation; bound output and lifetime, and reap children before cleanup. */
export function runCommand(command: Command): Promise<string> {
  return new Promise((resolve, reject) => {
    if (command.signal?.aborted) return reject(new Error('Model call cancelled'));
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd, env: command.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32',
    });
    let output = '';
    let bytes = 0;
    let failure: Error | undefined;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform === 'win32') child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure ??= error as Error;
      }
    };
    const stop = (message: string) => {
      if (failure) return;
      failure = new Error(message);
      kill('SIGTERM');
      escalation = setTimeout(() => kill('SIGKILL'), 1000);
    };
    const abort = () => stop('Model call cancelled');
    const timer = setTimeout(() => stop(`Model call timed out after ${command.timeoutMs}ms`), command.timeoutMs);
    command.signal?.addEventListener('abort', abort, { once: true });
    // Close the race between the pre-spawn check and listener registration.
    if (command.signal?.aborted) abort();
    const cleanup = () => {
      clearTimeout(timer);
      if (escalation) clearTimeout(escalation);
      command.signal?.removeEventListener('abort', abort);
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      bytes += Buffer.byteLength(data);
      if (bytes > (command.maxBytes ?? 8_000_000)) stop('Model output exceeded byte limit');
      else output += data;
    });
    // Do not include provider logs in errors: they may contain prompts or credentials.
    child.stderr.on('data', (data: Buffer) => {
      bytes += data.length;
      if (bytes > (command.maxBytes ?? 8_000_000)) stop('Model output exceeded byte limit');
    });
    child.stdin.on('error', () => stop('Model CLI closed its input stream'));
    child.on('error', (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(new Error(`Could not start model CLI (${error.code ?? 'unknown error'}). Check the executable and local login.`));
    });
    child.on('close', (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Model CLI exited with status ${code}; check its local installation and authentication.`));
      else resolve(output);
    });
    child.stdin.end(command.input);
  });
}
