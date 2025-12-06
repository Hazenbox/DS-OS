import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { convexComponentToLegacy, convexActivityToLegacy } from '../types';
import { CheckCircle, GitBranch, Package, Palette, Clock, ChevronRight, Plus, Edit2, Trash2, Download, Upload, Rocket, Filter } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { CardSkeleton, TimelineSkeleton } from './LoadingSpinner';

// Action icons and colors
const ACTION_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; verb: string }> = {
  create: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', icon: <Plus size={12} />, verb: 'created' },
  update: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', icon: <Edit2 size={12} />, verb: 'updated' },
  delete: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', icon: <Trash2 size={12} />, verb: 'deleted' },
  import: { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', icon: <Upload size={12} />, verb: 'imported' },
  download: { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10', icon: <Download size={12} />, verb: 'exported' },
  release: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', icon: <Rocket size={12} />, verb: 'released' },
};

// Extract readable name from user identifier
const getUserDisplayName = (user: string): string => {
  // If it's an email, extract and format the username part
  if (user.includes('@')) {
    const username = user.split('@')[0];
    // Convert snake_case or kebab-case to Title Case
    return username
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  // Otherwise return as-is (assuming it's already a display name)
  return user;
};

// Format activity into a clear sentence
const formatActivityDescription = (activity: { target: string; targetType: string; action: string }): string => {
  // Extract the item name from target (e.g., "Token: primary-500" -> "primary-500")
  const itemName = activity.target.includes(':') 
    ? activity.target.split(':')[1].trim()
    : activity.target;
  
  // Get readable target type
  const typeLabels: Record<string, string> = {
    token: 'token',
    component: 'component',
    release: 'release',
    system: 'system',
  };
  const type = typeLabels[activity.targetType] || activity.targetType;
  
  return `"${itemName}" ${type}`;
};

// Relative time formatter
const getRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Get time category for grouping
const getTimeCategory = (timestamp: number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; delta?: string }> = ({ title, value, icon, delta }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 p-4 rounded-lg">
        <div className="flex justify-between items-start mb-2">
      <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider font-semibold">{title}</span>
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
    </div>
    <div className="text-2xl font-mono text-zinc-900 dark:text-white mb-1">{value}</div>
    {delta && <div className="text-xs text-green-600 dark:text-green-400">{delta}</div>}
  </div>
);

// Activity Item Component
const ActivityItem: React.FC<{ 
  activity: { id: string; user: string; action: string; target: string; targetType: string; timestamp: number };
  isLast: boolean;
}> = ({ activity, isLast }) => {
  const actionConfig = ACTION_CONFIG[activity.action] || ACTION_CONFIG.update;
  const userName = getUserDisplayName(activity.user);
  const description = formatActivityDescription(activity);
  
  return (
    <div className="relative group">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[9px] top-7 w-px h-[calc(100%-4px)] bg-zinc-200 dark:bg-zinc-700/50" />
      )}
      
      <div className="flex gap-3 p-2 rounded-lg">
        {/* Timeline dot with icon */}
        <div className={`w-[18px] h-[18px] rounded-full ${actionConfig.bg} flex items-center justify-center flex-shrink-0 mt-0.5 ring-2 ring-white dark:ring-zinc-900`}>
          <span className={actionConfig.color}>{actionConfig.icon}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {description} {actionConfig.verb} by <span className="font-medium text-zinc-900 dark:text-white">{userName}</span>
            </p>
            <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            {getRelativeTime(activity.timestamp)}
          </p>
        </div>
      </div>
    </div>
);
};

export const Dashboard: React.FC = () => {
  const { projectId } = useProject();
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  
  // Get real data from Convex - scoped to project
  const { tenantId, userId } = useTenant();
  
  const convexTokens = useQuery(
    api.tokens.list, 
    projectId && tenantId && userId 
      ? { projectId, tenantId, userId } 
      : "skip"
  );
  const convexComponents = useQuery(
    api.components.list, 
    projectId && tenantId && userId 
      ? { projectId, tenantId, userId } 
      : "skip"
  );
  const convexActivity = useQuery(
    api.activity.list, 
    projectId && tenantId && userId 
      ? { projectId, tenantId, userId, limit: 50 } 
      : "skip"
  );
  const latestRelease = useQuery(
    api.releases.latest, 
    projectId && tenantId && userId 
      ? { projectId, tenantId, userId } 
      : "skip"
  );

  // Loading states
  const isLoadingStats = (convexTokens === undefined || convexComponents === undefined) && projectId;
  const isLoadingActivity = convexActivity === undefined && projectId;

  const tokens = convexTokens || [];
  const components = (convexComponents || []).map(convexComponentToLegacy);
  const activity = (convexActivity || []).map(convexActivityToLegacy);

  // Calculate stats
  const stableCount = components.filter(c => c.status === 'stable').length;
  const reviewCount = components.filter(c => c.status === 'review').length;

  // Filter activity
  const filteredActivity = activityFilter === 'all' 
    ? activity 
    : activity.filter(a => a.targetType === activityFilter);

  // Group activity by time
  const groupedActivity = filteredActivity.reduce((groups, act) => {
    const category = getTimeCategory(act.timestamp);
    if (!groups[category]) groups[category] = [];
    groups[category].push(act);
    return groups;
  }, {} as Record<string, typeof activity>);

  // Get current version
  const currentVersion = latestRelease?.version || '—';
  const tokenCount = tokens.length;

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'token', label: 'Tokens' },
    { id: 'component', label: 'Components' },
    { id: 'release', label: 'Releases' },
  ];

  // Close filter menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isFilterMenuOpen]);

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
            <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Overview</h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Connected
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl space-y-8">
            {/* Stats Grid */}
            {isLoadingStats ? (
              <CardSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="Tokens" 
                  value={tokenCount.toString()} 
                  icon={<Palette size={16}/>} 
                />
                    <StatCard 
                        title="Components" 
                        value={components.length.toString()} 
                        icon={<Package size={16}/>} 
                  delta={stableCount > 0 ? `${stableCount} stable` : undefined} 
                    />
                    <StatCard 
                        title="In Review" 
                  value={reviewCount.toString()} 
                        icon={<CheckCircle size={16}/>} 
                    />
                    <StatCard 
                        title="Version" 
                  value={currentVersion} 
                        icon={<GitBranch size={16}/>} 
                    />
                </div>
            )}

            {/* Component Status Table */}
                    <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">Component Status</h3>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                <tr>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Component</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Version</th>
                                </tr>
                            </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {components.slice(0, 5).map(comp => (
                      <tr key={comp.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{comp.name}</td>
                                        <td className="px-4 py-3">
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-medium ${
                                                comp.status === 'stable' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                comp.status === 'review' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                                comp.status === 'deprecated' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                                {comp.status}
                                            </span>
                                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">{comp.version}</td>
                                    </tr>
                                ))}
                                {components.length === 0 && (
                                    <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                                            No components yet. Create one in the Builder.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
          </div>
        </div>
      </div>

      {/* Activity Side Panel */}
      <div className="w-80 border-l border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex flex-col h-full">
        {/* Panel Header */}
        <div className="py-[22px] px-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-zinc-400" />
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Activity</h3>
            </div>
            {/* Filter Button */}
            <div className="relative" ref={filterMenuRef}>
                <button
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                    activityFilter !== 'all'
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Filter size={16} />
                </button>
                
                {/* Filter Menu */}
                {isFilterMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1">
                    {filterOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setActivityFilter(option.id);
                          setIsFilterMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 h-8 flex items-center text-sm transition-colors ${
                          activityFilter === option.id
                            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoadingActivity ? (
            <TimelineSkeleton count={5} />
          ) : filteredActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Clock size={20} className="text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No activity yet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Activity will appear here as you make changes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedActivity).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {category}
                    </span>
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700/50" />
                  </div>
                  <div className="space-y-1">
                    {items.map((act, idx) => (
                      <ActivityItem 
                        key={act.id} 
                        activity={act} 
                        isLast={idx === items.length - 1}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
        </div>
    </div>
  );
};
