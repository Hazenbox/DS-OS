import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { extractComponentWithMCP, extractNodeIdFromFigmaUrl, checkFigmaMCPConnection } from '../services/figmaMcpClient';
import { 
  Figma, Zap, Loader2, Eye, Code, Trash2, 
  Plus, Search, AlertCircle, Check, X,
  Sparkles, Layers
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface McpComponent {
  _id: Id<"components">;
  name: string;
  code: string;
  css?: string;
  description?: string;
  figmaUrl?: string;
  version: string;
  status: 'draft' | 'review' | 'stable' | 'deprecated';
  _creationTime: number;
}

// ============================================================================
// COMPONENT PREVIEW
// ============================================================================

const ComponentPreview: React.FC<{ component: McpComponent }> = ({ component }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Extract component name from code (look for export const ComponentName)
  const componentName = React.useMemo(() => {
    const match = component.code.match(/export\s+(?:const|function)\s+(\w+)/);
    return match ? match[1] : component.name.replace(/[^a-zA-Z0-9]/g, '');
  }, [component.code, component.name]);
  
  // Create preview HTML with React
  const previewHtml = React.useMemo(() => {
    const cssStyles = component.css || '';
    // Clean the code - remove import statements that won't work in iframe
    const cleanCode = component.code
      .replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '')
      .replace(/import\s+['"].*?['"];?\n?/g, '');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 24px;
              background: #fafafa;
            }
            #root {
              width: 100%;
              min-height: 100vh;
            }
            ${cssStyles}
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            const { useState, useEffect, useMemo, useCallback } = React;
            
            ${cleanCode}
            
            // Try to render the component
            (function() {
              try {
                const root = ReactDOM.createRoot(document.getElementById('root'));
                // Try to find the component in the global scope or as a named export
                let ComponentToRender = null;
                
                // Check if component is available in current scope
                if (typeof ${componentName} !== 'undefined') {
                  ComponentToRender = ${componentName};
                } else {
                  // Try to find it in window (if exported to window)
                  ComponentToRender = window.${componentName};
                }
                
                if (!ComponentToRender) {
                  // Create a simple fallback component
                  ComponentToRender = () => React.createElement('div', {
                    style: {
                      padding: '24px',
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: '#374151'
                    }
                  }, 'Component "${componentName}" - Preview not available. Check code tab for component code.');
                }
                
                root.render(React.createElement(ComponentToRender, {}));
              } catch (error) {
                const errorMsg = error.message || 'Unknown error';
                const errorStack = error.stack || '';
                document.getElementById('root').innerHTML = 
                  '<div style="padding: 24px; color: #ef4444; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">' +
                  '<strong>Error rendering component:</strong><br>' +
                  errorMsg +
                  (errorStack ? '<pre style="margin-top: 12px; font-size: 11px; color: #991b1b; overflow: auto;">' + errorStack + '</pre>' : '') +
                  '</div>';
              }
            })();
          </script>
        </body>
      </html>
    `;
  }, [component.code, component.css, componentName]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{component.name}</h2>
          {component.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{component.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded">
            {component.version}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200/60 dark:border-zinc-800/60">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b transition-colors ${
            activeTab === 'preview'
              ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Eye size={16} />
          Preview
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b transition-colors ${
            activeTab === 'code'
              ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Code size={16} />
          Code
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'preview' ? (
          <div className="h-full bg-zinc-50 dark:bg-zinc-950">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              title={`Preview of ${component.name}`}
              sandbox="allow-scripts"
              onError={() => setPreviewError('Failed to load preview')}
            />
            {previewError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-zinc-900">
                <div className="text-center">
                  <AlertCircle size={32} className="mx-auto mb-2 text-red-500" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{previewError}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Component Code</h3>
              <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 text-xs overflow-auto max-h-96">
                <code className="text-zinc-900 dark:text-zinc-100">{component.code}</code>
              </pre>
            </div>
            {component.css && (
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">CSS</h3>
                <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 text-xs overflow-auto max-h-96">
                  <code className="text-zinc-900 dark:text-zinc-100">{component.css}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN MCP BUILDER
// ============================================================================

export const McpBuilder: React.FC = () => {
  const { projectId, tenantId, userId } = useProject();
  const { tenantId: tenantIdFromContext, userId: userIdFromContext } = useTenant();
  
  const effectiveTenantId = tenantIdFromContext || tenantId;
  const effectiveUserId = userIdFromContext || userId;

  // State
  const [figmaUrl, setFigmaUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<Id<"components"> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Convex queries
  const components = useQuery(
    api.components.list,
    projectId && effectiveTenantId && effectiveUserId
      ? { projectId, tenantId: effectiveTenantId, userId: effectiveUserId }
      : "skip"
  ) || [];

  // Filter components by search
  const filteredComponents = components.filter((c: any) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Convex mutations & actions
  const createComponent = useMutation(api.components.create);
  const updateComponent = useMutation(api.components.update);
  const removeComponent = useMutation(api.components.remove);
  const extractAndBuildFromMCP = useAction(api.claudeExtraction.extractAndBuildComponentFromMCP);
  const createProgress = useMutation(api.extractionProgress.create);
  const removeProgress = useMutation(api.extractionProgress.remove);

  // Selected component
  const selectedComponent = components.find((c: any) => c._id === selectedComponentId) as McpComponent | undefined;

  // Handle MCP extraction - client-side MCP calls, then server processing
  const handleExtractWithMCP = async () => {
    if (!figmaUrl.trim() || !projectId || !effectiveTenantId || !effectiveUserId) return;

    // Extract node ID from URL
    const nodeIdMatch = figmaUrl.match(/node-id=([^&]+)/);
    if (!nodeIdMatch) {
      setExtractionError('No node ID found in URL. Please select a specific component in Figma.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    console.log('[MCP BUILDER] Starting MCP extraction...');
    console.log('[MCP BUILDER] Figma URL:', figmaUrl);

    let componentId: Id<"components"> | null = null;
    let progressId: Id<"extractionProgress"> | null = null;

    try {
      // Step 1: Check if MCP server is available (client-side check)
      console.log('[MCP BUILDER] Checking MCP server connection...');
      const isMCPAvailable = await checkFigmaMCPConnection();
      
      if (!isMCPAvailable) {
        throw new Error(
          'Figma MCP server is not available. Please:\n' +
          '1. Open Figma desktop app\n' +
          '2. Enable Dev Mode (Shift + D)\n' +
          '3. Click "Enable desktop MCP server" in the right sidebar\n' +
          '4. Make sure the file is open in desktop app'
        );
      }

      // Step 2: Create progress tracker
      progressId = await createProgress({
        projectId,
        tenantId: effectiveTenantId,
        userId: effectiveUserId,
        figmaUrl,
      });

      // Step 3: Create placeholder component
      const tempName = `Component-${Date.now()}`;
      componentId = await createComponent({
        projectId,
        tenantId: effectiveTenantId,
        userId: effectiveUserId,
        name: tempName,
        status: 'draft',
        version: '0.0.0',
        code: '// Component extraction in progress using MCP...',
        docs: `## ${tempName}\n\nExtracting from Figma using MCP...\n\n**Figma URL:** ${figmaUrl}`,
        progressId,
      });

      setSelectedComponentId(componentId);

      // Step 4: Extract from Figma using MCP (client-side)
      console.log('[MCP BUILDER] Extracting component data from Figma MCP...');
      const mcpData = await extractComponentWithMCP(figmaUrl);
      
      if (!mcpData.designContext) {
        throw new Error('Failed to get design context from Figma MCP');
      }

      console.log('[MCP BUILDER] MCP data extracted, processing...');

      // Step 5: Process MCP data on server
      console.log('[MCP BUILDER] Calling server to process MCP data...');
      const result = await extractAndBuildFromMCP({
        projectId,
        tenantId: effectiveTenantId,
        userId: effectiveUserId,
        figmaUrl,
        mcpDesignContext: mcpData.designContext,
        mcpVariables: mcpData.variables,
        progressId,
      });

      console.log('[MCP BUILDER] Extraction successful!');
      console.log('[MCP BUILDER] Component name:', result.name);
      console.log('[MCP BUILDER] Code length:', result.code?.length || 0);

      // Step 6: Update component with extracted data
      if (componentId) {
        await updateComponent({
          id: componentId,
          tenantId: effectiveTenantId,
          userId: effectiveUserId,
          name: result.name,
          version: '1.0.0',
          code: result.code,
          docs: `## ${result.name}\n\n${result.description || ''}\n\n### CSS\n\`\`\`css\n${result.css || ''}\n\`\`\``,
          storybook: result.storybook || undefined,
          progressId,
        });
      }

      // Clear any errors
      setExtractionError(null);
      
    } catch (error: any) {
      console.error('[MCP BUILDER] Extraction failed:', error);
      const errorMessage = error.message || 'Failed to extract component';
      setExtractionError(errorMessage);
      
      // Delete component if extraction failed
      if (componentId) {
        try {
          await removeComponent({ id: componentId, tenantId: effectiveTenantId!, userId: effectiveUserId! });
        } catch (e) {
          console.error('Failed to delete component on error:', e);
        }
      }
      
      // Clean up progress
      if (progressId) {
        removeProgress({ progressId });
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle delete component
  const handleDeleteComponent = async (id: Id<"components">) => {
    if (!effectiveTenantId || !effectiveUserId) return;
    
    try {
      await removeComponent({ id, tenantId: effectiveTenantId, userId: effectiveUserId });
      if (selectedComponentId === id) {
        setSelectedComponentId(null);
      }
    } catch (error) {
      console.error('Failed to delete component:', error);
    }
  };

  // Validate Figma URL
  const isValidFigmaUrl = React.useMemo(() => {
    if (!figmaUrl.trim()) return false;
    try {
      const url = new URL(figmaUrl);
      return url.hostname.includes('figma.com') && 
             (url.pathname.includes('/file/') || url.pathname.includes('/design/')) &&
             url.searchParams.has('node-id');
    } catch {
      return false;
    }
  }, [figmaUrl]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar: Component List */}
      <div className="w-80 border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col bg-white dark:bg-zinc-900">
        {/* Header */}
        <div className="h-16 px-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-600" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">MCP Builder</h2>
          </div>
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
            disabled={isExtracting}
            className="w-full h-9 px-3 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
          />
          <button
            onClick={handleExtractWithMCP}
            disabled={!isValidFigmaUrl || isExtracting}
            className="w-full mt-2 h-9 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExtracting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Zap size={14} />
                Extract with MCP
              </>
            )}
          </button>
          
          {extractionError && (
            <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded text-xs text-violet-700 dark:text-violet-300 whitespace-pre-line">
              {extractionError}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components..."
              className="w-full h-8 pl-9 pr-3 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
        </div>

        {/* Component List */}
        <div className="flex-1 overflow-auto">
          {filteredComponents.length === 0 ? (
            <div className="p-8 text-center">
              <Layers size={32} className="mx-auto mb-3 text-zinc-400" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {searchQuery ? 'No components found' : 'No components yet'}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Extract a component from Figma to get started
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filteredComponents.map((component: any) => (
                <div
                  key={component._id}
                  onClick={() => setSelectedComponentId(component._id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                    selectedComponentId === component._id
                      ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {component.name}
                      </h3>
                      {component.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {component.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded">
                          {component.version}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          component.status === 'stable' 
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                            : component.status === 'review'
                            ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                        }`}>
                          {component.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComponent(component._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedComponent ? (
          <ComponentPreview component={selectedComponent} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="text-center">
              <Eye size={48} className="mx-auto mb-4 text-zinc-400" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                No Component Selected
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a component from the sidebar to preview it
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

