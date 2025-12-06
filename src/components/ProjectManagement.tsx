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
  Settings, 
  MoreVertical,
  Check,
  X,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { ProjectModal } from './ProjectModal';
import { TableSkeleton } from './LoadingSpinner';

interface ProjectMember {
  _id: Id<"projectMembers">;
  projectId: Id<"projects">;
  userId: Id<"users">;
  role: "owner" | "admin" | "editor" | "viewer";
  user: {
    email: string;
    name?: string;
    image?: string;
  } | null;
}

export const ProjectManagement: React.FC = () => {
  const { tenantId, userId } = useTenant();
  const { projectId: activeProjectId } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<Id<"projects"> | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null);
  const [showMembers, setShowMembers] = useState<Id<"projects"> | null>(null);
  const [showAddMember, setShowAddMember] = useState<Id<"projects"> | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [menuOpen, setMenuOpen] = useState<Id<"projects"> | null>(null);

  // Queries
  const projects = useQuery(
    api.projects.list,
    tenantId && userId ? { tenantId, userId } : "skip"
  ) || [];

  const projectMembers = useQuery(
    api.projectMembers.list,
    selectedProjectId && tenantId && userId
      ? { projectId: selectedProjectId, tenantId, userId }
      : "skip"
  ) as ProjectMember[] | undefined;

  // Mutations
  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.remove);
  const addMember = useMutation(api.projectMembers.add);
  const removeMember = useMutation(api.projectMembers.remove);
  const updateMemberRole = useMutation(api.projectMembers.updateRole);
  const setActiveProject = useMutation(api.projects.setActive);

  // Get tenant users for adding members
  const tenantUsers = useQuery(
    api.tenants.getUsers,
    tenantId && userId ? { tenantId, userId } : "skip"
  ) as Array<{ userId: Id<"users">; email: string; user: { email: string; name?: string } | null }> | undefined;

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

  const handleDelete = async (projectId: Id<"projects">) => {
    if (!tenantId || !userId) return;
    if (!confirm('Are you sure you want to delete this project? This will delete all tokens, components, and releases.')) return;
    try {
      await deleteProject({ id: projectId, tenantId, userId });
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. You may need admin role.');
    }
  };

  const handleAddMember = async (projectId: Id<"projects">) => {
    if (!tenantId || !userId || !newMemberEmail.trim()) return;

    // Find user by email
    const targetUser = tenantUsers?.find(u => 
      (u.user?.email || u.email).toLowerCase() === newMemberEmail.trim().toLowerCase()
    );
    if (!targetUser) {
      alert('User not found. They must be a member of your workspace first.');
      return;
    }

    try {
      await addMember({
        projectId,
        tenantId,
        userId,
        targetUserId: targetUser.userId,
        role: newMemberRole,
      });
      setNewMemberEmail('');
      setShowAddMember(null);
      setSelectedProjectId(projectId);
    } catch (error: any) {
      console.error('Failed to add member:', error);
      alert(error.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (projectId: Id<"projects">, targetUserId: Id<"users">) => {
    if (!tenantId || !userId) return;
    if (!confirm('Remove this member from the project?')) return;
    try {
      await removeMember({
        projectId,
        tenantId,
        userId,
        targetUserId,
      });
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      alert(error.message || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (
    projectId: Id<"projects">,
    targetUserId: Id<"users">,
    newRole: "owner" | "admin" | "editor" | "viewer"
  ) => {
    if (!tenantId || !userId) return;
    try {
      await updateMemberRole({
        projectId,
        tenantId,
        userId,
        targetUserId,
        role: newRole,
      });
    } catch (error: any) {
      console.error('Failed to update role:', error);
      alert(error.message || 'Failed to update role');
    }
  };

  const handleSetActive = async (projectId: Id<"projects">) => {
    if (!tenantId || !userId) return;
    try {
      await setActiveProject({ id: projectId, tenantId, userId });
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
    <div className="h-full w-full flex flex-col">
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
                        <div className="flex-1 min-w-0">
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
                              className="h-7 px-3 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md transition-colors"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setShowMembers(showMembers === project._id ? null : project._id);
                              setSelectedProjectId(showMembers === project._id ? null : project._id);
                            }}
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
                                    handleDelete(project._id);
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

                {/* Members Section */}
                {showMembers === project._id && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Members
                      </h4>
                      <button
                        onClick={() => setShowAddMember(showAddMember === project._id ? null : project._id)}
                        className="h-6 px-2 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md transition-colors flex items-center gap-1.5"
                      >
                        <UserPlus size={12} />
                        Add Member
                      </button>
                    </div>

                    {/* Add Member Form */}
                    {showAddMember === project._id && (
                      <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="email"
                            placeholder="Enter email address"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            className="flex-1 h-7 px-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <select
                            value={newMemberRole}
                            onChange={(e) => setNewMemberRole(e.target.value as any)}
                            className="h-7 px-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                          >
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleAddMember(project._id)}
                            className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => {
                              setShowAddMember(null);
                              setNewMemberEmail('');
                            }}
                            className="h-7 w-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Members List */}
                    {selectedProjectId === project._id && (
                      <div className="space-y-2">
                        {projectMembers === undefined ? (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">Loading members...</div>
                        ) : projectMembers.length === 0 ? (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">No members yet</div>
                        ) : (
                          projectMembers.map((member) => (
                            <div
                              key={member._id}
                              className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  {member.user?.email?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-zinc-900 dark:text-white truncate">
                                    {member.user?.name || member.user?.email || 'Unknown User'}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                                    {member.user?.email}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={member.role}
                                  onChange={(e) => handleUpdateRole(project._id, member.userId, e.target.value as any)}
                                  disabled={member.role === 'owner'}
                                  className="h-6 px-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="owner">Owner</option>
                                  <option value="admin">Admin</option>
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                {member.role !== 'owner' && (
                                  <button
                                    onClick={() => handleRemoveMember(project._id, member.userId)}
                                    className="h-6 w-6 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                  >
                                    <UserMinus size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
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

