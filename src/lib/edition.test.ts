import { describe, expect, it } from 'vitest';
import { chaptersFrom } from './edition';

describe('source-edition contents', () => {
  it('keeps a first essay at level one with the following essays in source order', () => {
    const headings = [
      { depth: 1, slug: 'civil-disobedience', text: 'On the Duty of Civil Disobedience' },
      ...['Slavery in Massachusetts', 'A Plea for Captain John Brown', 'Walking', 'Life Without Principle']
        .map((text, index) => ({ depth: 2, slug: `essay-${index}`, text })),
    ];
    const chapters = chaptersFrom(headings, 'Civil Disobedience and Other Essays');
    expect(chapters.map(chapter => chapter.text)).toEqual(headings.map(heading => heading.text));
    expect(chapters.map(chapter => chapter.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it('omits a repeated book title and retains the level-three fallback', () => {
    const chapters = chaptersFrom([
      { depth: 1, slug: 'title', text: 'A Book' },
      { depth: 2, slug: 'title-again', text: 'A Book' },
      { depth: 3, slug: 'first', text: 'First' },
      { depth: 3, slug: 'second', text: 'Second' },
    ], 'A Book');
    expect(chapters.map(chapter => chapter.slug)).toEqual(['first', 'second']);
  });
});
