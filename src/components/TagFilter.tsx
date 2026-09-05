import React from 'react';
import { X } from 'lucide-react';

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
  tagCounts: Record<string, number>;
}

export default function TagFilter({ allTags, selectedTags, onTagToggle, onClearAll, tagCounts }: TagFilterProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const count = tagCounts[tag] || 0;
          
          return (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`
                inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${isSelected
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }
              `}
            >
              {tag}
              <span className={`ml-1.5 text-xs ${isSelected ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}