/**
 * Split chapter text into rewrite-sized slices, cutting at sentence or
 * paragraph boundaries so the model never sees a mid-word break.
 */
export function sliceText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return text.trim() ? [text.trim()] : [];
  // Balance the slices: a 25k chapter with a 24k limit becomes two ~12.5k
  // slices rather than a 24k slice and a 1k orphan.
  const count = Math.ceil(text.length / maxChars);
  const limit = Math.min(maxChars, Math.ceil(text.length / count) + Math.floor(maxChars * 0.1));

  const slices: string[] = [];
  let rest = text;
  const sentenceEnd = /([.!?]["')\]]?)(?=\s)/g;

  while (rest.length > limit) {
    const head = rest.slice(0, limit);
    // Prefer the last paragraph gap in the back half of the window.
    let cut = head.lastIndexOf('\n\n');
    if (cut >= limit * 0.5) {
      cut += 2;
    } else {
      cut = -1;
      let m: RegExpExecArray | null;
      while ((m = sentenceEnd.exec(head)) !== null) cut = m.index + m[0].length;
      sentenceEnd.lastIndex = 0;
      if (cut < limit * 0.5) {
        const gap = head.lastIndexOf('\n\n');
        cut = gap >= 0 ? gap + 2 : limit;
      }
    }
    slices.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest.trim()) slices.push(rest.trim());
  return slices;
}

export interface Chapter {
  /** Stable index in reading order, 1-based. */
  index: number;
  id: string;
  title: string;
  text: string;
}

export interface Chunk {
  /** e.g. "ch03-p02" */
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  part: number;
  partCount: number;
  text: string;
  prevContext: string;
  nextContext: string;
}

export function chunkChapters(
  chapters: Chapter[],
  opts: { chunkChars: number; prevChars: number; nextChars: number },
): Chunk[] {
  const chunks: Chunk[] = [];
  chapters.forEach((ch, ci) => {
    const slices = sliceText(ch.text, opts.chunkChars);
    slices.forEach((text, pi) => {
      const prev =
        pi > 0 ? slices[pi - 1].slice(-opts.prevChars) : (chapters[ci - 1]?.text.slice(-opts.prevChars) ?? '');
      const next =
        pi < slices.length - 1
          ? slices[pi + 1].slice(0, opts.nextChars)
          : (chapters[ci + 1]?.text.slice(0, opts.nextChars) ?? '');
      chunks.push({
        id: `ch${String(ch.index).padStart(2, '0')}-p${String(pi + 1).padStart(2, '0')}`,
        chapterIndex: ch.index,
        chapterTitle: ch.title,
        part: pi + 1,
        partCount: slices.length,
        text,
        prevContext: prev,
        nextContext: next,
      });
    });
  });
  return chunks;
}
