import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// This checks committed/staged file policy, not copyright or secret clearance.
// Gitleaks and the provenance review are separate release requirements.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const problems = [];
for (const file of files) {
  if (/\.(epub|mobi|azw3?|zip|tar|gz|tgz|7z|rar|pdf)$/i.test(file)) {
    problems.push(`${file}: ebook, document or archive binary`);
  }
  if (/(^|\/)(dist|build-txt|llm_text_transcripts|node_modules|\.wrangler|\.astro|\.claude|\.codex|logs|\.tmp-[^/]+)(\/|$)/.test(file)
      || /^pipeline\/(input|work|logs|tmp)\/(?!\.gitkeep$)/.test(file)) {
    problems.push(`${file}: generated or private working data`);
  }
  const name = file.split('/').at(-1);
  if ((/^\.env/.test(name) && name !== '.env.example')
      || (/^\.dev\.vars/.test(name) && name !== '.dev.vars.example')
      || /\.(pem|key|p12|pfx)$/i.test(name)) {
    problems.push(`${file}: credential file`);
  }
  // Reject renamed ZIP containers too (EPUB is a ZIP container).
  if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
    const fd = fs.openSync(file, 'r');
    const magic = Buffer.alloc(8);
    try { fs.readSync(fd, magic, 0, 8, 0); } finally { fs.closeSync(fd); }
    if (magic.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) problems.push(`${file}: ZIP container`);
    if (magic.subarray(0, 5).toString() === '%PDF-') problems.push(`${file}: PDF document`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Repository file policy passed (${files.length} tracked files).`);
