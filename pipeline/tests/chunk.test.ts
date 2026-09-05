// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { sliceText, chunkChapters } from '../src/chunk';

const sentence = 'This is a sentence that ends properly. ';

describe('sliceText', () => {
  it('returns the text unchanged when under the limit', () => {
    expect(sliceText('short text', 100)).toEqual(['short text']);
  });

  it('cuts at sentence boundaries and loses nothing', () => {
    const text = sentence.repeat(200).trim();
    const slices = sliceText(text, 1000);
    expect(slices.length).toBeGreaterThan(5);
    for (const s of slices) {
      expect(s.length).toBeLessThanOrEqual(1000);
      expect(s.endsWith('.')).toBe(true);
    }
    expect(slices.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('prefers paragraph gaps in the back half of the window', () => {
    const p = 'Para text here. '.repeat(20).trim();
    const text = [p, p, p, p].join('\n\n');
    const slices = sliceText(text, p.length * 2 + 10);
    expect(slices[0]).toBe([p, p].join('\n\n'));
  });
});

describe('chunkChapters', () => {
  it('assigns ids, parts, and neighbouring context', () => {
    const long = sentence.repeat(100).trim();
    const chunks = chunkChapters(
      [
        { index: 1, id: 'a', title: 'One', text: 'First chapter. Short.' },
        { index: 2, id: 'b', title: 'Two', text: long },
      ],
      { chunkChars: 1500, prevChars: 20, nextChars: 20 },
    );
    expect(chunks[0].id).toBe('ch01-p01');
    expect(chunks[0].partCount).toBe(1);
    expect(chunks[0].nextContext).toBe(long.slice(0, 20));
    expect(chunks[1].id).toBe('ch02-p01');
    expect(chunks[1].prevContext).toBe('First chapter. Short.'.slice(-20));
    expect(chunks[1].partCount).toBeGreaterThan(1);
    expect(chunks[2].prevContext).toBe(chunks[1].text.slice(-20));
    expect(chunks.at(-1)!.nextContext).toBe('');
  });
});
