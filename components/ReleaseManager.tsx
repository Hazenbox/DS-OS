
import React, { useState } from 'react';
import { ComponentItem, DeploymentStatus } from '../types';
import { CheckCircle, Circle, AlertCircle, Loader2, Play } from 'lucide-react';

interface ReleaseManagerProps {
    components: ComponentItem[];
}

export const ReleaseManager: React.FC<ReleaseManagerProps> = ({ components }) => {
    const [activeDeploy, setActiveDeploy] = useState<DeploymentStatus[] | null>(null);

    const startRelease = () => {
        const steps: DeploymentStatus['step'][] = ['lint', 'test', 'build', 'docs', 'publish'];
        const initialStatus: DeploymentStatus[] = steps.map(s => ({ step: s, status: 'pending' }));
        setActiveDeploy(initialStatus);

        // Simulate process
        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep >= steps.length) {
                clearInterval(interval);
                return;
            }

            setActiveDeploy(prev => {
                if (!prev) return null;
                const newStatus = [...prev];
                // Set current to running
                newStatus[currentStep].status = 'running';
                // Set previous to success
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
    };

    const getStatusIcon = (status: DeploymentStatus['status']) => {
        switch (status) {
            case 'success': return <CheckCircle className="text-green-500" size={18} />;
            case 'failed': return <AlertCircle className="text-red-500" size={18} />;
            case 'running': return <Loader2 className="animate-spin text-accent" size={18} />;
            default: return <Circle className="text-muted" size={18} />;
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background z-10">
                <div>
                    <h2 className="text-xl font-semibold text-primary">Release</h2>
                    <p className="text-sm text-muted">Orchestrate package publishing to NPM and documentation.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={startRelease}
                        disabled={!!activeDeploy && activeDeploy.some(s => s.status === 'running')}
                        className="h-8 px-3 rounded-lg bg-bg-inverse text-inverse text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
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
                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-6">
                        <h3 className="text-sm font-semibold text-primary mb-4">Pipeline Status</h3>
                        
                        {activeDeploy ? (
                             <div className="space-y-6 relative">
                                <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-border -z-10" />
                                {activeDeploy.map((step, idx) => (
                                    <div key={step.step} className="flex items-center gap-4">
                                        <div className="bg-[#fafafa] dark:bg-black/20 rounded-full">{getStatusIcon(step.status)}</div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium capitalize text-primary">{step.step}</div>
                                            <div className="text-xs text-muted">
                                                {step.status === 'running' ? 'Processing...' : step.status === 'pending' ? 'Waiting...' : 'Completed'}
                                            </div>
                                        </div>
                                        {step.status === 'success' && <div className="text-xs font-mono text-muted">2.4s</div>}
                                    </div>
                                ))}
                             </div>
                        ) : (
                            <div className="text-center py-12 text-muted text-sm border-2 border-dashed border-border rounded">
                                No active releases. Click 'Trigger Release' to start.
                            </div>
                        )}
                    </div>

                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
                            <h3 className="text-sm font-semibold text-primary">Changelog Preview</h3>
                        </div>
                        <div className="p-6 font-mono text-sm text-muted space-y-2">
                            <p className="text-primary font-bold">## v2.5.0 (Upcoming)</p>
                            <p>### Features</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {components.filter(c => c.status !== 'stable').map(c => (
                                    <li key={c.id}>
                                        <span className="text-accent">{c.name}</span>: Promoted to {c.status}
                                    </li>
                                ))}
                                {components.filter(c => c.status !== 'stable').length === 0 && <li>No pending changes</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
