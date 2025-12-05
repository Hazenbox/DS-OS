import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { convexComponentToLegacy, convexActivityToLegacy } from '../types';
import { CheckCircle, GitBranch, Package, Palette, Clock } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

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

// Format activity into readable sentence
const formatActivitySentence = (activity: { user: string; action: string; target: string; targetType: string }): string => {
  // Extract clean name from email or use as-is
  const userName = activity.user.includes('@') 
    ? activity.user.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : activity.user;
  
  // Extract the actual item name from target (e.g., "Token: primary" -> "primary")
  const itemName = activity.target.includes(':') 
    ? activity.target.split(':')[1].trim()
    : activity.target;

  const actionVerbs: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
    import: 'imported',
    download: 'exported',
    release: 'released',
  };

  const verb = actionVerbs[activity.action] || activity.action;
  
  return `"${itemName}" was ${verb} by ${userName}`;
};

// Activity Item Component
const ActivityItem: React.FC<{ 
  activity: { id: string; user: string; action: string; target: string; targetType: string; timestamp: number };
  isLast: boolean;
}> = ({ activity, isLast }) => {
  const dotColors: Record<string, string> = {
    create: 'bg-green-500',
    update: 'bg-blue-500',
    delete: 'bg-red-500',
    import: 'bg-violet-500',
    download: 'bg-cyan-500',
    release: 'bg-amber-500',
  };
  
  const dotColor = dotColors[activity.action] || 'bg-zinc-400';
  
  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[5px] top-4 w-px h-[calc(100%+4px)] bg-zinc-200 dark:bg-zinc-800" />
      )}
      
      <div className="flex gap-3 py-2 group">
        {/* Timeline dot */}
        <div className={`w-[11px] h-[11px] rounded-full ${dotColor} flex-shrink-0 mt-1 ring-2 ring-white dark:ring-zinc-900`} />
        
        {/* Content */}
        <div className="flex-1 min-w-0 -mt-0.5">
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {formatActivitySentence(activity)}
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
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
  
  // Get real data from Convex - scoped to project
  const convexTokens = useQuery(api.tokens.list, projectId ? { projectId } : "skip");
  const convexComponents = useQuery(api.components.list, projectId ? { projectId } : "skip");
  const convexActivity = useQuery(api.activity.list, projectId ? { projectId, limit: 50 } : "skip");
  const latestRelease = useQuery(api.releases.latest, projectId ? { projectId } : "skip");

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
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-zinc-400" />
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Activity</h3>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {filteredActivity.length}
            </span>
          </div>
          
          {/* Filter Pills */}
          <div className="flex gap-1.5 flex-wrap">
            {filterOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setActivityFilter(option.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activityFilter === option.id
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredActivity.length === 0 ? (
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
