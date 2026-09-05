import React from 'react';
import type { Book } from '../lib/search';

interface BookGridProps {
  books: Book[];
}

export default function BookGrid({ books }: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400 text-lg">No books found matching your criteria.</div>
        <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Try adjusting your search or removing some filters.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books.map((book) => (
        <div key={book.slug} className="bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden group">
          <a href={`/books/${book.slug}/`} className="block">
            <div className="aspect-[2/3] relative overflow-hidden bg-gray-100 dark:bg-slate-700">
              {book.data.optimizedCover ? (
                <img 
                  src={book.data.optimizedCover.src}
                  srcSet={book.data.optimizedCover.srcSet}
                  sizes={book.data.optimizedCover.sizes}
                  width={book.data.optimizedCover.width}
                  height={book.data.optimizedCover.height}
                  alt={book.data.coverAlt || `Cover of ${book.data.title}`}
                  className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : book.data.coverImage ? (
                <img 
                  src={book.data.coverImage.src}
                  alt={book.data.coverAlt || `Cover of ${book.data.title}`}
                  className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center ${(book.data.optimizedCover || book.data.coverImage) ? 'hidden' : 'flex'}`}>
                <div className="text-center p-4">
                  <h3 className="font-serif text-lg font-bold text-gray-800 dark:text-white mb-2 line-clamp-3">
                    {book.data.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    by {book.data.author}
                  </p>
                  {book.data.yearPublished && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Originally {book.data.yearPublished}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <div className="mb-3">
                <h3 className="font-serif font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                  {book.data.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  by {book.data.author}
                </p>
                {book.data.yearPublished && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Originally published {book.data.yearPublished}
                  </p>
                )}
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                {book.data.description}
              </p>
              
              {/* Format indicators */}
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                  EPUB
                </span>
                {book.data.audioDownload && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                    </svg>
                    AUDIO
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"></path>
                    <path d="M16.5 9.4 7.55 4.24"></path>
                    <polyline points="3.29 7 12 12 20.71 7"></polyline>
                    <line x1="12" y1="22" x2="12" y2="12"></line>
                    <circle cx="18.5" cy="15.5" r="2.5"></circle>
                    <path d="M20.27 17.27 22 19"></path>
                  </svg>
                  READ
                </span>
              </div>
              
              {book.data.tags && book.data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {book.data.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-1 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {book.data.tags.length > 2 && (
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                      +{book.data.tags.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </a>
        </div>
      ))}
    </div>
  );
}