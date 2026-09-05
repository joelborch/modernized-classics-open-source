import Fuse, { type IFuseOptions } from 'fuse.js';

export type FormatFilter = 'all' | 'epub-only' | 'audio-available';

export interface FormatCounts {
  all: number;
  epubOnly: number;
  audioAvailable: number;
}

export interface Book {
  slug: string;
  data: {
    title: string;
    author: string;
    description?: string;
    tags?: string[];
    yearPublished?: number;
    yearModernized?: number;
    coverImage?: {
      src: string;
      width: number;
      height: number;
      format: string;
    };
    coverAlt?: string;
    audioDownload?: string;
    optimizedCover?: {
      src: string;
      width: number;
      height: number;
      srcSet: string;
      sizes: string;
    };
  };
}

export interface SearchOptions {
  query: string;
  selectedTags: string[];
  formatFilter?: FormatFilter;
}

const fuseOptions: IFuseOptions<Book> = {
  keys: [
    { name: 'data.title', weight: 0.4 },
    { name: 'data.author', weight: 0.3 },
    { name: 'data.description', weight: 0.2 },
    { name: 'data.tags', weight: 0.1 }
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2
};

export function searchBooks(books: Book[], options: SearchOptions): Book[] {
  let filteredBooks = books;

  // Filter by format first
  if (options.formatFilter && options.formatFilter !== 'all') {
    filteredBooks = filteredBooks.filter(book => {
      switch (options.formatFilter) {
        case 'epub-only':
          return !book.data.audioDownload;
        case 'audio-available':
          return !!book.data.audioDownload;
        default:
          return true;
      }
    });
  }

  // Filter by tags
  if (options.selectedTags.length > 0) {
    filteredBooks = filteredBooks.filter(book => 
      book.data.tags?.some(tag => options.selectedTags.includes(tag))
    );
  }

  // If no search query, return filtered results
  if (!options.query.trim()) {
    return filteredBooks;
  }

  // Perform fuzzy search on filtered results
  const fuse = new Fuse(filteredBooks, fuseOptions);
  const results = fuse.search(options.query);
  
  return results.map(result => result.item);
}

export function getAllTags(books: Book[]): string[] {
  const allTags = new Set<string>();
  
  books.forEach(book => {
    book.data.tags?.forEach(tag => allTags.add(tag));
  });
  
  return Array.from(allTags).sort();
}

export function getTagCounts(books: Book[]): Record<string, number> {
  const tagCounts: Record<string, number> = {};
  
  books.forEach(book => {
    book.data.tags?.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  return tagCounts;
}

export function getFormatCounts(books: Book[]): FormatCounts {
  const audioAvailable = books.filter(book => !!book.data.audioDownload).length;
  const epubOnly = books.filter(book => !book.data.audioDownload).length;
  
  return {
    all: books.length,
    epubOnly,
    audioAvailable
  };
}