import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Token, convexTokenToLegacy } from '../types';
import { 
  Link2, Loader2, Trash2, Eye, Code, Layers, 
  Settings2, MessageSquare, Check, X, 
  Palette, Type, Box, Maximize2, Circle, Sparkles,
  AlertTriangle, Copy, Figma, Zap, ExternalLink
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { LoadingSpinner } from './LoadingSpinner';
import { 
  SandpackProvider, 
  SandpackPreview
} from '@codesandbox/sandpack-react';

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedVariant {
  name: string;
  properties: Record<string, string>;
  css: string;
}

interface ExtractionResult {
  componentName: string;
  description?: string;
  code: string;
  css: string;
  variants: ExtractedVariant[];
  extractedProperties: Record<string, any>;
  usedVariables: Array<{ name: string; value: string; type?: string }>;
}

// ============================================================================
// PREVIEW COMPONENT
// ============================================================================

const ComponentPreview: React.FC<{ 
  code: string; 
  css: string;
  tokens: Token[];
}> = ({ code, css, tokens }) => {
  const cssVariables = tokens.map(t => `  --${t.name}: ${t.value};`).join('\n');
  
  const files = {
    '/App.tsx': code,
    '/component.css': css,
    '/styles.css': `:root {\n${cssVariables}\n}\n\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n  padding: 20px;\n  background: #f5f5f5;\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}`,
    '/index.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

let Component;
try {
  const mod = require('./App.tsx');
  Component = mod.default || mod[Object.keys(mod)[0]] || (() => <div>No component exported</div>);
} catch (e) {
  Component = () => <div style={{ color: 'red', padding: 20 }}>Error loading component</div>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<Component />);
`,
  };

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      theme="dark"
      options={{
        classes: {
          'sp-wrapper': 'h-full',
          'sp-preview': 'h-full',
          'sp-preview-container': 'h-full',
        },
      }}
    >
      <SandpackPreview 
        showNavigator={false}
        showRefreshButton={true}
        style={{ height: '100%' }}
      />
    </SandpackProvider>
  );
};

// ============================================================================
// VARIANT SELECTOR
// ============================================================================

const VariantSelector: React.FC<{
  variants: ExtractedVariant[];
  selectedVariant: ExtractedVariant | null;
  onSelect: (variant: ExtractedVariant) => void;
}> = ({ variants, selectedVariant, onSelect }) => {
  if (variants.length === 0) return null;
  
  return (
    <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={14} className="text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Variants</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant, idx) => {
          const label = variant.name || Object.values(variant.properties).join(' / ');
          const isSelected = selectedVariant?.name === variant.name;
          
          return (
            <button
              key={idx}
              onClick={() => onSelect(variant)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                isSelected
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-600'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// INSPECT PANEL
// ============================================================================

interface InspectItem {
  label: string;
  value: string;
  subValue?: string;
}

interface InspectSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: InspectItem[];
}

const InspectPanel: React.FC<{ 
  properties: Record<string, any>;
  usedVariables: Array<{ name: string; value: string; type?: string }>;
}> = ({ properties, usedVariables }) => {
  
  const sections: InspectSection[] = [
    { 
      id: 'variables', 
      label: 'Used Variables', 
      icon: <Palette size={14} />,
      items: usedVariables.map(v => ({
        label: v.name,
        value: v.value,
        subValue: v.type
      }))
    },
    { 
      id: 'layout', 
      label: 'Layout', 
      icon: <Box size={14} />,
      items: Object.entries(properties)
        .filter(([k]) => ['display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'padding', 'flexWrap'].includes(k))
        .map(([k, v]) => ({ label: k, value: String(v) }))
    },
    { 
      id: 'dimensions', 
      label: 'Dimensions', 
      icon: <Maximize2 size={14} />,
      items: Object.entries(properties)
        .filter(([k]) => ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'borderRadius'].includes(k))
        .map(([k, v]) => ({ label: k, value: String(v) }))
    },
    { 
      id: 'typography', 
      label: 'Typography', 
      icon: <Type size={14} />,
      items: Object.entries(properties)
        .filter(([k]) => ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign'].includes(k))
        .map(([k, v]) => ({ label: k, value: String(v) }))
    },
    { 
      id: 'effects', 
      label: 'Effects', 
      icon: <Circle size={14} />,
      items: Object.entries(properties)
        .filter(([k]) => ['boxShadow', 'backdropFilter', 'opacity', 'filter'].includes(k))
        .map(([k, v]) => ({ label: k, value: String(v) }))
    },
  ];
  
  return (
    <div className="h-full overflow-y-auto">
      {sections.map(section => (
        section.items.length > 0 && (
          <div key={section.id} className="border-b border-zinc-200/60 dark:border-zinc-800/60">
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">
              <span className="text-zinc-400">{section.icon}</span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {section.label}
              </span>
              <span className="text-[10px] text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full ml-auto">
                {section.items.length}
              </span>
            </div>
            <div className="px-4 py-2 space-y-2">
              {section.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 py-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{item.label}</span>
                  <div className="text-right">
                    <span className="text-xs text-zinc-900 dark:text-white font-mono truncate max-w-[150px] block">
                      {item.value}
                    </span>
                    {item.subValue && (
                      <span className="text-[10px] text-zinc-400 font-mono">{item.subValue}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
};

// ============================================================================
// FEEDBACK PANEL
// ============================================================================

const FeedbackPanel: React.FC<{
  onSubmit: (feedback: string) => void;
  isProcessing: boolean;
}> = ({ onSubmit, isProcessing }) => {
  const [feedback, setFeedback] = useState('');
  
  return (
    <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={14} className="text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Report Mismatch</span>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Describe what doesn't match the Figma design..."
        className="w-full h-20 p-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none text-zinc-900 dark:text-white placeholder:text-zinc-400"
      />
      <button
        onClick={() => { onSubmit(feedback); setFeedback(''); }}
        disabled={!feedback.trim() || isProcessing}
        className="mt-2 w-full py-2 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {isProcessing ? 'Refining...' : 'Refine Component'}
      </button>
    </div>
  );
};

// ============================================================================
// EXTRACTION STATUS COMPONENT
// ============================================================================

const ExtractionStatus: React.FC<{
  status: 'idle' | 'pending' | 'extracting' | 'completed' | 'failed';
  figmaUrl: string;
  onCancel: () => void;
}> = ({ status, figmaUrl, onCancel }) => {
  if (status === 'idle') return null;
  
  return (
    <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 flex items-center justify-center z-20">
      <div className="text-center max-w-md px-6">
        {status === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <Figma size={28} className="text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Ready to Extract
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Ask the AI to extract this component from Figma:
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-mono break-all">
                "Extract the component from: {figmaUrl}"
              </p>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Or select a node in Figma desktop and say "Extract the selected Figma component"
            </p>
            <button
              onClick={onCancel}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </>
        )}
        
        {status === 'extracting' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Zap size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Extracting from Figma...
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Analyzing design properties, variables, and generating code
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-violet-500" />
              <span className="text-xs text-zinc-400">This may take a moment</span>
            </div>
          </>
        )}
        
        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Extraction Failed
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Please make sure Figma desktop is open with the file loaded.
            </p>
            <button
              onClick={onCancel}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT BUILDER
// ============================================================================

export const ComponentBuilder: React.FC = () => {
  const { projectId, userId } = useProject();
  
  // State
  const [figmaUrl, setFigmaUrl] = useState('');
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'pending' | 'extracting' | 'completed' | 'failed'>('idle');
  const [extractedResult, setExtractedResult] = useState<ExtractionResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ExtractedVariant | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'inspect'>('preview');
  const [selectedComponentId, setSelectedComponentId] = useState<Id<"components"> | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<Id<"figmaExtractions"> | null>(null);
  
  // Convex queries
  const convexTokens = useQuery(api.tokens.list, projectId ? { projectId } : "skip");
  const tokens = (convexTokens || []).map(convexTokenToLegacy);
  const components = useQuery(api.components.list, projectId ? { projectId } : "skip");
  const extractionRequest = useQuery(
    api.figmaExtraction.getExtractionRequest, 
    pendingRequestId ? { requestId: pendingRequestId } : "skip"
  );
  
  const isLoading = components === undefined && projectId;
  
  // Convex mutations
  const createComponent = useMutation(api.components.create);
  const removeComponent = useMutation(api.components.remove);
  const createExtractionRequest = useMutation(api.figmaExtraction.createExtractionRequest);
  
  // Get selected saved component
  const selectedSavedComponent = components?.find(c => c._id === selectedComponentId);
  
  // Watch for extraction completion
  useEffect(() => {
    if (extractionRequest?.status === 'completed' && extractionRequest.result) {
      setExtractedResult(extractionRequest.result as ExtractionResult);
      setExtractionStatus('completed');
      if ((extractionRequest.result as ExtractionResult).variants?.length > 0) {
        setSelectedVariant((extractionRequest.result as ExtractionResult).variants[0]);
      }
      setPendingRequestId(null);
    } else if (extractionRequest?.status === 'failed') {
      setExtractionStatus('failed');
      setPendingRequestId(null);
    }
  }, [extractionRequest]);
  
  // Parse Figma URL
  const parseFigmaUrl = (url: string): { fileKey: string; nodeId: string } | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const designIndex = pathParts.indexOf('design');
      const fileIndex = pathParts.indexOf('file');
      const keyIndex = designIndex !== -1 ? designIndex + 1 : (fileIndex !== -1 ? fileIndex + 1 : -1);
      if (keyIndex === -1 || keyIndex >= pathParts.length) return null;
      const fileKey = pathParts[keyIndex];
      const nodeId = urlObj.searchParams.get('node-id')?.replace('-', ':') || '';
      return { fileKey, nodeId };
    } catch {
      return null;
    }
  };
  
  // Handle extraction request
  const handleRequestExtraction = async () => {
    if (!figmaUrl.trim() || !projectId || !userId) return;
    
    const parsed = parseFigmaUrl(figmaUrl);
    if (!parsed) {
      alert('Invalid Figma URL');
      return;
    }
    
    try {
      const requestId = await createExtractionRequest({
        projectId,
        userId,
        figmaUrl,
        nodeId: parsed.nodeId,
      });
      
      setPendingRequestId(requestId);
      setExtractionStatus('pending');
    } catch (error) {
      console.error('Failed to create extraction request:', error);
    }
  };
  
  // Handle save component
  const handleSaveComponent = async () => {
    if (!extractedResult || !projectId) return;
    
    try {
      const newId = await createComponent({
        projectId,
        name: extractedResult.componentName,
        status: 'draft',
        version: '1.0.0',
        code: extractedResult.code,
        docs: `## ${extractedResult.componentName}\n\n${extractedResult.description || ''}\n\n### CSS\n\`\`\`css\n${extractedResult.css}\n\`\`\``,
      });
      
      setSelectedComponentId(newId);
      
    } catch (error) {
      console.error('Failed to save component:', error);
    }
  };
  
  // Handle delete component
  const handleDeleteComponent = async (id: Id<"components">) => {
    try {
      await removeComponent({ id });
      if (selectedComponentId === id) {
        setSelectedComponentId(null);
      }
    } catch (error) {
      console.error('Failed to delete component:', error);
    }
  };
  
  // Handle feedback
  const handleFeedback = async (feedback: string) => {
    setIsRefining(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefining(false);
  };
  
  // Reset extraction
  const handleCancelExtraction = () => {
    setExtractionStatus('idle');
    setPendingRequestId(null);
  };
  
  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Extraction Status Overlay */}
      <ExtractionStatus 
        status={extractionStatus}
        figmaUrl={figmaUrl}
        onCancel={handleCancelExtraction}
      />
      
      {/* Left Panel: Component List */}
      <div className="w-72 border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col bg-white dark:bg-zinc-900">
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Builder</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Figma MCP Extraction</p>
        </div>
        
        {/* Figma URL Input */}
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2 mb-2">
            <Figma size={14} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Figma Component</span>
          </div>
          <input
            type="text"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            placeholder="Paste Figma component URL..."
            className="w-full h-8 px-3 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 mb-2"
          />
          <button
            onClick={handleRequestExtraction}
            disabled={!figmaUrl.trim() || extractionStatus !== 'idle'}
            className="w-full h-8 text-xs font-medium bg-gradient-to-r from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Zap size={12} />
            Extract with MCP
          </button>
          <p className="text-[10px] text-zinc-400 mt-2 text-center">
            Uses Figma Desktop MCP for 100% extraction
          </p>
        </div>
        
        {/* Saved Components List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-800/30">
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Saved Components</span>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <LoadingSpinner size="sm" />
            </div>
          ) : components?.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No components yet</p>
              <p className="text-[10px] text-zinc-400 mt-1">Extract from Figma to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {components?.map(comp => (
                <div
                  key={comp._id}
                  onClick={() => setSelectedComponentId(comp._id)}
                  className={`p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group ${
                    selectedComponentId === comp._id ? 'bg-zinc-50 dark:bg-zinc-800/50 border-l-2 border-l-violet-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{comp.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComponent(comp._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                      comp.status === 'stable' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                      comp.status === 'review' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {comp.status}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">v{comp.version}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content Area */}
      {extractedResult ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {extractedResult.componentName.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{extractedResult.componentName}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{extractedResult.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveComponent}
                className="h-8 px-3 text-xs font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:opacity-90 flex items-center gap-1.5"
              >
                <Check size={12} /> Save Component
              </button>
              <button
                onClick={() => {
                  setExtractedResult(null);
                  setSelectedVariant(null);
                  setFigmaUrl('');
                  setExtractionStatus('idle');
                }}
                className="h-8 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5"
              >
                <X size={12} /> Discard
              </button>
            </div>
          </div>
          
          {/* Variant Selector */}
          <VariantSelector
            variants={extractedResult.variants}
            selectedVariant={selectedVariant}
            onSelect={setSelectedVariant}
          />
          
          {/* Content Tabs */}
          <div className="flex border-b border-zinc-200/60 dark:border-zinc-800/60 px-4">
            {[
              { id: 'preview', label: 'Preview', icon: <Eye size={14} /> },
              { id: 'code', label: 'Code', icon: <Code size={14} /> },
              { id: 'inspect', label: 'Inspect', icon: <Settings2 size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b transition-colors ${
                  activeTab === tab.id
                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {activeTab === 'preview' && (
                <div className="h-full p-4">
                  <div className="h-full rounded-lg overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60">
                    <ComponentPreview
                      code={extractedResult.code}
                      css={extractedResult.css}
                      tokens={tokens}
                    />
                  </div>
                </div>
              )}
              
              {activeTab === 'code' && (
                <div className="h-full p-4 overflow-auto">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Component Code</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(extractedResult.code)}
                          className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                      <pre className="p-4 bg-zinc-950 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
                        {extractedResult.code}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">CSS</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(extractedResult.css)}
                          className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                      <pre className="p-4 bg-zinc-950 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
                        {extractedResult.css}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'inspect' && (
                <InspectPanel
                  properties={extractedResult.extractedProperties}
                  usedVariables={extractedResult.usedVariables}
                />
              )}
            </div>
            
            {/* Right Sidebar - Used Variables & Feedback */}
            <div className="w-64 border-l border-zinc-200/60 dark:border-zinc-800/60 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Palette size={14} className="text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Used Variables
                  </span>
                </div>
                {extractedResult.usedVariables.length > 0 ? (
                  <div className="space-y-2">
                    {extractedResult.usedVariables.map((variable, idx) => (
                      <div key={idx} className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {variable.type === 'color' ? (
                            <div 
                              className="w-4 h-4 rounded border border-zinc-200 dark:border-zinc-700"
                              style={{ backgroundColor: variable.value }}
                            />
                          ) : (
                            <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                              <Box size={10} className="text-zinc-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">{variable.name}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{variable.value}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No variables detected</p>
                )}
              </div>
              
              <FeedbackPanel onSubmit={handleFeedback} isProcessing={isRefining} />
            </div>
          </div>
        </div>
      ) : selectedSavedComponent ? (
        // Show saved component details
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{selectedSavedComponent.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                selectedSavedComponent.status === 'stable' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                selectedSavedComponent.status === 'review' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
                {selectedSavedComponent.status}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">v{selectedSavedComponent.version}</span>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            <pre className="p-4 bg-zinc-950 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
              {selectedSavedComponent.code}
            </pre>
          </div>
        </div>
      ) : (
        // Empty state
        <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F24E1E]/20 via-[#A259FF]/20 to-[#1ABCFE]/20 flex items-center justify-center mx-auto mb-4">
              <Figma size={28} className="text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Figma MCP Extraction
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Paste a Figma component URL or select a node in Figma desktop. 
              The MCP will extract 100% of design properties including variables, 
              auto-layout, effects, and generate production-ready React code.
            </p>
            <div className="grid grid-cols-3 gap-4 text-xs text-zinc-400 mb-6">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Check size={14} className="text-green-500" />
                </div>
                <span>100% Match</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Palette size={14} className="text-violet-500" />
                </div>
                <span>Variables</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Layers size={14} className="text-blue-500" />
                </div>
                <span>Variants</span>
              </div>
            </div>
            <a
              href="https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-Components-in-Figma"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-500 hover:text-violet-600 flex items-center justify-center gap-1"
            >
              Learn about Figma components <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
