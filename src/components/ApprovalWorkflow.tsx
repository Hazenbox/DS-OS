import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Code, 
  AlertCircle, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';

interface ApprovalWorkflowProps {
  releaseId: Id<"releases">;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onClose?: () => void;
}

interface ComponentApproval {
  componentId: string;
  componentName: string;
  status: 'pending' | 'approved' | 'rejected';
  visualDiff?: {
    passed: boolean;
    diffPercentage: number;
    diffImage?: string;
    screenshotUrl?: string;
    figmaImageUrl?: string;
    threshold?: number;
  };
  accessibility?: {
    passed: boolean;
    violations: Array<{
      id: string;
      impact: string;
      description: string;
    }>;
    score?: number;
  };
  rejectionReason?: string;
}

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  releaseId,
  onApprove,
  onReject,
  onClose,
}) => {
  const { tenantId, userId } = useTenant();
  const { projectId } = useProject();
  
  const [currentComponentIndex, setCurrentComponentIndex] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay' | 'figma' | 'generated'>('side-by-side');
  
  // Mutations
  const approveComponent = useMutation(api.releases.approveComponent);
  const rejectComponent = useMutation(api.releases.rejectComponent);
  const approveRelease = useMutation(api.releases.approveRelease);
  
  // Get release data
  const release = useQuery(
    api.releases.get,
    releaseId && tenantId && userId
      ? { id: releaseId, tenantId, userId }
      : "skip"
  );
  
  // Get components for this release
  const components = useQuery(
    api.components.list,
    projectId && tenantId && userId
      ? { projectId, tenantId, userId }
      : "skip"
  );
  
  // Get visual diff results
  const visualDiffResults = release?.visualDiffResults || [];
  const accessibilityResults = release?.accessibilityResults || [];
  const componentApprovalsData = release?.componentApprovals || [];
  
  // Build component approvals list
  const componentApprovals: ComponentApproval[] = (release?.components || []).map((compId) => {
    const component = components?.find((c: any) => c._id === compId);
    const visualDiff = visualDiffResults.find((r: any) => r.componentId === compId);
    const accessibility = accessibilityResults.find((r: any) => r.componentId === compId);
    const approval = componentApprovalsData.find((a: any) => a.componentId === compId);
    
    return {
      componentId: compId,
      componentName: component?.name || 'Unknown Component',
      status: (approval?.status as 'pending' | 'approved' | 'rejected') || 'pending',
      rejectionReason: approval?.rejectionReason,
      visualDiff: visualDiff ? {
        passed: visualDiff.passed,
        diffPercentage: visualDiff.diffPercentage,
        diffImage: visualDiff.diffImage,
        screenshotUrl: visualDiff.screenshotUrl,
        figmaImageUrl: visualDiff.figmaImageUrl,
        threshold: visualDiff.threshold || 0.1,
      } : undefined,
      accessibility: accessibility ? {
        passed: accessibility.passed,
        violations: accessibility.violations || [],
        score: (accessibility as any).score,
      } : undefined,
    };
  });
  
  const currentComponent = componentApprovals[currentComponentIndex];
  const hasNext = currentComponentIndex < componentApprovals.length - 1;
  const hasPrev = currentComponentIndex > 0;
  
  const handleApprove = async () => {
    if (!tenantId || !userId || !currentComponent) return;
    
    try {
      await approveComponent({
        releaseId,
        componentId: currentComponent.componentId,
        tenantId,
        userId,
      });
      
      if (hasNext) {
        setCurrentComponentIndex(currentComponentIndex + 1);
      } else {
        // All components approved, approve the release
        await approveRelease({
          releaseId,
          tenantId,
          userId,
        });
        onApprove?.();
      }
    } catch (error) {
      console.error('Failed to approve component:', error);
      alert(error instanceof Error ? error.message : 'Failed to approve component');
    }
  };
  
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    if (!tenantId || !userId || !currentComponent) return;
    
    try {
      await rejectComponent({
        releaseId,
        componentId: currentComponent.componentId,
        reason: rejectionReason,
        tenantId,
        userId,
      });
      
      setShowRejectionModal(false);
      setRejectionReason('');
      onReject?.(rejectionReason);
    } catch (error) {
      console.error('Failed to reject component:', error);
      alert(error instanceof Error ? error.message : 'Failed to reject component');
    }
  };
  
  if (!release || !currentComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-violet-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading approval workflow...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Release Approval: {release.version}
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {currentComponentIndex + 1} of {componentApprovals.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'side-by-side' ? 'overlay' : 'side-by-side')}
            className="px-3 h-8 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {viewMode === 'side-by-side' ? 'Overlay' : 'Side-by-Side'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Component Info & Tests */}
        <div className="w-80 border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col">
          {/* Component Name */}
          <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
              {currentComponent.componentName}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Component {currentComponentIndex + 1} of {componentApprovals.length}
            </p>
          </div>
          
          {/* Visual Diff Results */}
          {currentComponent.visualDiff && (
            <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Visual Diff</h4>
                {currentComponent.visualDiff.passed ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <XCircle size={16} className="text-red-500" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">Difference</span>
                  <span className={`font-mono ${currentComponent.visualDiff.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {(currentComponent.visualDiff.diffPercentage * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">Threshold</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {((currentComponent.visualDiff.threshold || 0.1) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Accessibility Results */}
          {currentComponent.accessibility && (
            <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Accessibility</h4>
                {currentComponent.accessibility.passed ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <XCircle size={16} className="text-red-500" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">Score</span>
                  <span className={`font-mono ${currentComponent.accessibility.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {currentComponent.accessibility.score || 0}/100
                  </span>
                </div>
                {currentComponent.accessibility.violations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      {currentComponent.accessibility.violations.length} violation(s)
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {currentComponent.accessibility.violations.slice(0, 3).map((violation, idx) => (
                        <div key={idx} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-1.5 rounded">
                          {violation.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Navigation */}
          <div className="mt-auto p-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                onClick={() => setCurrentComponentIndex(Math.max(0, currentComponentIndex - 1))}
                disabled={!hasPrev}
                className="flex-1 h-8 px-3 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                onClick={() => setCurrentComponentIndex(Math.min(componentApprovals.length - 1, currentComponentIndex + 1))}
                disabled={!hasNext}
                className="flex-1 h-8 px-3 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleApprove}
                className="w-full h-8 px-3 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={14} />
                Approve
              </button>
              <button
                onClick={() => setShowRejectionModal(true)}
                className="w-full h-8 px-3 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle size={14} />
                Request Changes
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Visual Comparison */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Mode Controls */}
          <div className="h-12 px-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('figma')}
                className={`px-2 h-7 text-xs font-medium rounded transition-colors ${
                  viewMode === 'figma'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Figma
              </button>
              <button
                onClick={() => setViewMode('generated')}
                className={`px-2 h-7 text-xs font-medium rounded transition-colors ${
                  viewMode === 'generated'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Generated
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-2 h-7 text-xs font-medium rounded transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('overlay')}
                className={`px-2 h-7 text-xs font-medium rounded transition-colors ${
                  viewMode === 'overlay'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Overlay
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 min-w-[3rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                title="Reset Zoom"
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>
          
          {/* Image Comparison Area */}
          <div className="flex-1 overflow-auto p-4 bg-zinc-50 dark:bg-zinc-950">
            {viewMode === 'side-by-side' && currentComponent.visualDiff && (
              <div className="flex gap-4 justify-center items-start">
                <div className="flex-1">
                  <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 shadow-sm">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Figma Design</div>
                    {currentComponent.visualDiff.figmaImageUrl ? (
                      <img
                        src={currentComponent.visualDiff.figmaImageUrl}
                        alt="Figma design"
                        className="w-full h-auto rounded"
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                      />
                    ) : (
                      <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center">
                        <p className="text-xs text-zinc-400">No reference image</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 shadow-sm">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Generated Component</div>
                    {currentComponent.visualDiff.screenshotUrl ? (
                      <img
                        src={currentComponent.visualDiff.screenshotUrl}
                        alt="Generated component"
                        className="w-full h-auto rounded"
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                      />
                    ) : (
                      <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center">
                        <p className="text-xs text-zinc-400">No screenshot available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {viewMode === 'overlay' && currentComponent.visualDiff?.diffImage && (
              <div className="flex justify-center">
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 shadow-sm">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Diff Overlay</div>
                  <img
                    src={currentComponent.visualDiff.diffImage}
                    alt="Visual diff"
                    className="rounded"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'figma' && currentComponent.visualDiff?.figmaImageUrl && (
              <div className="flex justify-center">
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 shadow-sm">
                  <img
                    src={currentComponent.visualDiff.figmaImageUrl}
                    alt="Figma design"
                    className="rounded"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'generated' && currentComponent.visualDiff?.screenshotUrl && (
              <div className="flex justify-center">
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 shadow-sm">
                  <img
                    src={currentComponent.visualDiff.screenshotUrl}
                    alt="Generated component"
                    className="rounded"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md border border-zinc-200/60 dark:border-zinc-800/60">
            <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Request Changes</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Reason for rejection
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please explain what needs to be changed..."
                  className="w-full h-24 px-3 py-2 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 h-8 px-3 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 h-8 px-3 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

