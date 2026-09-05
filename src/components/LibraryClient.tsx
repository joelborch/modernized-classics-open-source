import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';

export interface LibraryBook {
  slug: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  year?: number;
  yearLabel?: string;
  minutes: number;
  length: string;
  audio: boolean;
  epub: string;
  shelf: string;
  series?: string;
  cover?: { src: string; srcSet: string; width: number; height: number };
  coverAlt?: string;
}

interface Props {
  books: LibraryBook[];
  shelves: { id: string; title: string }[];
}

type View = 'covers' | 'spines';
type Sort = 'title' | 'year' | 'length';
type Format = 'all' | 'audio';

const STORAGE_VIEW = 'mc-library-view';

export default function LibraryClient({ books, shelves }: Props) {
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState<string>('all');
  const [format, setFormat] = useState<Format>('all');
  const [sort, setSort] = useState<Sort>('title');
  const [view, setView] = useState<View>('covers');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VIEW);
      if (saved === 'covers' || saved === 'spines') setView(saved);
    } catch { /* ignore */ }
  }, []);

  const changeView = (next: View) => {
    setView(next);
    try { localStorage.setItem(STORAGE_VIEW, next); } catch { /* ignore */ }
  };

  const fuse = useMemo(() => new Fuse(books, {
    keys: [
      { name: 'title', weight: 0.45 },
      { name: 'author', weight: 0.35 },
      { name: 'tags', weight: 0.12 },
      { name: 'description', weight: 0.08 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  }), [books]);

  const results = useMemo(() => {
    let list = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : books;
    if (shelf !== 'all') list = list.filter((b) => b.shelf === shelf);
    if (format === 'audio') list = list.filter((b) => b.audio);
    if (!query.trim() || sort !== 'title') {
      list = [...list].sort((a, b) => {
        if (sort === 'year') return (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title, 'en');
        if (sort === 'length') return a.minutes - b.minutes || a.title.localeCompare(b.title, 'en');
        return a.title.localeCompare(b.title, 'en');
      });
    }
    return list;
  }, [books, fuse, query, shelf, format, sort]);

  const filtered = query.trim() !== '' || shelf !== 'all' || format !== 'all';
  const clear = () => { setQuery(''); setShelf('all'); setFormat('all'); };

  return (
    <div className="library">
      <div className="library-controls">
        <label className="library-search">
          <span className="t-label">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, author, or subject"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="library-filter" role="group" aria-label="Subject">
          <span className="t-label">Subject</span>
          <div className="chips">
            <button type="button" aria-pressed={shelf === 'all'} onClick={() => setShelf('all')}>All</button>
            {shelves.map((s) => (
              <button key={s.id} type="button" aria-pressed={shelf === s.id} onClick={() => setShelf(s.id)}>{s.title}</button>
            ))}
          </div>
        </div>

        <div className="library-row">
          <div className="library-filter" role="group" aria-label="Format">
            <span className="t-label">Format</span>
            <div className="chips">
              <button type="button" aria-pressed={format === 'all'} onClick={() => setFormat('all')}>Read and EPUB</button>
              <button type="button" aria-pressed={format === 'audio'} onClick={() => setFormat('audio')}>With audio</button>
            </div>
          </div>
          <label className="library-filter library-sort">
            <span className="t-label">Order</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="title">By title</option>
              <option value="year">Oldest first</option>
              <option value="length">Shortest first</option>
            </select>
          </label>
          <div className="library-filter" role="group" aria-label="View">
            <span className="t-label">View</span>
            <div className="chips">
              <button type="button" aria-pressed={view === 'covers'} onClick={() => changeView('covers')}>Covers</button>
              <button type="button" aria-pressed={view === 'spines'} onClick={() => changeView('spines')}>Spines</button>
            </div>
          </div>
        </div>
      </div>

      <p className="library-count t-meta" aria-live="polite">
        {results.length === books.length ? `${books.length} editions` : `${results.length} of ${books.length} editions`}
        {filtered && (
          <>
            {' · '}
            <button type="button" className="library-clear" onClick={clear}>Show all</button>
          </>
        )}
      </p>

      {results.length === 0 ? (
        <div className="library-empty t-text">
          <p>Nothing on the shelf matches <em>{query.trim() || 'those filters'}</em>.</p>
          <p className="t-meta">Try an author’s surname, or <button type="button" className="library-clear" onClick={clear}>show every edition</button>.</p>
        </div>
      ) : view === 'covers' ? (
        <ul className="library-grid">
          {results.map((book) => (
            <li key={book.slug} style={{ ['--series' as string]: book.series ?? 'var(--ink-8)' }}>
              <a href={`/books/${book.slug}/`} className="cover-link library-item">
                <span className="cover">
                  {book.cover ? (
                    <img
                      src={book.cover.src}
                      srcSet={book.cover.srcSet}
                      sizes="(min-width: 1024px) 170px, (min-width: 640px) 22vw, 42vw"
                      width={book.cover.width}
                      height={book.cover.height}
                      alt={book.coverAlt || `Cover of ${book.title}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="library-board t-text"><span>{book.title}</span></span>
                  )}
                </span>
                <span className="library-item-title t-text">{book.title}</span>
                <span className="library-item-meta t-meta">
                  {book.author}{book.yearLabel ? `, ${book.yearLabel}` : ''}
                </span>
                <span className="library-item-meta t-meta">{book.length}{book.audio ? ' · audio' : ''}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="spines">
          {results.map((book) => (
            <li key={book.slug} style={{ ['--series' as string]: book.series ?? 'var(--ink-8)' }}>
              <a href={`/books/${book.slug}/`} className="spine">
                <span className="spine-band" aria-hidden="true" />
                <span className="spine-title t-text">{book.title}</span>
                <span className="spine-author t-meta">{book.author}</span>
                <span className="spine-year t-meta">{book.yearLabel ?? ''}</span>
                <span className="spine-length t-meta">{book.length}</span>
                <span className="spine-formats t-meta">EPUB{book.audio ? ' · MP3' : ''}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
