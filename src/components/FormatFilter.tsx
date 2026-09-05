import React from 'react';

export type FormatFilter = 'all' | 'epub-only' | 'audio-available';

interface FormatCounts {
  all: number;
  epubOnly: number;
  audioAvailable: number;
}

interface FormatFilterProps {
  selectedFormat: FormatFilter;
  onFormatChange: (format: FormatFilter) => void;
  formatCounts: FormatCounts;
}

export default function FormatFilter({ selectedFormat, onFormatChange, formatCounts }: FormatFilterProps) {
  const options = [
    {
      value: 'all' as FormatFilter,
      label: 'All Formats',
      count: formatCounts.all,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
      )
    },
    {
      value: 'epub-only' as FormatFilter,
      label: 'EPUB Only',
      count: formatCounts.epubOnly,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      )
    },
    {
      value: 'audio-available' as FormatFilter,
      label: 'Audio Available',
      count: formatCounts.audioAvailable,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {options.map((option) => {
        const isSelected = selectedFormat === option.value;
        const isDisabled = option.count === 0;
        
        return (
          <button
            key={option.value}
            onClick={() => onFormatChange(option.value)}
            disabled={isDisabled}
            className={`
              inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200
              ${isSelected 
                ? 'bg-blue-600 text-white shadow-md' 
                : isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }
            `}
          >
            {option.icon}
            <span>{option.label}</span>
            <span className={`
              px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold
              ${isSelected 
                ? 'bg-white/20 text-white' 
                : isDisabled
                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-600'
                  : 'bg-white text-gray-600 dark:bg-gray-600 dark:text-gray-300'
              }
            `}>
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}