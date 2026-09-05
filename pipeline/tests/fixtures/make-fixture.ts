// Synthetic test content, licensed under the repository's MIT license.
// Generate into a caller-owned temporary directory; never commit EPUB binaries.
import fs from 'node:fs/promises';
import { createEpub } from '../../../scripts/epub-package.js';

const para = (n: number, seed: string) =>
  Array.from({ length: n }, (_, i) => `<p>${seed} Sentence ${i + 1} of the passage, which continues at some length so that chunking has material to work with. It is, hitherto, an utterly archaic manner of expression!</p>`).join('\n');

export async function makeFixture(output: string): Promise<void> {
  const epub = createEpub({
    title: 'A Treatise on Testing',
    author: 'Ada Fixture',
    tocTitle: 'Contents',
    chapters: [
      { title: 'Title Page', html: '<p>A Treatise on Testing</p><p>By Ada Fixture</p>', includeInToc: false },
      { title: 'Publisher Preface', html: para(6, 'The publisher preface observes background context.') },
      { title: 'Chapter I. On Beginnings', html: para(40, 'In the beginning there was the beginning.') },
      { title: 'Chapter II. On Middles', html: para(120, 'The middle is where most of the work happens.') },
      { title: 'Chapter III. On Endings', html: para(30, 'All things that begin must also end.') },
      { title: 'Notes', html: '<p>1. A note.</p><p>2. Another note.</p>' }
    ]
  });
  await fs.writeFile(output, epub);
}
