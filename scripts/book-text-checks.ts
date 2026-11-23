// Content checks for modernized book markdown. These catch the ways the
// modernization pipeline has gone wrong before: model refusals or notes about
// the prompt published as prose, chunks stitched in twice, and chapters or
// numbered books that run backwards or repeat.

export interface BookTextProblem {
  kind: 'leftover' | 'duplicate' | 'numbering';
  line: number;
  detail: string;
}

export interface BookTextAllowance {
  /** Problem kind this allowance covers. */
  kind: BookTextProblem['kind'];
  /** The offending line must start with this text (after trimming). */
  startsWith: string;
  /** Why this is acceptable. Required so every exception is explained. */
  reason: string;
}

const LEFTOVER_PATTERNS: RegExp[] = [
  /\b(I'm|I am) (only |just )?a language model\b/i,
  /\bas an AI\b/i,
  /\bI'm (unable|not able) to (help|assist)\b/i,
  /\bI can't (help|assist) (you )?with that\b/i,
  /\bI'm designed solely to process\b/i,
  /^The (rest of the )?provided (text|passage|excerpt|section|chunk)\b/i,
  /\b(project guidelines|Mission Objective)\b/,
  /\bno rewrite of this (footnote )?material\b/i,
  /^(Okay|Sure|Certainly),? (I'm|I am|I'll|here is|here's) (ready|the (rewritten|modernized|simplified))/i,
  /\bI'm ready to (simplify|rewrite|modernize)\b/i,
  /\b(this|the) (chunk|submission) (you|provided)\b/i,
  /^Here is the (continued|final|rest of the)? ?(simplified |modernized )?rewrite\b/i,
  /\bsimplified rewrite\b/i,
  /\boriginal prompt\b/i,
  /\bThe original text (implies|refers to|provides|does not)\b/i,
  /\b(which were in the original text but are summarized here|based on the author's (textual )?description)\b/i,
  /^(Okay|Alright),? let's continue\b/i,
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function romanToInt(s: string): number | null {
  if (!/^[ivxlcdm]+$/i.test(s)) return null;
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let total = 0;
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const cur = v[lower[i]];
    const next = v[lower[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

function parseNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  const word = NUMBER_WORDS[token.toLowerCase()];
  if (word) return word;
  return romanToInt(token);
}

/** Headings like "## Book 7", "## Chapter XII", "### Lecture Three". */
const SEQUENCE_HEADING = /^(#{1,4})\s+\**(Book|Chapter|Lecture|Part|Essay)\s+([0-9]+|[IVXLCDM]+|[A-Za-z]+)\b/i;

function normalizeParagraph(line: string): string {
  return line.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim();
}

function stripFrontmatter(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return 0;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  return end === -1 ? 0 : end + 1;
}

export function checkBookText(markdown: string, allowances: BookTextAllowance[] = []): BookTextProblem[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = stripFrontmatter(lines);
  const problems: BookTextProblem[] = [];
  const seen = new Map<string, number>();
  const lastNumber = new Map<string, { n: number; line: number }>();

  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const lineNo = i + 1;

    for (const pattern of LEFTOVER_PATTERNS) {
      if (pattern.test(line)) {
        problems.push({ kind: 'leftover', line: lineNo, detail: line.slice(0, 120) });
        break;
      }
    }

    const norm = normalizeParagraph(line);
    if (norm.length >= 160) {
      const key = norm.slice(0, 120);
      const first = seen.get(key);
      if (first !== undefined) {
        problems.push({ kind: 'duplicate', line: lineNo, detail: `repeats line ${first}: ${line.slice(0, 100)}` });
      } else {
        seen.set(key, lineNo);
      }
    }

    // Any heading restarts numbering for the levels below it (chapters restart
    // under each new Book or Part).
    const level = /^(#{1,6})\s/.exec(line)?.[1].length;
    if (level) {
      for (const series of [...lastNumber.keys()]) {
        if (series.split(' ')[0].length > level) lastNumber.delete(series);
      }
    }

    const heading = SEQUENCE_HEADING.exec(line);
    if (heading) {
      // A new Part or Book restarts chapter-level numbering at any level.
      const kind = heading[2].toLowerCase();
      if (kind === 'part' || kind === 'book') {
        for (const series of [...lastNumber.keys()]) {
          const k = series.split(' ')[1];
          if (k !== kind && !(kind === 'book' && k === 'part')) lastNumber.delete(series);
        }
      }
      const n = parseNumber(heading[3]);
      if (n !== null) {
        const series = `${heading[1]} ${heading[2].toLowerCase()}`;
        const prev = lastNumber.get(series);
        if (prev && n <= prev.n) {
          problems.push({
            kind: 'numbering',
            line: lineNo,
            detail: `${heading[2]} ${heading[3]} follows ${heading[2]} ${prev.n} at line ${prev.line}`,
          });
        }
        lastNumber.set(series, { n, line: lineNo });
      }
    }
  }

  return problems.filter(p => !allowances.some(a =>
    a.kind === p.kind && lines[p.line - 1].trim().startsWith(a.startsWith)));
}

/**
 * Share of body text written as bullet points. Older pipeline runs sometimes
 * turned prose into lecture-note outlines; real book prose has few bullets.
 */
export function bulletShare(markdown: string): { bullets: number; blocks: number; share: number } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let bullets = 0;
  let blocks = 0;
  for (let i = stripFrontmatter(lines); i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line) || /^\s*(\||---|>)/.test(line)) continue;
    blocks++;
    if (/^\s*[*+-]\s/.test(line)) bullets++;
  }
  return { bullets, blocks, share: blocks ? bullets / blocks : 0 };
}

/** Above this share of bulleted lines, a book reads as an outline rather than prose. */
export const MAX_BULLET_SHARE = 0.06;
