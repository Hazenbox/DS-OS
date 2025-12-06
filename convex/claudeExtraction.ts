"use node";

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

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

interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, any>;
}

interface ExtractedComponent {
  name: string;
  description: string;
  code: string;
  css: string;
  variants: Array<{
    name: string;
    properties: Record<string, string>;
    css: string;
  }>;
  extractedProperties: Record<string, any>;
  usedVariables: Array<{ name: string; value: string; type?: string }>;
}

// ============================================================================
// FIGMA API HELPERS
// ============================================================================

async function fetchFigmaFile(fileKey: string, accessToken: string): Promise<any> {
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}`,
    {
      headers: {
        'X-Figma-Token': accessToken,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchFigmaNode(fileKey: string, nodeId: string, accessToken: string): Promise<any> {
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
    {
      headers: {
        'X-Figma-Token': accessToken,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchFigmaVariables(fileKey: string, accessToken: string): Promise<any> {
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/variables/local`,
    {
      headers: {
        'X-Figma-Token': accessToken,
      },
    }
  );
  
  if (!response.ok) {
    // Variables API might not be available for all files
    console.warn('Could not fetch variables:', response.status);
    return { meta: { variables: {}, variableCollections: {} } };
  }
  
  return response.json();
}

// ============================================================================
// EXTRACTION HELPERS
// ============================================================================

function extractNodeProperties(node: FigmaNode): Record<string, any> {
  const props: Record<string, any> = {};
  
  // Dimensions
  if (node.absoluteBoundingBox) {
    props.width = node.absoluteBoundingBox.width;
    props.height = node.absoluteBoundingBox.height;
  }
  
  // Layout (Auto Layout)
  if (node.layoutMode) {
    props.display = 'flex';
    props.flexDirection = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    props.justifyContent = mapAlignment(node.primaryAxisAlignItems);
    props.alignItems = mapAlignment(node.counterAxisAlignItems);
    props.gap = node.itemSpacing;
    props.paddingTop = node.paddingTop;
    props.paddingRight = node.paddingRight;
    props.paddingBottom = node.paddingBottom;
    props.paddingLeft = node.paddingLeft;
  }
  
  // Border Radius
  if (node.cornerRadius !== undefined) {
    props.borderRadius = node.cornerRadius;
  } else if (node.rectangleCornerRadii) {
    props.borderRadius = node.rectangleCornerRadii.join('px ') + 'px';
  }
  
  // Fills (Background)
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const { r, g, b } = fill.color;
      const a = fill.opacity ?? 1;
      props.backgroundColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    } else if (fill.type === 'GRADIENT_LINEAR') {
      props.background = extractGradient(fill);
    }
  }
  
  // Strokes (Border)
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID' && stroke.visible !== false) {
      const { r, g, b } = stroke.color;
      props.borderColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
      props.borderWidth = (node as any).strokeWeight || 1;
      props.borderStyle = 'solid';
    }
  }
  
  // Effects (Shadows, Blur)
  if (node.effects && node.effects.length > 0) {
    const shadows: string[] = [];
    for (const effect of node.effects) {
      if (effect.visible === false) continue;
      
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        const { r, g, b, a } = effect.color;
        const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : '';
        shadows.push(
          `${inset}${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`
        );
      } else if (effect.type === 'LAYER_BLUR') {
        props.filter = `blur(${effect.radius}px)`;
      } else if (effect.type === 'BACKGROUND_BLUR') {
        props.backdropFilter = `blur(${effect.radius}px)`;
      }
    }
    if (shadows.length > 0) {
      props.boxShadow = shadows.join(', ');
    }
  }
  
  // Opacity
  if (node.opacity !== undefined && node.opacity !== 1) {
    props.opacity = node.opacity;
  }
  
  // Typography (for text nodes)
  if (node.type === 'TEXT' && node.style) {
    props.fontFamily = node.style.fontFamily;
    props.fontSize = node.style.fontSize;
    props.fontWeight = node.style.fontWeight;
    props.lineHeight = node.style.lineHeightPx ? `${node.style.lineHeightPx}px` : 'normal';
    props.letterSpacing = node.style.letterSpacing ? `${node.style.letterSpacing}px` : 'normal';
    props.textAlign = node.style.textAlignHorizontal?.toLowerCase();
  }
  
  return props;
}

function mapAlignment(alignment?: string): string {
  const map: Record<string, string> = {
    'MIN': 'flex-start',
    'CENTER': 'center',
    'MAX': 'flex-end',
    'SPACE_BETWEEN': 'space-between',
  };
  return map[alignment || 'MIN'] || 'flex-start';
}

function extractGradient(fill: any): string {
  if (!fill.gradientStops) return 'transparent';
  
  const stops = fill.gradientStops.map((stop: any) => {
    const { r, g, b, a } = stop.color;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a ?? 1}) ${Math.round(stop.position * 100)}%`;
  }).join(', ');
  
  return `linear-gradient(180deg, ${stops})`;
}

function extractVariants(node: FigmaNode): Array<{ name: string; properties: Record<string, string> }> {
  const variants: Array<{ name: string; properties: Record<string, string> }> = [];
  
  // Check if this is a component set with variants
  if (node.type === 'COMPONENT_SET' && node.children) {
    for (const child of node.children) {
      if (child.variantProperties) {
        variants.push({
          name: child.name,
          properties: child.variantProperties,
        });
      }
    }
  }
  
  return variants;
}

function findBoundVariables(
  node: FigmaNode, 
  variables: Record<string, FigmaVariable>
): Array<{ name: string; value: string; type?: string }> {
  const usedVars: Array<{ name: string; value: string; type?: string }> = [];
  
  if (node.boundVariables) {
    for (const [prop, binding] of Object.entries(node.boundVariables)) {
      const varId = (binding as any)?.id;
      if (varId && variables[varId]) {
        const variable = variables[varId];
        const value = Object.values(variable.valuesByMode)[0];
        usedVars.push({
          name: variable.name,
          value: formatVariableValue(value, variable.resolvedType),
          type: variable.resolvedType.toLowerCase(),
        });
      }
    }
  }
  
  // Recursively check children
  if (node.children) {
    for (const child of node.children) {
      usedVars.push(...findBoundVariables(child, variables));
    }
  }
  
  return usedVars;
}

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

// ============================================================================
// CLAUDE API
// ============================================================================

async function generateComponentWithClaude(
  componentName: string,
  nodeData: FigmaNode,
  extractedProps: Record<string, any>,
  variants: Array<{ name: string; properties: Record<string, string> }>,
  usedVariables: Array<{ name: string; value: string; type?: string }>,
  claudeApiKey: string
): Promise<{ code: string; css: string }> {
  
  const prompt = `You are an expert React/TypeScript developer. Generate a production-ready React component based on this Figma design data.

## Component Name: ${componentName}

## Extracted Properties:
${JSON.stringify(extractedProps, null, 2)}

## Variants (${variants.length} total):
${variants.slice(0, 10).map(v => `- ${v.name}: ${JSON.stringify(v.properties)}`).join('\n')}

## Design Variables Used:
${usedVariables.map(v => `- ${v.name}: ${v.value} (${v.type})`).join('\n')}

## Requirements:
1. Create a TypeScript React functional component
2. Use CSS variables for design tokens where appropriate
3. Support all variant properties as props
4. Include proper TypeScript types
5. Make it production-ready with proper accessibility attributes
6. Use CSS modules or inline styles that match the Figma design exactly

## Output Format:
Return ONLY valid JSON with this structure (no markdown, no explanation):
{
  "code": "// Full React component code here",
  "css": "/* Full CSS here */"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text || '';
  
  // Parse the JSON response
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (e) {
    // Fallback: return the raw content
    return {
      code: content,
      css: '',
    };
  }
}

// ============================================================================
// MAIN EXTRACTION ACTION
// ============================================================================

export const extractAndBuildComponent = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    figmaUrl: v.string(),
  },
  handler: async (ctx, args): Promise<ExtractedComponent> => {
    // Verify tenant access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    // Verify project belongs to tenant
    const project = await ctx.runQuery(api.projects.get, {
      id: args.projectId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    if (!project) {
      throw new Error('Project not found or access denied');
    }
    
    // Parse Figma URL
    const urlMatch = args.figmaUrl.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
    if (!urlMatch) {
      throw new Error('Invalid Figma URL');
    }
    const fileKey = urlMatch[2];
    
    // Extract node ID from URL
    const nodeIdMatch = args.figmaUrl.match(/node-id=([^&]+)/);
    const nodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]).replace('-', ':') : null;
    
    if (!nodeId) {
      throw new Error('No node ID found in URL. Please select a specific component.');
    }
    
    // Get API keys from settings (now tenant-scoped)
    // Figma PAT is stored with key 'figma_pat' (set via api.figma.setFigmaPat)
    const figmaPat = await ctx.runQuery(api.settings.get, { 
      tenantId: args.tenantId,
      userId: args.userId, 
      key: 'figma_pat' 
    });
    
    const claudeApiKey = await ctx.runQuery(api.settings.get, { 
      tenantId: args.tenantId,
      userId: args.userId, 
      key: 'claudeApiKey' 
    });
    
    if (!figmaPat) {
      throw new Error('Figma Personal Access Token not configured. Please add it in Settings.');
    }
    
    if (!claudeApiKey) {
      throw new Error('Claude API Key not configured. Please add it in Settings.');
    }
    
    // Fetch data from Figma
    console.log(`Fetching Figma node: ${fileKey}/${nodeId}`);
    
    const [nodeResponse, variablesResponse] = await Promise.all([
      fetchFigmaNode(fileKey, nodeId, figmaPat),
      fetchFigmaVariables(fileKey, figmaPat),
    ]);
    
    const nodeData = nodeResponse.nodes?.[nodeId]?.document;
    if (!nodeData) {
      throw new Error('Could not find the specified node in Figma');
    }
    
    const variables = variablesResponse.meta?.variables || {};
    
    // Extract properties
    const componentName = nodeData.name.replace(/[^a-zA-Z0-9]/g, '');
    const extractedProps = extractNodeProperties(nodeData);
    const variants = extractVariants(nodeData);
    const usedVariables = findBoundVariables(nodeData, variables);
    
    console.log(`Extracted: ${componentName}, ${variants.length} variants, ${usedVariables.length} variables`);
    
    // Generate code with Claude
    const { code, css } = await generateComponentWithClaude(
      componentName,
      nodeData,
      extractedProps,
      variants,
      usedVariables,
      claudeApiKey
    );
    
    // Build variant CSS
    const variantCss = variants.slice(0, 10).map(v => {
      const variantClass = Object.values(v.properties).join('-').toLowerCase().replace(/\s+/g, '-');
      return `.${componentName.toLowerCase()}--${variantClass} { /* variant styles */ }`;
    }).join('\n');
    
    return {
      name: componentName,
      description: `Extracted from Figma: ${nodeData.name}`,
      code,
      css: css + '\n\n' + variantCss,
      variants: variants.slice(0, 20).map(v => ({
        name: Object.values(v.properties).join(' / '),
        properties: v.properties,
        css: '',
      })),
      extractedProperties: extractedProps,
      usedVariables,
    };
  },
});

// ============================================================================
// GET API KEY STATUS
// ============================================================================

export const getApiKeyStatus = action({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ hasFigmaPat: boolean; hasClaudeApiKey: boolean }> => {
    // Verify tenant access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    const figmaPat: string | null = await ctx.runQuery(api.settings.get, { 
      tenantId: args.tenantId,
      userId: args.userId, 
      key: 'figma_pat' 
    });
    
    const claudeApiKey: string | null = await ctx.runQuery(api.settings.get, { 
      tenantId: args.tenantId,
      userId: args.userId, 
      key: 'claudeApiKey' 
    });
    
    return {
      hasFigmaPat: !!figmaPat,
      hasClaudeApiKey: !!claudeApiKey,
    };
  },
});

