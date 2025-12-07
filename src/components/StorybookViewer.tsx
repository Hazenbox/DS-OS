import React, { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface StorybookViewerProps {
  componentName?: string;
}

export const StorybookViewer: React.FC<StorybookViewerProps> = ({ componentName }) => {
  const { projectId } = useProject();
  const { tenantId, userId } = useTenant();
  const [storyCode, setStoryCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get component by name
  const components = useQuery(
    api.components.list,
    projectId && tenantId && userId
      ? {
          projectId,
          tenantId,
          userId,
        }
      : 'skip'
  );

  useEffect(() => {
    if (!componentName || !components) {
      setIsLoading(false);
      return;
    }

    const component = components.find((c) => c.name === componentName);
    if (component && component.storybook) {
      setStoryCode(component.storybook);
      setIsLoading(false);
    } else if (component && !component.storybook) {
      setError('Storybook story not available for this component');
      setIsLoading(false);
    } else {
      setError('Component not found');
      setIsLoading(false);
    }
  }, [componentName, components]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-violet-600" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{error}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Make sure the component has been extracted and saved.
          </p>
        </div>
      </div>
    );
  }

  if (!storyCode) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            No Storybook story available
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Extract a component from Figma to generate a Storybook story.
          </p>
        </div>
      </div>
    );
  }

  // Render Storybook story in an iframe or embedded view
  // For now, show the story code with instructions
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Storybook: {componentName}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Component documentation and interactive playground
          </p>
        </div>
        <a
          href="/builder"
          className="text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 flex items-center gap-1.5"
        >
          <ExternalLink size={14} />
          Back to Builder
        </a>
      </div>

      {/* Story Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
              <strong>Note:</strong> Full Storybook integration is in progress. For now, you can:
            </p>
            <ol className="text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside space-y-1">
              <li>Copy the story code below</li>
              <li>Save it to <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">src/stories/{componentName}.stories.tsx</code></li>
              <li>Run <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">npm run storybook</code> to view it</li>
            </ol>
          </div>

          <div className="bg-zinc-950 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Storybook Story Code
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(storyCode)}
                className="text-xs text-zinc-400 hover:text-zinc-300 flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
              >
                Copy Code
              </button>
            </div>
            <pre className="text-xs text-zinc-300 font-mono overflow-x-auto">
              <code>{storyCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

