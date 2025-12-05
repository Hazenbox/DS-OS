import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Token, ConvexComponent, convexTokenToLegacy } from '../types';
import { 
  Link2, Loader2, Trash2, Play, Eye, Code, Layers, 
  Settings2, MessageSquare, Check, X, ChevronRight, 
  Palette, Type, Box, Maximize2, Circle, Sparkles,
  AlertTriangle, RefreshCw, Copy, ExternalLink
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { LoadingSpinner } from './LoadingSpinner';
import { 
  extractAllProperties, 
  parseFigmaUrl, 
  generateComponentCodeFromProps,
  ExtractedProperties,
  FigmaVariant,
  ExtractedComponent
} from '../services/figmaExtractor';
import { 
  SandpackProvider, 
  SandpackPreview
} from '@codesandbox/sandpack-react';

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

interface VariantSelectorProps {
  variants: FigmaVariant[];
  selectedVariant: FigmaVariant | null;
  onSelect: (variant: FigmaVariant) => void;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({ variants, selectedVariant, onSelect }) => {
  if (variants.length === 0) return null;
  
  // Group variants by property
  const properties = variants.length > 0 ? Object.keys(variants[0].properties) : [];
  
  return (
    <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={14} className="text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Variants</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant, idx) => {
          const label = Object.values(variant.properties).join(' / ');
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

interface InspectPanelProps {
  properties: ExtractedProperties;
  variant?: FigmaVariant;
}

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

const InspectPanel: React.FC<InspectPanelProps> = ({ properties, variant }) => {
  const activeProps = variant?.extractedProps || properties;
  
  const sections: InspectSection[] = [
    { 
      id: 'tokens', 
      label: 'Token Mappings', 
      icon: <Palette size={14} />,
      items: activeProps.tokenMappings.map(m => ({
        label: m.property,
        value: m.tokenName,
        subValue: m.tokenValue
      }))
    },
    { 
      id: 'layout', 
      label: 'Layout', 
      icon: <Box size={14} />,
      items: Object.entries(activeProps.css || {})
        .filter(([k]) => ['display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'padding', 'flexWrap'].includes(k))
        .map(([k, v]) => ({
          label: k,
          value: v as string
        }))
    },
    { 
      id: 'dimensions', 
      label: 'Dimensions', 
      icon: <Maximize2 size={14} />,
      items: [
        activeProps.width ? { label: 'width', value: `${activeProps.width}px` } : null,
        activeProps.height ? { label: 'height', value: `${activeProps.height}px` } : null,
        activeProps.borderRadius ? { label: 'borderRadius', value: activeProps.borderRadius } : null,
      ].filter((item): item is InspectItem => item !== null)
    },
    { 
      id: 'typography', 
      label: 'Typography', 
      icon: <Type size={14} />,
      items: activeProps.typography ? [
        activeProps.typography.fontFamily ? { label: 'fontFamily', value: activeProps.typography.fontFamily } : null,
        activeProps.typography.fontSize ? { label: 'fontSize', value: `${activeProps.typography.fontSize}px` } : null,
        activeProps.typography.fontWeight ? { label: 'fontWeight', value: String(activeProps.typography.fontWeight) } : null,
        activeProps.typography.lineHeightPx ? { label: 'lineHeight', value: `${activeProps.typography.lineHeightPx}px` } : null,
      ].filter((item): item is InspectItem => item !== null) : []
    },
    { 
      id: 'effects', 
      label: 'Effects', 
      icon: <Circle size={14} />,
      items: [
        activeProps.boxShadow ? { label: 'boxShadow', value: activeProps.boxShadow } : null,
        activeProps.backdropFilter ? { label: 'backdropFilter', value: activeProps.backdropFilter } : null,
        activeProps.opacity !== undefined && activeProps.opacity < 1 ? { label: 'opacity', value: String(activeProps.opacity) } : null,
      ].filter((item): item is InspectItem => item !== null)
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
                    {'subValue' in item && item.subValue && (
                      <span className="text-[10px] text-zinc-400 font-mono">{item.subValue}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
      
      {/* Full CSS Output */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Code size={14} className="text-zinc-400" />
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Generated CSS
          </span>
        </div>
        <pre className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg overflow-x-auto">
          {Object.entries(activeProps.css).map(([k, v]) => `${k}: ${v};`).join('\n')}
        </pre>
      </div>
    </div>
  );
};

// ============================================================================
// FEEDBACK PANEL
// ============================================================================

interface FeedbackPanelProps {
  onSubmit: (feedback: string) => void;
  isProcessing: boolean;
}

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ onSubmit, isProcessing }) => {
  const [feedback, setFeedback] = useState('');
  
  const handleSubmit = () => {
    if (feedback.trim()) {
      onSubmit(feedback);
      setFeedback('');
    }
  };
  
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
        onClick={handleSubmit}
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
// MAIN COMPONENT BUILDER
// ============================================================================

export const ComponentBuilder: React.FC = () => {
  const { projectId, userId } = useProject();
  
  // State
  const [figmaUrl, setFigmaUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedComponent, setExtractedComponent] = useState<ExtractedComponent | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<FigmaVariant | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'inspect'>('preview');
  const [selectedComponentId, setSelectedComponentId] = useState<Id<"components"> | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  
  // Convex queries
  const convexTokens = useQuery(api.tokens.list, projectId ? { projectId } : "skip");
  const tokens = (convexTokens || []).map(convexTokenToLegacy);
  const components = useQuery(api.components.list, projectId ? { projectId } : "skip");
  
  const isLoading = components === undefined && projectId;
  
  // Convex mutations
  const createComponent = useMutation(api.components.create);
  const removeComponent = useMutation(api.components.remove);
  
  // Get selected saved component
  const selectedSavedComponent = components?.find(c => c._id === selectedComponentId);
  
  // Handle Figma URL extraction
  const handleExtract = async () => {
    if (!figmaUrl.trim()) return;
    
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedComponent(null);
    setSelectedVariant(null);
    
    try {
      const parsed = parseFigmaUrl(figmaUrl);
      if (!parsed) {
        throw new Error('Invalid Figma URL. Please paste a valid component link.');
      }
      
      // For demo purposes, simulate extraction with mock data
      // In production, this would call the Figma API
      await simulateExtraction(parsed, tokens);
      
    } catch (error) {
      setExtractionError(error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };
  
  // Simulate extraction (replace with real Figma API call)
  const simulateExtraction = async (parsed: { fileKey: string; nodeId: string }, tokens: Token[]) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data based on a typical button component
    const mockNode = {
      name: 'Button',
      type: 'COMPONENT_SET',
      fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.35, b: 0.95, a: 1 }, visible: true }],
      strokes: [],
      effects: [
        { type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0 }
      ],
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
      paddingTop: 12,
      paddingRight: 24,
      paddingBottom: 12,
      paddingLeft: 24,
      itemSpacing: 8,
      cornerRadius: 8,
      absoluteBoundingBox: { width: 120, height: 44 },
      style: {
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: 600,
      }
    };
    
    const baseProps = extractAllProperties(mockNode, tokens);
    
    // Mock variants
    const variants: FigmaVariant[] = [
      {
        name: 'Primary',
        properties: { variant: 'primary', size: 'medium' },
        extractedProps: extractAllProperties({
          ...mockNode,
          fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.35, b: 0.95, a: 1 }, visible: true }],
        }, tokens)
      },
      {
        name: 'Secondary',
        properties: { variant: 'secondary', size: 'medium' },
        extractedProps: extractAllProperties({
          ...mockNode,
          fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97, a: 1 }, visible: true }],
          strokes: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.85, a: 1 } }],
          strokeWeight: 1,
        }, tokens)
      },
      {
        name: 'Ghost',
        properties: { variant: 'ghost', size: 'medium' },
        extractedProps: extractAllProperties({
          ...mockNode,
          fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 }, visible: true }],
          effects: [],
        }, tokens)
      },
    ];
    
    const { componentCode, cssCode } = generateComponentCodeFromProps('Button', baseProps, variants);
    
    setExtractedComponent({
      name: 'Button',
      description: 'A versatile button component with multiple variants',
      baseProps,
      variants,
      componentCode,
      cssCode,
      usedTokens: tokens.filter(t => baseProps.tokenMappings.some(m => m.tokenName === t.name))
    });
    
    setSelectedVariant(variants[0]);
  };
  
  // Handle save component
  const handleSaveComponent = async () => {
    if (!extractedComponent || !projectId) return;
    
    try {
      const newId = await createComponent({
        projectId,
        name: extractedComponent.name,
        status: 'draft',
        version: '1.0.0',
        code: extractedComponent.componentCode,
        docs: `## ${extractedComponent.name}\n\n${extractedComponent.description || ''}\n\n### CSS\n\`\`\`css\n${extractedComponent.cssCode}\n\`\`\``,
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
    // In production, this would re-process the component with the feedback
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefining(false);
    // Show success message
  };
  
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: Component List */}
      <div className="w-72 border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col bg-white dark:bg-zinc-900">
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Builder</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Extract from Figma</p>
        </div>
        
        {/* Figma URL Input */}
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={14} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Figma Component URL</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="Paste Figma link..."
              className="flex-1 h-8 px-3 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            <button
              onClick={handleExtract}
              disabled={!figmaUrl.trim() || isExtracting}
              className="h-8 px-3 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isExtracting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {isExtracting ? 'Extracting...' : 'Extract'}
            </button>
          </div>
          {extractionError && (
            <div className="mt-2 p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              {extractionError}
            </div>
          )}
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
      {extractedComponent ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {extractedComponent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{extractedComponent.name}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{extractedComponent.description}</p>
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
                  setExtractedComponent(null);
                  setSelectedVariant(null);
                  setFigmaUrl('');
                }}
                className="h-8 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5"
              >
                <X size={12} /> Discard
              </button>
            </div>
          </div>
          
          {/* Variant Selector */}
          <VariantSelector
            variants={extractedComponent.variants}
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
                      code={extractedComponent.componentCode}
                      css={extractedComponent.cssCode}
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
                        <button className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                      <pre className="p-4 bg-zinc-950 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
                        {extractedComponent.componentCode}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">CSS</span>
                        <button className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                      <pre className="p-4 bg-zinc-950 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
                        {extractedComponent.cssCode}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'inspect' && (
                <InspectPanel
                  properties={extractedComponent.baseProps}
                  variant={selectedVariant || undefined}
                />
              )}
            </div>
            
            {/* Right Sidebar - Feedback */}
            <div className="w-64 border-l border-zinc-200/60 dark:border-zinc-800/60 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Palette size={14} className="text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Used Tokens
                  </span>
                </div>
                {extractedComponent.baseProps.tokenMappings.length > 0 ? (
                  <div className="space-y-2">
                    {extractedComponent.baseProps.tokenMappings.map((mapping, idx) => (
                      <div key={idx} className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {mapping.property.includes('color') || mapping.property.includes('background') ? (
                            <div 
                              className="w-4 h-4 rounded border border-zinc-200 dark:border-zinc-700"
                              style={{ backgroundColor: mapping.tokenValue }}
                            />
                          ) : (
                            <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                              <Box size={10} className="text-zinc-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">{mapping.tokenName}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{mapping.property}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No tokens matched</p>
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Extract Components from Figma
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Paste a Figma component URL to extract 100% matching UI with your design tokens.
              The builder will analyze the design and generate production-ready React components.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><Check size={12} className="text-green-500" /> 100% UI Match</span>
              <span className="flex items-center gap-1"><Check size={12} className="text-green-500" /> Token Mapping</span>
              <span className="flex items-center gap-1"><Check size={12} className="text-green-500" /> Variant Support</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
