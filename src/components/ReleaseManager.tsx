import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DeploymentStatus, convexComponentToLegacy } from '../types';
import { CheckCircle, Circle, AlertCircle, Loader2, Play, Package } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

export const ReleaseManager: React.FC = () => {
    const { projectId } = useProject();
    const [activeDeploy, setActiveDeploy] = useState<DeploymentStatus[] | null>(null);

    // Convex queries - scoped to project
    const convexComponents = useQuery(api.components.list, projectId ? { projectId } : "skip");
    const releases = useQuery(api.releases.list, projectId ? { projectId } : "skip");
    const latestRelease = useQuery(api.releases.latest, projectId ? { projectId } : "skip");

    // Convex mutations
    const createRelease = useMutation(api.releases.create);
    const updateReleaseStatus = useMutation(api.releases.updateStatus);
    const logActivity = useMutation(api.activity.create);

    const components = (convexComponents || []).map(convexComponentToLegacy);
    const pendingComponents = components.filter(c => c.status !== 'stable' && c.status !== 'deprecated');

    const startRelease = async () => {
        if (!projectId) return;
        
        const steps: DeploymentStatus['step'][] = ['lint', 'test', 'build', 'docs', 'publish'];
        const initialStatus: DeploymentStatus[] = steps.map(s => ({ step: s, status: 'pending' }));
        setActiveDeploy(initialStatus);

        // Calculate next version
        const currentVersion = latestRelease?.version || '0.0.0';
        const [major, minor, patch] = currentVersion.replace('v', '').split('.').map(Number);
        const newVersion = `v${major}.${minor + 1}.0`;

        // Create release record
        try {
            const releaseId = await createRelease({
                projectId,
                version: newVersion,
                changelog: generateChangelog(),
                components: components.map(c => c.id),
            });

            // Simulate process
            let currentStep = 0;
            const interval = setInterval(() => {
                if (currentStep >= steps.length) {
                    clearInterval(interval);
                    // Mark release as published
                    updateReleaseStatus({ id: releaseId, status: 'published' });
                    return;
                }

                setActiveDeploy(prev => {
                    if (!prev) return null;
                    const newStatus = [...prev];
                    newStatus[currentStep].status = 'running';
                    if (currentStep > 0) newStatus[currentStep - 1].status = 'success';
                    return newStatus;
                });

                setTimeout(() => {
                    setActiveDeploy(prev => {
                        if (!prev) return null;
                        const newStatus = [...prev];
                        newStatus[currentStep].status = 'success';
                        return newStatus;
                    });
                    currentStep++;
                }, 1500);

            }, 2000);
        } catch (error) {
            console.error('Failed to create release:', error);
        }
    };

    const generateChangelog = () => {
        const stable = components.filter(c => c.status === 'stable');
        const review = components.filter(c => c.status === 'review');
        const draft = components.filter(c => c.status === 'draft');
        
        let changelog = '## Changes\n\n';
        
        if (stable.length > 0) {
            changelog += '### Stable\n';
            stable.forEach(c => {
                changelog += `- ${c.name} v${c.version}\n`;
            });
            changelog += '\n';
        }
        
        if (review.length > 0) {
            changelog += '### In Review\n';
            review.forEach(c => {
                changelog += `- ${c.name} v${c.version}\n`;
            });
            changelog += '\n';
        }
        
        if (draft.length > 0) {
            changelog += '### Draft\n';
            draft.forEach(c => {
                changelog += `- ${c.name} v${c.version}\n`;
            });
        }
        
        return changelog;
    };

    const getStatusIcon = (status: DeploymentStatus['status']) => {
        switch (status) {
            case 'success': return <CheckCircle className="text-green-500" size={18} />;
            case 'failed': return <AlertCircle className="text-red-500" size={18} />;
            case 'running': return <Loader2 className="animate-spin text-violet-500" size={18} />;
            default: return <Circle className="text-zinc-400" size={18} />;
        }
    };

    const nextVersion = () => {
        const currentVersion = latestRelease?.version || 'v0.0.0';
        const [major, minor, patch] = currentVersion.replace('v', '').split('.').map(Number);
        return `v${major}.${minor + 1}.0`;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                <div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Release</h2>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        Next: {nextVersion()}
                    </span>
                    <button 
                        onClick={startRelease}
                        disabled={!!activeDeploy && activeDeploy.some(s => s.status === 'running')}
                        className="h-8 px-3 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        {activeDeploy && activeDeploy.some(s => s.status === 'running') ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Play size={16} fill="currentColor" />
                        )}
                        <span>Trigger Release</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Pipeline Status</h3>
                        
                        {activeDeploy ? (
                             <div className="space-y-6 relative">
                                <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-zinc-200 dark:bg-zinc-700 -z-10" />
                                {activeDeploy.map((step, idx) => (
                                    <div key={step.step} className="flex items-center gap-4">
                                        <div className="bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-full p-1">{getStatusIcon(step.status)}</div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium capitalize text-zinc-900 dark:text-white">{step.step}</div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {step.status === 'running' ? 'Processing...' : step.status === 'pending' ? 'Waiting...' : 'Completed'}
                                            </div>
                                        </div>
                                        {step.status === 'success' && <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">2.4s</div>}
                                    </div>
                                ))}
                             </div>
                        ) : (
                            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded">
                                No active releases. Click 'Trigger Release' to start.
                            </div>
                        )}
                    </div>

                    {/* Release History */}
                    {releases && releases.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/50">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Package size={14} /> Release History
                                </h3>
                            </div>
                            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {releases.slice(0, 5).map(release => (
                                    <div key={release._id} className="px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-medium text-zinc-900 dark:text-white">{release.version}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                release.status === 'published' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                release.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                                release.status === 'failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                                {release.status}
                                            </span>
                                        </div>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {release.publishedAt 
                                                ? new Date(release.publishedAt).toLocaleDateString()
                                                : 'Pending'
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/50">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Changelog Preview</h3>
                        </div>
                        <div className="p-6 font-mono text-sm text-zinc-500 dark:text-zinc-400 space-y-2">
                            <p className="text-zinc-900 dark:text-white font-bold">## {nextVersion()} (Upcoming)</p>
                            <p>### Features</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {pendingComponents.map(c => (
                                    <li key={c.id}>
                                        <span className="text-violet-600 dark:text-violet-400">{c.name}</span>: {c.status} → stable
                                    </li>
                                ))}
                                {pendingComponents.length === 0 && <li>No pending changes</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
