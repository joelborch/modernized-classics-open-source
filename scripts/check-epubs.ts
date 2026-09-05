import { promises as fs } from 'fs';
import path from 'path';

async function check() {
  const booksRoot = path.join(process.cwd(), 'src/content/books');
  const downloadDir = path.join(process.cwd(), 'public/downloads');
  const txtDir = path.join(process.cwd(), 'build-txt');
  const folders = await fs.readdir(booksRoot);
  for (const folder of folders) {
    const bookDir = path.join(booksRoot, folder);
    const stat = await fs.stat(bookDir).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;
    const indexPath = path.join(bookDir, 'index.md');
    const indexStat = await fs.stat(indexPath).catch(() => null);
    if (!indexStat) continue;

    try {
      const epubPath = path.join(downloadDir, `${folder}.epub`);
      await fs.access(epubPath);
      const txtPath = path.join(txtDir, `${folder}.txt`);
      await fs.access(txtPath);
    } catch (err) {
      throw new Error(`Missing outputs for ${folder}: ${err}`);
    }
  }
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
