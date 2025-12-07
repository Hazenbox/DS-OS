import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Id } from '../../convex/_generated/dataModel';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  projectDescription?: string;
  lastEdited?: string;
  lastEditedBy?: string;
  usageCount?: {
    tokens: number;
    components: number;
    releases: number;
  };
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  projectDescription,
  lastEdited,
  lastEditedBy,
  usageCount,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setIsDeleting(false);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (confirmText.trim() !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Failed to delete project:', error);
      setIsDeleting(false);
    }
  };

  const isDeleteEnabled = confirmText.trim() === 'DELETE' && !isDeleting;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Are you sure?
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            You're about to delete this project.
          </p>

          {/* Project Information */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Project name
                </div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  {projectName}
                </div>
                {projectDescription && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {projectDescription}
                  </div>
                )}
                {usageCount && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      {usageCount.tokens} {usageCount.tokens === 1 ? 'token' : 'tokens'}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      {usageCount.components} {usageCount.components === 1 ? 'component' : 'components'}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      {usageCount.releases} {usageCount.releases === 1 ? 'release' : 'releases'}
                    </div>
                  </div>
                )}
              </div>
              {lastEdited && (
                <div>
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Last edited
                  </div>
                  <div className="text-xs text-zinc-900 dark:text-white">
                    {new Date(lastEdited).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {lastEditedBy && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      by {lastEditedBy}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-6">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              This action cannot be undone. All tokens, components, releases, and project data will be permanently deleted.
            </div>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </label>
            <input
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isDeleteEnabled) {
                  handleDelete();
                }
                if (e.key === 'Escape') {
                  onClose();
                }
              }}
              placeholder="DELETE"
              className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isDeleteEnabled}
            className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-900 dark:disabled:hover:bg-zinc-800"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

