import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { 
  FolderOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  MoreVertical,
  Check,
  X,
  ArrowRight
} from 'lucide-react';
import { ProjectModal } from './ProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { InviteMembersModal } from './InviteMembersModal';
import { TableSkeleton } from './LoadingSpinner';

interface ProjectManagementProps {
  onProjectSelect?: (projectId: Id<"projects">) => void;
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({ onProjectSelect }) => {
  const { tenantId, userId } = useTenant();
  const { projectId: activeProjectId } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<Id<"projects"> | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteProjectId, setDeleteProjectId] = useState<Id<"projects"> | null>(null);
  const [inviteProjectId, setInviteProjectId] = useState<Id<"projects"> | null>(null);
  const [menuOpen, setMenuOpen] = useState<Id<"projects"> | null>(null);

  // Queries
  const projects = useQuery(
    api.projects.list,
    tenantId && userId ? { tenantId, userId } : "skip"
  ) || [];

  // Get stats for delete modal
  const projectStats = useQuery(
    api.projects.getStats,
    deleteProjectId && tenantId && userId
      ? { projectId: deleteProjectId, tenantId, userId }
      : "skip"
  );

  // Get project details for delete modal
  const projectToDelete = deleteProjectId
    ? projects.find(p => p._id === deleteProjectId)
    : null;

  // Mutations
  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.remove);
  const setActiveProject = useMutation(api.projects.setActive);

  const handleRename = async (projectId: Id<"projects">) => {
    if (!editingName.trim() || !tenantId || !userId) return;
    try {
      await updateProject({
        id: projectId,
        tenantId,
        userId,
        name: editingName.trim(),
      });
      setEditingProjectId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to rename project:', error);
      alert('Failed to rename project');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProjectId || !tenantId || !userId) return;
    try {
      await deleteProject({ id: deleteProjectId, tenantId, userId });
      setDeleteProjectId(null);
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      alert(error.message || 'Failed to delete project. You may need admin role.');
    }
  };

  const handleSetActive = async (projectId: Id<"projects">) => {
    if (!tenantId || !userId) return;
    try {
      await setActiveProject({ id: projectId, tenantId, userId });
      // Navigate to dashboard when project is selected
      if (onProjectSelect) {
        onProjectSelect(projectId);
      }
    } catch (error) {
      console.error('Failed to set active project:', error);
    }
  };

  const isLoading = projects === undefined && tenantId && userId;

  if (isLoading) {
    return (
      <div className="h-full w-full p-8">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Projects</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Manage your design system projects
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FolderOpen size={48} className="text-zinc-400 dark:text-zinc-500 mb-4" />
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              No projects yet
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Create your first project to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${project.isActive ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                    {editingProjectId === project._id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(project._id);
                            if (e.key === 'Escape') {
                              setEditingProjectId(null);
                              setEditingName('');
                            }
                          }}
                          className="flex-1 h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(project._id)}
                          className="h-8 w-8 flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingProjectId(null);
                            setEditingName('');
                          }}
                          className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSetActive(project._id)}>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                              {project.name}
                            </h3>
                            {project.isActive && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Active
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!project.isActive && (
                            <button
                              onClick={() => handleSetActive(project._id)}
                              className="h-7 px-3 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md transition-colors flex items-center gap-1.5"
                            >
                              Open
                              <ArrowRight size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setInviteProjectId(project._id)}
                            className="h-7 px-3 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-1.5"
                          >
                            <Users size={14} />
                            Members
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setMenuOpen(menuOpen === project._id ? null : project._id)}
                              className="h-7 w-7 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuOpen === project._id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 py-1">
                                <button
                                  onClick={() => {
                                    setEditingProjectId(project._id);
                                    setEditingName(project.name);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                                >
                                  <Edit2 size={14} />
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteProjectId(project._id);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && tenantId && userId && (
        <ProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          tenantId={tenantId}
          userId={userId}
        />
      )}

      {/* Delete Project Modal */}
      {deleteProjectId && projectToDelete && (
        <DeleteProjectModal
          isOpen={!!deleteProjectId}
          onClose={() => setDeleteProjectId(null)}
          onConfirm={handleDeleteConfirm}
          projectName={projectToDelete.name}
          projectDescription={projectToDelete.description}
          lastEdited={projectToDelete.updatedAt ? new Date(projectToDelete.updatedAt).toISOString() : undefined}
          usageCount={projectStats ? {
            tokens: projectStats.tokens,
            components: projectStats.components,
            releases: projectStats.releases,
          } : undefined}
        />
      )}

      {/* Invite Members Modal */}
      {inviteProjectId && (
        <InviteMembersModal
          isOpen={!!inviteProjectId}
          onClose={() => setInviteProjectId(null)}
          projectId={inviteProjectId}
          projectName={projects.find(p => p._id === inviteProjectId)?.name || 'Project'}
        />
      )}

      {/* Close menu on outside click */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
};
