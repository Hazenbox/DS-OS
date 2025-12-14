"use node";

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { extractIRS } from "./irsExtraction";
import { extractIRT } from "./irtExtraction";
import { classifyComponent } from "./componentIntelligence";
import { extractIML } from "./imlExtraction";
import { generateComponentCode } from "./codeGenerator";
import { matchFigmaVarsToTokens } from "./tokenCompiler";
import { IRS, IRT, IML } from "../src/types/ir";

// ============================================================================
// TYPES
// ============================================================================

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: any[];
  strokes?: any[];
  effects?: any[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  constraints?: { vertical: string; horizontal: string };
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  opacity?: number;
  blendMode?: string;
  style?: any;
  characters?: string;
  boundVariables?: Record<string, any>;
  componentPropertyDefinitions?: Record<string, any>;
  variantProperties?: Record<string, string>;
}

interface ExtractedComponent {
  name: string;
  description: string;
  code: string;
  css: string;
  storybook?: string;
  variants: Array<{
    name: string;
    properties: Record<string, string>;
    css: string;
  }>;
  extractedProperties: Record<string, any>;
  usedVariables: Array<{ name: string; value: string; type?: string; cssVar?: string }>;
  tokenMatches?: any[];
  irs?: IRS;
  irt?: IRT;
  iml?: IML;
}

// ============================================================================
// FIGMA MCP CLIENT (Server-side)
// ============================================================================

const FIGMA_MCP_SERVER_URL = 'http://127.0.0.1:3845/mcp';

async function callFigmaMCPTool(method: string, params: any): Promise<any> {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: method,
      arguments: params,
    },
  };

  try {
    const response = await fetch(FIGMA_MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`MCP error: ${result.error.message} (code: ${result.error.code})`);
    }

    return result.result;
  } catch (error) {
    console.error('[FIGMA MCP] Error calling MCP tool:', error);
    throw error;
  }
}

async function checkFigmaMCPConnection(): Promise<boolean> {
  try {
    const response = await fetch(FIGMA_MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function getFigmaDesignContext(nodeId: string): Promise<any> {
  return await callFigmaMCPTool('mcp_figma-desktop_get_design_context', {
    nodeId,
    clientLanguages: 'typescript,html,css',
    clientFrameworks: 'react',
  });
}

async function getFigmaVariableDefs(nodeId: string): Promise<any> {
  return await callFigmaMCPTool('mcp_figma-desktop_get_variable_defs', {
    nodeId,
  });
}

// ============================================================================
// MCP-BASED EXTRACTION ACTION
// ============================================================================

export const extractAndBuildComponentWithMCP = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    figmaUrl: v.string(),
    progressId: v.optional(v.id("extractionProgress")),
  },
  handler: async (ctx, args): Promise<ExtractedComponent> => {
    // Helper to update progress
    const updateProgress = async (stepId: string, status: "in_progress" | "completed" | "failed", details?: string) => {
      if (args.progressId) {
        await ctx.runMutation(internal.extractionProgress.updateStep, {
          progressId: args.progressId,
          stepId,
          status,
          details,
        });
      }
    };

    try {
      // Step 1: Validate
      await updateProgress("validate", "in_progress");
      await ctx.runQuery(api.tenants.get, {
        tenantId: args.tenantId,
        userId: args.userId,
      });

      const project = await ctx.runQuery(api.projects.get, {
        id: args.projectId,
        tenantId: args.tenantId,
        userId: args.userId,
      });

      if (!project) {
        await updateProgress("validate", "failed", "Project not found");
        throw new Error('Project not found or access denied');
      }

      const urlMatch = args.figmaUrl.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
      if (!urlMatch) {
        await updateProgress("validate", "failed", "Invalid Figma URL");
        throw new Error('Invalid Figma URL');
      }
      const fileKey = urlMatch[2];

      const nodeIdMatch = args.figmaUrl.match(/node-id=([^&]+)/);
      if (!nodeIdMatch) {
        await updateProgress("validate", "failed", "No node ID found");
        throw new Error('No node ID found in URL. Please select a specific component.');
      }
      
      // Convert node ID format for MCP (1-2 -> 1:2)
      const nodeId = decodeURIComponent(nodeIdMatch[1]).replace(/-/g, ':');
      await updateProgress("validate", "completed");

      // Step 2: Check MCP connection
      await updateProgress("mcp_connect", "in_progress");
      const isMCPAvailable = await checkFigmaMCPConnection();
      
      if (!isMCPAvailable) {
        await updateProgress("mcp_connect", "failed", "Figma MCP server not available");
        throw new Error(
          'Figma MCP server is not available. Please:\n' +
          '1. Open Figma desktop app\n' +
          '2. Enable Dev Mode (Shift + D)\n' +
          '3. Click "Enable desktop MCP server" in the right sidebar\n' +
          '4. Make sure the file is open in desktop app'
        );
      }
      await updateProgress("mcp_connect", "completed");

      // Step 3: Fetch from Figma using MCP
      await updateProgress("fetch", "in_progress");
      console.log(`[FIGMA MCP] Fetching design context for node: ${nodeId}`);

      const [designContext, variablesResult] = await Promise.allSettled([
        getFigmaDesignContext(nodeId),
        getFigmaVariableDefs(nodeId).catch(() => null),
      ]);

      if (designContext.status === 'rejected') {
        await updateProgress("fetch", "failed", designContext.reason?.message || "Failed to fetch from MCP");
        throw new Error(`Failed to fetch design context: ${designContext.reason?.message || 'Unknown error'}`);
      }

      const mcpDesignContext = designContext.value;
      const mcpVariables = variablesResult.status === 'fulfilled' ? variablesResult.value : null;

      // Extract node data from MCP design context
      let nodeData: FigmaNode;
      if (mcpDesignContext.document) {
        nodeData = mcpDesignContext.document;
      } else if (mcpDesignContext.node) {
        nodeData = mcpDesignContext.node;
      } else if (mcpDesignContext.id) {
        nodeData = mcpDesignContext as FigmaNode;
      } else {
        throw new Error('Invalid MCP design context format');
      }

      if (!nodeData) {
        await updateProgress("fetch", "failed", "Invalid MCP data");
        throw new Error('Could not extract node data from MCP design context');
      }

      await updateProgress("fetch", "completed", `Found component: ${nodeData.name}`);

      // Process variables from MCP
      const variables = mcpVariables?.meta?.variables || mcpVariables?.variables || {};
      const variableCollections = mcpVariables?.meta?.variableCollections || mcpVariables?.variableCollections || {};

      // Step 4: Extract structure
      await updateProgress("extract_structure", "in_progress");
      const irs = extractIRS(nodeData, args.figmaUrl, fileKey);
      await updateProgress("extract_structure", "completed", `${irs.tree.length} nodes, ${irs.variants.length} variants`);

      // Step 5: Extract tokens
      await updateProgress("extract_tokens", "in_progress");
      const allNodes = [nodeData, ...(nodeData.children || [])];
      const irt = extractIRT(variables, variableCollections, allNodes);
      await updateProgress("extract_tokens", "completed", `${irt.tokens.length} tokens, ${Object.keys(irt.modeValues).length} modes`);

      // Step 6: Classify
      await updateProgress("classify", "in_progress");
      const componentIntelligence = classifyComponent(irs);
      const iml = extractIML(irs, componentIntelligence);
      await updateProgress("classify", "completed", `${componentIntelligence.category} (${Math.round(componentIntelligence.confidence * 100)}% confidence)`);

      // Step 7: Get project tokens
      const projectTokens = await ctx.runQuery(api.tokens.list, {
        projectId: args.projectId,
        tenantId: args.tenantId,
        userId: args.userId,
      });

      const figmaVarsArray = Object.entries(variables).map(([id, varData]: [string, any]) => ({
        id,
        name: varData.name || '',
        value: formatVariableValue(Object.values(varData.valuesByMode || {})[0], varData.resolvedType || ''),
        type: varData.resolvedType || '',
      }));

      const tokenMatches = matchFigmaVarsToTokens(
        figmaVarsArray,
        (projectTokens || []).map((t: { name: string; value: string; type: string }) => ({
          name: t.name,
          value: t.value,
          type: t.type,
        }))
      );

      // Step 8: Generate component
      await updateProgress("generate_component", "in_progress");
      const componentName = nodeData.name.replace(/[^a-zA-Z0-9]/g, '');
      let generatedCode;
      try {
        generatedCode = generateComponentCode(componentName, irs, irt, iml);
        await updateProgress("generate_component", "completed", `${generatedCode.component.length} chars`);
      } catch (error) {
        await updateProgress("generate_component", "failed", error instanceof Error ? error.message : "Generation failed");
        throw error;
      }

      // Step 9: Generate styles
      await updateProgress("generate_styles", "in_progress");
      await updateProgress("generate_styles", "completed", `${generatedCode.styles.length} chars`);

      const code = generatedCode.component;
      const css = generatedCode.styles;

      // Step 10: Finalize
      await updateProgress("finalize", "in_progress");
      await updateProgress("finalize", "completed");

      // Generate Storybook story
      const storybook = generatedCode.storybook || '';

      return {
        name: componentName,
        description: `Extracted from Figma using MCP: ${nodeData.name}`,
        code,
        css,
        storybook,
        variants: irs.variants.slice(0, 20).map(v => ({
          name: Object.values(v.properties || {}).join(' / '),
          properties: v.properties || {},
          css: '',
        })),
        extractedProperties: {},
        usedVariables: [],
        tokenMatches,
        irs,
        irt,
        iml,
      };
    } catch (error) {
      if (args.progressId) {
        await ctx.runMutation(internal.extractionProgress.updateStatus, {
          progressId: args.progressId,
          status: "failed",
          currentStep: "Extraction failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      throw error;
    }
  },
});

function formatVariableValue(value: any, type: string): string {
  if (type === 'COLOR' && typeof value === 'object') {
    const { r, g, b, a } = value;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a ?? 1})`;
  }
  if (type === 'FLOAT') {
    return `${value}px`;
  }
  return String(value);
}

