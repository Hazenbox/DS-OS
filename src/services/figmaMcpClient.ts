/**
 * Figma MCP Client for DS-OS
 * 
 * This client connects to the Figma Desktop MCP server via Vite proxy
 * to avoid CORS issues. The proxy routes /api/figma-mcp to http://127.0.0.1:3845/mcp
 */

const FIGMA_MCP_SERVER_URL = '/api/figma-mcp';

// Connection state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export interface FigmaMCPExtractionOptions {
  figmaUrl: string;
  projectId: string;
  tenantId: string;
  userId: string;
  progressId?: string;
}

export interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Parse Server-Sent Events (SSE) response format
 * SSE format: "event: message\ndata: {...json...}\n\n"
 */
function parseSSEResponse(sseText: string): MCPResponse | null {
  try {
    // SSE format: lines starting with "data:" contain JSON
    const lines = sseText.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6); // Remove "data: " prefix
        return JSON.parse(jsonStr);
      }
    }
    // If no "data:" line found, try parsing the whole thing as JSON
    return JSON.parse(sseText);
  } catch {
    return null;
  }
}

/**
 * Initialize MCP connection with Figma server
 */
async function initializeMCP(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const response = await fetch(FIGMA_MCP_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'ds-os',
              version: '1.0.0',
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FIGMA MCP CLIENT] Initialize failed:', response.status, errorText);
        throw new Error(`MCP initialization failed: ${response.status} ${response.statusText}`);
      }

      // Parse response - could be JSON or SSE format
      const responseText = await response.text();
      let result: MCPResponse;
      
      try {
        // Try parsing as JSON first
        result = JSON.parse(responseText);
      } catch {
        // If not JSON, try parsing as SSE (Server-Sent Events)
        const sseData = parseSSEResponse(responseText);
        if (sseData) {
          result = sseData;
        } else {
          throw new Error(`Failed to parse MCP response: ${responseText.substring(0, 100)}`);
        }
      }
      
      if (result.error) {
        console.error('[FIGMA MCP CLIENT] Initialize error:', result.error);
        throw new Error(`MCP initialization error: ${result.error.message} (code: ${result.error.code})`);
      }

      // Send initialized notification
      await fetch(FIGMA_MCP_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'notifications/initialized',
        }),
      });

      isInitialized = true;
      console.log('[FIGMA MCP CLIENT] MCP connection initialized successfully');
    } catch (error: any) {
      console.error('[FIGMA MCP CLIENT] Failed to initialize MCP:', error);
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Check if Figma MCP server is available
 */
export async function checkFigmaMCPConnection(): Promise<boolean> {
  try {
    // Try to initialize - if it succeeds, server is available
    await initializeMCP();
    return true;
  } catch (error: any) {
    console.error('[FIGMA MCP CLIENT] MCP connection check failed:', error);
    
    // Network errors mean server is not reachable
    if (error.message?.includes('Failed to fetch') || 
        error.message?.includes('NetworkError') ||
        error.message?.includes('ECONNREFUSED')) {
      console.error('[FIGMA MCP CLIENT] Cannot reach MCP server. Make sure:\n' +
        '1. Figma desktop app is running\n' +
        '2. MCP server is enabled (Dev Mode → Enable desktop MCP server)\n' +
        '3. The file is open in Figma desktop app');
      return false;
    }
    // Other errors might mean server is up but initialization failed
    // Reset state to allow retry
    isInitialized = false;
    initializationPromise = null;
    return false;
  }
}

/**
 * Make an MCP tool call to Figma
 * Figma MCP server uses direct method calls, not tools/call wrapper
 */
async function callMCPTool(toolName: string, params: any): Promise<any> {
  // Ensure MCP is initialized before making tool calls
  await initializeMCP();

  // Try direct method call first (Figma MCP might not use tools/call wrapper)
  // If that fails, we'll try tools/call as fallback
  let request: MCPRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: toolName, // Direct method call: 'mcp_figma-desktop_get_design_context'
    params: params, // Parameters directly in params
  };

  try {
    console.log('[FIGMA MCP CLIENT] Calling tool:', toolName, 'with params:', params);
    console.log('[FIGMA MCP CLIENT] Request body:', JSON.stringify(request, null, 2));
    
    // Try direct method call first
    let response = await fetch(FIGMA_MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2024-11-05',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: toolName,
        params: params,
      }),
    });
    
    // If direct call fails with "initialize" error, try tools/call format
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message?.includes('initialize request')) {
          console.log('[FIGMA MCP CLIENT] Direct call failed, trying tools/call format...');
          request = {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: params,
            },
          };
          response = await fetch(FIGMA_MCP_SERVER_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream',
              'MCP-Protocol-Version': '2024-11-05',
            },
            body: JSON.stringify(request),
          });
        }
      } catch {
        // If we can't parse error, continue with original response
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FIGMA MCP CLIENT] MCP server error:', response.status, errorText);
      console.error('[FIGMA MCP CLIENT] Request that failed:', JSON.stringify(request, null, 2));
      
      // Try to parse error for better message
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          const errorMsg = errorData.error.message || 'Unknown error';
          const errorCode = errorData.error.code || 'UNKNOWN';
          
          // If direct method call failed with "initialize" error, try tools/call format
          if (errorMsg.includes('initialize request') && request.method === toolName) {
            console.log('[FIGMA MCP CLIENT] Direct method call failed, trying tools/call format...');
            // Retry with tools/call format
            request = {
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };
            
            const retryResponse = await fetch(FIGMA_MCP_SERVER_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
              },
              body: JSON.stringify(request),
            });
            
            if (retryResponse.ok) {
              const retryText = await retryResponse.text();
              let retryResult: MCPResponse;
              try {
                retryResult = JSON.parse(retryText);
              } catch {
                const sseData = parseSSEResponse(retryText);
                if (sseData) {
                  retryResult = sseData;
                } else {
                  throw new Error(`Failed to parse retry response: ${retryText.substring(0, 100)}`);
                }
              }
              
              if (retryResult.error) {
                throw new Error(`MCP error: ${retryResult.error.message} (code: ${retryResult.error.code})`);
              }
              
              return retryResult.result;
            }
          }
          
          throw new Error(`MCP error: ${errorMsg} (code: ${errorCode})`);
        }
      } catch (parseError) {
        // If parsing fails, use generic error
        console.error('[FIGMA MCP CLIENT] Failed to parse error response:', parseError);
      }
      
      throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
    }

    // Parse response - could be JSON or SSE format
    const responseText = await response.text();
    let result: MCPResponse;
    
    try {
      // Try parsing as JSON first
      result = JSON.parse(responseText);
    } catch {
      // If not JSON, try parsing as SSE (Server-Sent Events)
      const sseData = parseSSEResponse(responseText);
      if (sseData) {
        result = sseData;
      } else {
        throw new Error(`Failed to parse MCP response: ${responseText.substring(0, 100)}`);
      }
    }

    if (result.error) {
      console.error('[FIGMA MCP CLIENT] MCP tool error:', result.error);
      const errorMsg = result.error.message || 'Unknown MCP error';
      const errorCode = result.error.code || 'UNKNOWN';
      
      // Provide specific guidance for common errors
      if (errorCode === -32000 && errorMsg.includes('initialize')) {
        // Reset initialization state and retry
        isInitialized = false;
        initializationPromise = null;
        throw new Error('MCP connection lost. Please try again.');
      }
      
      throw new Error(`MCP error: ${errorMsg} (code: ${errorCode})`);
    }

    return result.result;
  } catch (error: any) {
    console.error('[FIGMA MCP CLIENT] Error calling MCP tool:', error);
    
    // Provide helpful error messages for common issues
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(
        'Cannot connect to Figma MCP server. Please ensure:\n' +
        '1. Figma desktop app is running\n' +
        '2. Dev Mode is enabled (Shift + D)\n' +
        '3. MCP server is enabled in the right sidebar\n' +
        '4. The file is open in Figma desktop app'
      );
    }
    throw error;
  }
}

/**
 * Get design context from Figma using MCP
 */
export async function getFigmaDesignContext(
  nodeId: string,
  clientLanguages: string = 'typescript,html,css',
  clientFrameworks: string = 'react'
): Promise<any> {
  return await callMCPTool('mcp_figma-desktop_get_design_context', {
    nodeId,
    clientLanguages,
    clientFrameworks,
  });
}

/**
 * Get variable definitions from Figma using MCP
 */
export async function getFigmaVariableDefs(nodeId: string): Promise<any> {
  return await callMCPTool('mcp_figma-desktop_get_variable_defs', {
    nodeId,
  });
}

/**
 * Get screenshot from Figma using MCP
 */
export async function getFigmaScreenshot(nodeId: string): Promise<any> {
  return await callMCPTool('mcp_figma-desktop_get_screenshot', {
    nodeId,
  });
}

/**
 * Extract node ID from Figma URL for MCP tools
 */
export function extractNodeIdFromFigmaUrl(figmaUrl: string): string | null {
  const nodeIdMatch = figmaUrl.match(/node-id=([^&]+)/);
  if (!nodeIdMatch) {
    return null;
  }
  
  // Convert format: "1-2" to "1:2" for MCP
  return decodeURIComponent(nodeIdMatch[1]).replace(/-/g, ':');
}

/**
 * Extract component using Figma MCP tools
 */
export async function extractComponentWithMCP(
  figmaUrl: string
): Promise<{ designContext: any; variables?: any; screenshot?: any }> {
  // Extract node ID
  const nodeId = extractNodeIdFromFigmaUrl(figmaUrl);
  if (!nodeId) {
    throw new Error('No node ID found in Figma URL. Please select a specific component in Figma.');
  }

  console.log('[FIGMA MCP CLIENT] Extracting component with node ID:', nodeId);

  // Check if MCP server is available and initialize
  const isAvailable = await checkFigmaMCPConnection();
  if (!isAvailable) {
    throw new Error(
      'Figma MCP server is not available. Please:\n' +
      '1. Open Figma desktop app\n' +
      '2. Enable Dev Mode (Shift + D)\n' +
      '3. Click "Enable desktop MCP server" in the right sidebar\n' +
      '4. Make sure the file is open in desktop app'
    );
  }

  // Call MCP tools with better error handling
  console.log('[FIGMA MCP CLIENT] Calling MCP tools for node:', nodeId);
  
  const [designContext, variables, screenshot] = await Promise.allSettled([
    getFigmaDesignContext(nodeId).catch((error) => {
      console.error('[FIGMA MCP CLIENT] Failed to get design context:', error);
      throw error;
    }),
    getFigmaVariableDefs(nodeId).catch((error) => {
      console.warn('[FIGMA MCP CLIENT] Failed to get variables (optional):', error);
      return null; // Variables are optional
    }),
    getFigmaScreenshot(nodeId).catch((error) => {
      console.warn('[FIGMA MCP CLIENT] Failed to get screenshot (optional):', error);
      return null; // Screenshot is optional
    }),
  ]);

  // Check if design context was successfully retrieved
  if (designContext.status === 'rejected') {
    const error = designContext.reason;
    console.error('[FIGMA MCP CLIENT] Design context extraction failed:', error);
    throw new Error(
      `Failed to extract design context: ${error.message || 'Unknown error'}\n\n` +
      'Please verify:\n' +
      '1. The node ID is correct\n' +
      '2. The component exists in the Figma file\n' +
      '3. You have access to the file'
    );
  }

  if (!designContext.value) {
    throw new Error('Design context is empty. The component may not exist or may not be accessible.');
  }

  console.log('[FIGMA MCP CLIENT] Successfully extracted MCP data');
  console.log('[FIGMA MCP CLIENT] Design context:', designContext.value ? '✓' : '✗');
  console.log('[FIGMA MCP CLIENT] Variables:', variables.status === 'fulfilled' && variables.value ? '✓' : '✗');
  console.log('[FIGMA MCP CLIENT] Screenshot:', screenshot.status === 'fulfilled' && screenshot.value ? '✓' : '✗');

  return {
    designContext: designContext.value,
    variables: variables.status === 'fulfilled' ? variables.value : null,
    screenshot: screenshot.status === 'fulfilled' ? screenshot.value : null,
  };
}
