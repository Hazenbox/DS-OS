import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  message,
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizeClasses[size]} text-violet-600 animate-spin`} />
      {message && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        {content}
      </div>
    );
  }

  return content;
};

// Skeleton loader for cards
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 p-4 rounded-lg animate-pulse">
        <div className="flex justify-between items-start mb-3">
          <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
          <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
        <div className="h-3 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>
    ))}
  </div>
);

// Skeleton loader for table rows
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
    <div className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/60 dark:border-zinc-800/60 px-4 py-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded flex-1 max-w-[100px]" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-4 py-3 flex gap-4 animate-pulse">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div 
              key={colIndex} 
              className={`h-4 bg-zinc-200 dark:bg-zinc-700 rounded ${
                colIndex === 0 ? 'w-8' : 'flex-1 max-w-[150px]'
              }`} 
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for activity timeline
export const TimelineSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex gap-3 animate-pulse">
        <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
          <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

// Skeleton for side panel files
export const FileSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 animate-pulse">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
            <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

