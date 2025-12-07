import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { X, UserPlus, Copy, Check, Users } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: Id<"projects">;
  projectName: string;
}

type ProjectRole = "owner" | "admin" | "editor" | "viewer";

export const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const { tenantId, userId } = useTenant();
  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("editor");
  const [copied, setCopied] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const projectMembers = useQuery(
    api.projectMembers.list,
    isOpen && projectId && tenantId && userId
      ? { projectId, tenantId, userId }
      : "skip"
  ) as Array<{
    _id: Id<"projectMembers">;
    userId: Id<"users">;
    role: ProjectRole;
    user: { email: string; name?: string; image?: string } | null;
  }> | undefined;

  const tenantUsers = useQuery(
    api.tenants.getUsers,
    isOpen && tenantId && userId ? { tenantId, userId } : "skip"
  ) as Array<{
    userId: Id<"users">;
    email: string;
    user: { email: string; name?: string } | null;
  }> | undefined;

  // Mutations
  const addMember = useMutation(api.projectMembers.add);
  const removeMember = useMutation(api.projectMembers.remove);
  const updateMemberRole = useMutation(api.projectMembers.updateRole);

  useEffect(() => {
    if (isOpen) {
      setEmailInput('');
      setSelectedRole("editor");
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleAddMember = async () => {
    if (!emailInput.trim() || !tenantId || !userId) return;

    // Find user by email
    const targetUser = tenantUsers?.find(u =>
      (u.user?.email || u.email).toLowerCase() === emailInput.trim().toLowerCase()
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
        role: selectedRole,
      });
      setEmailInput('');
    } catch (error: any) {
      console.error('Failed to add member:', error);
      alert(error.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (targetUserId: Id<"users">) => {
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

  const handleUpdateRole = async (targetUserId: Id<"users">, newRole: ProjectRole) => {
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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/projects/${projectId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleLabel = (role: ProjectRole): string => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Can Admin';
      case 'editor':
        return 'Can Edit';
      case 'viewer':
        return 'Can View';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <UserPlus size={20} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Invite to Project
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Collaborate with members on this project.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Link to Share Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Link to Share
              </h3>
              <select
                className="h-7 px-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                defaultValue="anyone"
              >
                <option value="anyone">Anyone with link</option>
                <option value="members">Project members only</option>
              </select>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              Anyone with the link can access
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={`${window.location.origin}/projects/${projectId}`}
                readOnly
                className="flex-1 h-8 px-3 text-xs border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
              />
              <button
                onClick={handleCopyLink}
                className="h-8 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Email Invitation Section */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Email
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddMember();
                    }
                  }}
                  placeholder="Enter email address"
                  className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
                className="h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="viewer">Can View</option>
                <option value="editor">Can Edit</option>
                <option value="admin">Can Admin</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={!emailInput.trim()}
                className="h-8 px-4 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Invite
              </button>
            </div>
          </div>

          {/* Project Members Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-zinc-500 dark:text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Project Members
              </h3>
            </div>
            <div className="space-y-2">
              {projectMembers === undefined ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
                  Loading members...
                </div>
              ) : projectMembers.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
                  No members yet
                </div>
              ) : (
                projectMembers.map((member) => (
                  <div
                    key={member._id}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {member.user?.email?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {member.user?.name || member.user?.email || 'Unknown User'}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {member.user?.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.userId, e.target.value as ProjectRole)}
                        disabled={member.role === 'owner'}
                        className="h-7 px-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Can Admin</option>
                        <option value="editor">Can Edit</option>
                        <option value="viewer">Can View</option>
                      </select>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

