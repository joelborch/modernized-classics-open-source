import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

// Compare to the starting state, so this also works with intentional local edits.
const status = () => execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const fingerprint = (file) => {
  try {
    const stat = fs.lstatSync(file);
    const bytes = stat.isSymbolicLink() ? fs.readlinkSync(file) : fs.readFileSync(file);
    return `${stat.mode}:${createHash('sha256').update(bytes).digest('hex')}`;
  } catch (error) {
    if (error.code === 'ENOENT') return 'absent';
    throw error;
  }
};
const beforeStatus = status();
const before = new Map(files.map(file => [file, fingerprint(file)]));
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit' });
const changed = files.filter(file => before.get(file) !== fingerprint(file));
if (changed.length || !beforeStatus.equals(status())) {
  console.error('Build changed source files or created unignored output:', changed);
  process.exitCode = 1;
} else if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? `Build exited ${result.status}`);
  process.exitCode = 1;
} else console.log('Build passed and preserved the starting source tree.');
