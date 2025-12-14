/**
 * Figma MCP-based Component Extractor
 * 
 * This service uses Figma MCP tools to extract component data directly from Figma.
 * It provides an alternative to the REST API-based extraction.
 */

export interface FigmaMCPExtractionResult {
  designContext: any;
  variables?: Record<string, any>;
  nodeId: string;
  componentName: string;
  metadata?: any;
}

/**
 * Extract component using Figma MCP tools
 * This function is designed to be called with MCP tool results
 */
export async function extractWithFigmaMCP(
  figmaUrl: string,
  useMCP: boolean = true
): Promise<FigmaMCPExtractionResult | null> {
  if (!useMCP) {
    return null;
  }

  // Extract node ID from Figma URL
  const nodeIdMatch = figmaUrl.match(/node-id=([^&]+)/);
  if (!nodeIdMatch) {
    throw new Error('No node ID found in Figma URL');
  }

  // Convert node ID format (e.g., "1-2" to "1:2")
  const nodeId = decodeURIComponent(nodeIdMatch[1]).replace(/-/g, ':');

  // This function will be called with MCP tool results
  // The actual MCP calls will be made by the AI assistant
  return {
    nodeId,
    componentName: 'Component',
    designContext: null, // Will be populated by MCP tools
    variables: {},
    metadata: {},
  };
}

/**
 * Process MCP design context into component data
 */
export function processMCPDesignContext(designContext: any): {
  nodeData: any;
  variables: Record<string, any>;
  variableCollections: Record<string, any>;
} {
  if (!designContext) {
    throw new Error('No design context provided');
  }

  // Extract node data from MCP design context
  // The structure depends on what MCP returns
  const nodeData = designContext.node || designContext.document || designContext;
  
  // Extract variables if available
  const variables = designContext.variables || {};
  const variableCollections = designContext.variableCollections || {};

  return {
    nodeData,
    variables,
    variableCollections,
  };
}

/**
 * Convert MCP design context to FigmaNode format
 */
export function convertMCPToFigmaNode(mcpData: any): any {
  // This function converts MCP format to the FigmaNode format expected by the extraction pipeline
  if (!mcpData) {
    return null;
  }

  // MCP design context may have a different structure
  // We need to map it to the expected FigmaNode interface
  return {
    id: mcpData.id || mcpData.nodeId,
    name: mcpData.name || mcpData.componentName || 'Component',
    type: mcpData.type || 'COMPONENT',
    children: mcpData.children || [],
    fills: mcpData.fills || [],
    strokes: mcpData.strokes || [],
    effects: mcpData.effects || [],
    absoluteBoundingBox: mcpData.absoluteBoundingBox || mcpData.bounds,
    constraints: mcpData.constraints,
    layoutMode: mcpData.layoutMode,
    primaryAxisSizingMode: mcpData.primaryAxisSizingMode,
    counterAxisSizingMode: mcpData.counterAxisSizingMode,
    primaryAxisAlignItems: mcpData.primaryAxisAlignItems,
    counterAxisAlignItems: mcpData.counterAxisAlignItems,
    paddingLeft: mcpData.paddingLeft,
    paddingRight: mcpData.paddingRight,
    paddingTop: mcpData.paddingTop,
    paddingBottom: mcpData.paddingBottom,
    itemSpacing: mcpData.itemSpacing,
    cornerRadius: mcpData.cornerRadius,
    rectangleCornerRadii: mcpData.rectangleCornerRadii,
    opacity: mcpData.opacity,
    blendMode: mcpData.blendMode,
    style: mcpData.style,
    characters: mcpData.characters,
    boundVariables: mcpData.boundVariables,
    componentPropertyDefinitions: mcpData.componentPropertyDefinitions,
    variantProperties: mcpData.variantProperties,
  };
}

