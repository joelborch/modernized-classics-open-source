import React, { useState, useMemo } from 'react';
import SearchBar from './SearchBar';
import TagFilter from './TagFilter';
import FormatFilter, { type FormatFilter as FormatFilterType } from './FormatFilter';
import BookGrid from './BookGrid';
import { searchBooks, getAllTags, getTagCounts, getFormatCounts, type Book } from '../lib/search';

interface LibraryClientProps {
  books: Book[];
}

export default function LibraryClient({ books }: LibraryClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<FormatFilterType>('all');

  const allTags = useMemo(() => getAllTags(books), [books]);
  const tagCounts = useMemo(() => getTagCounts(books), [books]);
  const formatCounts = useMemo(() => getFormatCounts(books), [books]);

  const filteredBooks = useMemo(() => {
    return searchBooks(books, {
      query: searchQuery,
      selectedTags,
      formatFilter
    });
  }, [books, searchQuery, selectedTags, formatFilter]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleClearAllTags = () => {
    setSelectedTags([]);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setFormatFilter('all');
  };

  return (
    <div className="space-y-8">
      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-stone-200 dark:border-slate-700 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-2">
              Search Books
            </label>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by title, author, or description..."
            />
          </div>
          
          <div className="flex items-end">
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Showing {filteredBooks.length} of {books.length} books
              </div>
              {(searchQuery || selectedTags.length > 0 || formatFilter !== 'all') && (
                <button
                  onClick={handleClearAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Format Filter */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <label htmlFor="format-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Available Formats
          </label>
          <FormatFilter
            selectedFormat={formatFilter}
            onFormatChange={setFormatFilter}
            formatCounts={formatCounts}
          />
        </div>

        {/* Tag Filter */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <TagFilter
            allTags={allTags}
            selectedTags={selectedTags}
            onTagToggle={handleTagToggle}
            onClearAll={handleClearAllTags}
            tagCounts={tagCounts}
          />
        </div>
      </div>

      {/* Results */}
      <div>
        <BookGrid books={filteredBooks} />
      </div>
    </div>
  );
}