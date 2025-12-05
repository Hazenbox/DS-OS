import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ComponentItem, TokenActivity } from '../types';
import { CheckCircle, GitBranch, Package, Palette } from 'lucide-react';

interface DashboardProps {
    components: ComponentItem[];
    activity?: TokenActivity[];
}

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

export const Dashboard: React.FC<DashboardProps> = ({ components, activity = [] }) => {
  // Get real data from Convex
  const tokens = useQuery(api.tokens.list, {});
  const latestRelease = useQuery(api.releases.latest, {});

  // Calculate stats
  const stableCount = components.filter(c => c.status === 'stable').length;
  const adoptionRate = components.length > 0 
    ? Math.round((stableCount / components.length) * 100) 
    : 0;

  // Get recent activity (last 5)
  const recentActivity = activity.slice(0, 5);
  
  // Get current version
  const currentVersion = latestRelease?.version || '—';
  const tokenCount = tokens?.length || 0;

  return (
    <div className="flex flex-col h-full">
        <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
            <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Overview</h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Connected to Convex
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        value={components.filter(c => c.status === 'review').length.toString()} 
                        icon={<CheckCircle size={16}/>} 
                    />
                    <StatCard 
                        title="Version" 
                        value={currentVersion} 
                        icon={<GitBranch size={16}/>} 
                    />
                </div>

                    <div className="space-y-4">
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Recent Activity</h3>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-4">
                            {recentActivity.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No recent activity</p>
                            ) : (
                                <ul className="space-y-4">
                                    {recentActivity.map((act) => (
                                        <li key={act.id} className="flex gap-2 text-sm">
                                        <span className="font-semibold text-zinc-900 dark:text-white">{act.user}</span>
                                        <span className="text-zinc-500 dark:text-zinc-400">{act.action}</span>
                                        <span className="text-violet-600 dark:text-violet-400 font-mono truncate">{act.target}</span>
                                        <span className="text-zinc-500 dark:text-zinc-400 ml-auto whitespace-nowrap">
                                                {new Date(act.timestamp).toLocaleTimeString()}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                    </div>
                </div>

                {/* Component Overview */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Component Status</h3>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Component</th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Version</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                                {components.map(comp => (
                                    <tr key={comp.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{comp.name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs uppercase px-2 py-0.5 rounded ${
                                                comp.status === 'stable' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                comp.status === 'review' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                                comp.status === 'deprecated' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                                {comp.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-zinc-500 dark:text-zinc-400">{comp.version}</td>
                                    </tr>
                                ))}
                                {components.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
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
  );
};
