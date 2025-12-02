import React from 'react';
import { ComponentItem, Integration } from '../types';
import { Activity, CheckCircle, GitBranch, Package } from 'lucide-react';

interface DashboardProps {
    components: ComponentItem[];
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; delta?: string }> = ({ title, value, icon, delta }) => (
    <div className="bg-[#fafafa] dark:bg-white/5 p-4 rounded-lg">
        <div className="flex justify-between items-start mb-2">
            <span className="text-muted text-xs uppercase tracking-wider font-semibold">{title}</span>
            <span className="text-muted">{icon}</span>
        </div>
        <div className="text-2xl font-mono text-primary mb-1">{value}</div>
        {delta && <div className="text-xs text-green-500">{delta}</div>}
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ components }) => {
  const integrations: Integration[] = [
    { name: 'GitHub', connected: true, icon: 'github', lastSync: '2m ago' },
    { name: 'Storybook', connected: true, icon: 'storybook', lastSync: '1h ago' },
    { name: 'NPM Registry', connected: true, icon: 'npm', lastSync: '1d ago' },
    { name: 'Docusaurus', connected: true, icon: 'docusaurus', lastSync: '1h ago' },
  ];

  return (
    <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border flex justify-between items-center bg-background z-10">
            <div>
                <h2 className="text-xl font-semibold text-primary">Overview</h2>
                <p className="text-sm text-muted">Monitor the health and velocity of your design system.</p>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="Components" value={components.length.toString()} icon={<Package size={16}/>} delta="+3 this week" />
                    <StatCard title="Adoption" value="84%" icon={<Activity size={16}/>} delta="+2% vs last month" />
                    <StatCard title="Open Issues" value="12" icon={<CheckCircle size={16}/>} />
                    <StatCard title="Version" value="v2.4.0" icon={<GitBranch size={16}/>} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-primary">Pipeline Status</h3>
                        <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg divide-y divide-border">
                            {integrations.map((int) => (
                                <div key={int.name} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${int.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="text-sm font-medium text-primary">{int.name}</span>
                                    </div>
                                    <span className="text-xs font-mono text-muted">{int.lastSync}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-primary">Recent Activity</h3>
                        <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-4">
                            <ul className="space-y-4">
                                {[
                                    { user: 'Sarah', action: 'published', target: '@orbit/button v1.2.0', time: '2h ago' },
                                    { user: 'Mike', action: 'updated', target: 'Select Component tokens', time: '4h ago' },
                                    { user: 'Bot', action: 'auto-generated', target: 'Docs for Card', time: '5h ago' },
                                ].map((activity, i) => (
                                    <li key={i} className="flex gap-2 text-sm">
                                        <span className="font-semibold text-primary">{activity.user}</span>
                                        <span className="text-muted">{activity.action}</span>
                                        <span className="text-accent font-mono">{activity.target}</span>
                                        <span className="text-muted ml-auto">{activity.time}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};