"use node";

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { extractIRS } from "./irsExtraction";
import { extractIRT } from "./irtExtraction";
import { classifyComponent } from "./componentIntelligence";
import { extractIML } from "./imlExtraction";
import { generateComponentCode } from "./codeGenerator";
import { normalizeTokenName, matchFigmaVarsToTokens, TokenMatch } from "./tokenCompiler";
import { IRS, IRT, IML } from "../src/types/ir";
import { validateIRS } from "./schemas/irsSchema";
import { validateIRT } from "./schemas/irtSchema";
import { validateIML } from "./schemas/imlSchema";

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
  storybook?: string; // Storybook story code
  variants: Array<{
    name: string;
    properties: Record<string, string>;
    css: string;
  }>;
  extractedProperties: Record<string, any>;
  usedVariables: Array<{ name: string; value: string; type?: string; cssVar?: string }>;
  tokenMatches?: TokenMatch[]; // Figma vars matched to project tokens
  irs?: IRS; // Structure IR
  irt?: IRT; // Token IR
  iml?: IML; // Interaction Model IR
}

// Project token from database
interface ProjectToken {
  _id: any;
  name: string;
  value: string;
  type: string;
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
        
        // Resolve aliases for this variable
        const resolvedValues = resolveVariableValuesForMatching(variable, variables);
        const resolvedValue = Object.values(resolvedValues)[0];
        
        usedVars.push({
          name: variable.name,
          value: formatVariableValue(resolvedValue, variable.resolvedType),
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

/**
 * Resolve variable alias to final value (helper for matching)
 */
function resolveVariableValuesForMatching(
  variable: any,
  allVariables: Record<string, any>,
  visited: Set<string> = new Set(),
  maxDepth: number = 10
): Record<string, any> {
  const resolved: Record<string, any> = {};
  
  for (const [modeId, value] of Object.entries(variable.valuesByMode || {})) {
    // Check if value is an alias
    if (value && typeof value === 'object' && (value as any).type === 'VARIABLE_ALIAS' && (value as any).id) {
      const aliasId = (value as any).id;
      
      // Prevent infinite loops
      if (visited.has(aliasId) || visited.size >= maxDepth) {
        console.warn(`[ALIAS] Circular reference or max depth reached for variable ${aliasId}`);
        resolved[modeId] = value; // Keep unresolved alias
        continue;
      }
      
      visited.add(aliasId);
      
      // Find the referenced variable
      const referencedVar = allVariables[aliasId];
      if (!referencedVar) {
        console.warn(`[ALIAS] Referenced variable ${aliasId} not found`);
        resolved[modeId] = value;
        continue;
      }
      
      // Get the value for the same mode, or first mode if mode doesn't exist
      const modeValue = referencedVar.valuesByMode?.[modeId] || Object.values(referencedVar.valuesByMode || {})[0];
      
      // Recursively resolve if it's also an alias
      if (modeValue && typeof modeValue === 'object' && (modeValue as any).type === 'VARIABLE_ALIAS') {
        resolved[modeId] = resolveVariableValuesForMatching(referencedVar, allVariables, visited, maxDepth)[modeId] || modeValue;
      } else {
        resolved[modeId] = modeValue;
      }
    } else {
      // Direct value
      resolved[modeId] = value;
    }
  }
  
  return resolved;
}

function formatVariableValue(value: any, type: string): string {
  // Handle resolved alias values
  if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
    // This shouldn't happen if aliases are resolved, but handle it gracefully
    return String(value);
  }
  
  if (type === 'COLOR' && typeof value === 'object' && value.r !== undefined) {
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
  claudeApiKey: string,
  irs?: IRS,
  irt?: IRT,
  iml?: IML
): Promise<{ code: string; css: string }> {
  
  // Build enhanced prompt with IRS/IRT data
  let prompt = `You are an expert React/TypeScript developer. Generate a production-ready React component based on this Figma design data.

## Component Name: ${componentName}

## Extracted Properties:
${JSON.stringify(extractedProps, null, 2)}

## Variants (${variants.length} total):
${variants.slice(0, 10).map(v => `- ${v.name}: ${JSON.stringify(v.properties)}`).join('\n')}

## Design Variables Used:
${usedVariables.map(v => `- ${v.name}: ${v.value} (${v.type})`).join('\n')}`;

  // Add IRS data if available
  if (irs) {
    prompt += `\n\n## Structure IR (IRS):
- Component Type: ${irs.meta.componentType}
- Nodes: ${irs.tree.length} total
- Slots: ${irs.slots.map(s => s.name).join(', ')}
- Layout Intent: ${irs.layoutIntent.horizontal}/${irs.layoutIntent.vertical}
- Variants: ${irs.variants.length} total
- State Mapping: ${irs.stateMapping?.map(s => `${s.figmaVariant} → ${s.semanticState}`).join(', ')}`;
  }

  // Add IRT data if available
  if (irt) {
    prompt += `\n\n## Token IR (IRT):
- Tokens: ${irt.tokens.length} total
- Modes: ${Object.keys(irt.modeValues).join(', ')}
- Token Names: ${irt.tokens.slice(0, 10).map(t => t.name).join(', ')}`;
  }

  // Add IML data if available
  if (iml) {
    prompt += `\n\n## Interaction Model IR (IML):
- Component Category: ${iml.componentCategory}
- States: ${iml.states.map(s => s.name).join(', ')}
- ARIA Role: ${iml.aria.role || 'none'}
- Keyboard Mappings: ${iml.keyboard.length} total (${iml.keyboard.slice(0, 5).map(k => k.key).join(', ')})
- Required Primitives: ${iml.requiredPrimitives?.join(', ') || 'none'}
- Interaction Rules: ${iml.interactions.length} total`;
  }

  prompt += `\n\n## Requirements:
1. Create a TypeScript React functional component
2. Use CSS variables for design tokens where appropriate (reference IRT tokens)
3. Support all variant properties as props
4. Include proper TypeScript types
5. Make it production-ready with proper accessibility attributes
6. Use CSS modules or inline styles that match the Figma design exactly
7. ${irs?.slots.length ? `Support slots: ${irs.slots.map(s => s.name).join(', ')}` : ''}
8. ${irs?.stateMapping?.length ? `Support states: ${irs.stateMapping.map(s => s.semanticState).join(', ')}` : ''}
9. ${iml ? `Use ${iml.componentCategory} component pattern with proper ARIA attributes (${iml.aria.role || 'none'})` : ''}
10. ${iml?.requiredPrimitives?.length ? `Use these Radix UI primitives: ${iml.requiredPrimitives.join(', ')}` : ''}
11. ${iml?.keyboard.length ? `Implement keyboard interactions: ${iml.keyboard.map(k => `${k.key} → ${k.action}`).join(', ')}` : ''}

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
      'anthropic-version': '2024-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
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

// ============================================================================
// MCP-BASED EXTRACTION ACTION
// ============================================================================

/**
 * Extract and build component using Figma MCP data
 * This action accepts pre-extracted data from Figma MCP tools
 */
export const extractAndBuildComponentFromMCP = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    figmaUrl: v.string(),
    mcpDesignContext: v.any(), // Design context from Figma MCP
    mcpVariables: v.optional(v.any()), // Variables from Figma MCP
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
      await updateProgress("validate", "completed");

      // Step 2: Process MCP data
      await updateProgress("fetch", "in_progress");
      console.log(`Processing MCP design context for: ${fileKey}`);

      // Extract node data from MCP design context
      // MCP design context structure may vary, so we handle multiple formats
      let nodeData: FigmaNode;
      if (args.mcpDesignContext.document) {
        nodeData = args.mcpDesignContext.document;
      } else if (args.mcpDesignContext.node) {
        nodeData = args.mcpDesignContext.node;
      } else if (args.mcpDesignContext.id) {
        nodeData = args.mcpDesignContext as FigmaNode;
      } else {
        throw new Error('Invalid MCP design context format');
      }

      if (!nodeData) {
        await updateProgress("fetch", "failed", "Invalid MCP data");
        throw new Error('Could not extract node data from MCP design context');
      }

      await updateProgress("fetch", "completed", `Found component: ${nodeData.name}`);

      // Process variables from MCP
      const variables = args.mcpVariables?.meta?.variables || args.mcpVariables?.variables || {};
      const variableCollections = args.mcpVariables?.meta?.variableCollections || args.mcpVariables?.variableCollections || {};

      // Continue with extraction pipeline (same as REST API version)
      return await processExtractedData(
        ctx,
        nodeData,
        variables,
        variableCollections,
        args.figmaUrl,
        fileKey,
        args.projectId,
        args.tenantId,
        args.userId,
        updateProgress
      );
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

// ============================================================================
// SHARED EXTRACTION PROCESSING
// ============================================================================

async function processExtractedData(
  ctx: any,
  nodeData: FigmaNode,
  variables: Record<string, any>,
  variableCollections: Record<string, any>,
  figmaUrl: string,
  fileKey: string,
  projectId: any,
  tenantId: any,
  userId: any,
  updateProgress: (stepId: string, status: "in_progress" | "completed" | "failed", details?: string) => Promise<void>
): Promise<ExtractedComponent> {
  // Step 3: Extract structure
  await updateProgress("extract_structure", "in_progress");
  const irs = extractIRS(nodeData, figmaUrl, fileKey);
  // Validate IRS structure
  try {
    validateIRS(irs);
  } catch (error) {
    await updateProgress("extract_structure", "failed", error instanceof Error ? error.message : "IRS validation failed");
    throw new Error(`IRS validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  await updateProgress("extract_structure", "completed", `${irs.tree.length} nodes, ${irs.variants.length} variants`);

  // Step 4: Extract typography
  await updateProgress("extract_typography", "in_progress");
  const typographyNodes = irs.tree.filter(n => n.type === 'TEXT' || n.typography);
  await updateProgress("extract_typography", "completed", `${typographyNodes.length} text nodes`);

  // Step 5: Extract colors
  await updateProgress("extract_colors", "in_progress");
  const colorNodes = irs.tree.filter(n => n.fills && n.fills.length > 0);
  await updateProgress("extract_colors", "completed", `${colorNodes.length} nodes with fills`);

  // Step 6: Extract layout
  await updateProgress("extract_layout", "in_progress");
  const layoutNodes = irs.tree.filter(n => n.layout);
  await updateProgress("extract_layout", "completed", `${layoutNodes.length} nodes with layout`);

  // Step 7: Extract effects
  await updateProgress("extract_effects", "in_progress");
  const effectNodes = irs.tree.filter(n => n.effects && n.effects.length > 0);
  await updateProgress("extract_effects", "completed", `${effectNodes.length} nodes with effects`);

  // Step 8: Extract variants
  await updateProgress("extract_variants", "in_progress");
  await updateProgress("extract_variants", "completed", `${irs.variants.length} variants`);

  // Step 9: Extract tokens
  await updateProgress("extract_tokens", "in_progress");
  const allNodes = [nodeData, ...(nodeData.children || [])];
  const irt = extractIRT(variables, variableCollections, allNodes);
  // Validate IRT structure
  try {
    validateIRT(irt);
  } catch (error) {
    await updateProgress("extract_tokens", "failed", error instanceof Error ? error.message : "IRT validation failed");
    throw new Error(`IRT validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  await updateProgress("extract_tokens", "completed", `${irt.tokens.length} tokens, ${Object.keys(irt.modeValues).length} modes`);

  // Step 10: Classify
  await updateProgress("classify", "in_progress");
  const componentIntelligence = classifyComponent(irs);
  const iml = extractIML(irs, componentIntelligence);
  // Validate IML structure
  try {
    validateIML(iml);
  } catch (error) {
    await updateProgress("classify", "failed", error instanceof Error ? error.message : "IML validation failed");
    throw new Error(`IML validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  await updateProgress("classify", "completed", `${componentIntelligence.category} (${Math.round(componentIntelligence.confidence * 100)}% confidence)`);

  // Step 11: Get project tokens
  const projectTokens = await ctx.runQuery(api.tokens.list, {
    projectId,
    tenantId,
    userId,
  });

  // Resolve aliases before creating the array
  const resolvedVariables: Record<string, any> = {};
  for (const [id, varData] of Object.entries(variables)) {
    const resolvedValues = resolveVariableValuesForMatching(varData, variables);
    resolvedVariables[id] = {
      ...varData,
      valuesByMode: resolvedValues,
    };
  }
  
  const figmaVarsArray = Object.entries(resolvedVariables).map(([id, varData]: [string, any]) => ({
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

  const componentName = nodeData.name.replace(/[^a-zA-Z0-9]/g, '');
  const extractedProps = extractNodeProperties(nodeData);
  const variants = extractVariants(nodeData);
  const usedVariables = findBoundVariables(nodeData, variables).map(v => ({
    ...v,
    cssVar: tokenMatches.find(tm => tm.figmaVarName === v.name)?.matchedToken?.cssVar,
  }));

  // Step 13: Generate types
  await updateProgress("generate_types", "in_progress");
  await updateProgress("generate_types", "completed");

  // Step 14: Generate component
  await updateProgress("generate_component", "in_progress");
  let generatedCode;
  try {
    generatedCode = generateComponentCode(componentName, irs, irt, iml);
    await updateProgress("generate_component", "completed", `${generatedCode.component.length} chars`);
  } catch (error) {
    await updateProgress("generate_component", "failed", error instanceof Error ? error.message : "Generation failed");
    throw error;
  }

  // Step 15: Generate styles
  await updateProgress("generate_styles", "in_progress");
  await updateProgress("generate_styles", "completed", `${generatedCode.styles.length} chars`);

  const code = generatedCode.component;
  const css = generatedCode.styles;

  // Step 16: Finalize
  await updateProgress("finalize", "in_progress");
  const variantCss = variants.slice(0, 10).map(v => {
    const variantClass = Object.values(v.properties).join('-').toLowerCase().replace(/\s+/g, '-');
    return `.${componentName.toLowerCase()}--${variantClass} { /* variant styles */ }`;
  }).join('\n');

  await updateProgress("finalize", "completed");

  // Generate Storybook story
  const storybook = generatedCode.storybook || '';

  return {
    name: componentName,
    description: `Extracted from Figma: ${nodeData.name}`,
    code,
    css: css + '\n\n' + variantCss,
    storybook,
    variants: variants.slice(0, 20).map(v => ({
      name: Object.values(v.properties).join(' / '),
      properties: v.properties,
      css: '',
    })),
    extractedProperties: extractedProps,
    usedVariables,
    tokenMatches,
    irs,
    irt,
    iml,
  };
}

// ============================================================================
// MAIN EXTRACTION ACTION (REST API)
// ============================================================================

export const extractAndBuildComponent = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    figmaUrl: v.string(),
    progressId: v.optional(v.id("extractionProgress")),
    useMCP: v.optional(v.boolean()), // Option to use MCP if available
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
      const nodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]).replace('-', ':') : null;
      
      if (!nodeId) {
        await updateProgress("validate", "failed", "No node ID found");
        throw new Error('No node ID found in URL. Please select a specific component.');
      }
      
      // Note: MCP tools cannot be called from server-side code
      // If useMCP is true, the client should call extractAndBuildComponentFromMCP instead
      // This action will use REST API as fallback
      
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
        await updateProgress("validate", "failed", "Figma PAT not configured");
        throw new Error('Figma Personal Access Token not configured. Please add it in Settings.');
      }
      
      if (!claudeApiKey) {
        await updateProgress("validate", "failed", "Claude API Key not configured");
        throw new Error('Claude API Key not configured. Please add it in Settings.');
      }
      await updateProgress("validate", "completed");
      
      // Step 2: Fetch from Figma
      await updateProgress("fetch", "in_progress");
      console.log(`Fetching Figma node: ${fileKey}/${nodeId}`);
      
      const [nodeResponse, variablesResponse] = await Promise.all([
        fetchFigmaNode(fileKey, nodeId, figmaPat),
        fetchFigmaVariables(fileKey, figmaPat),
      ]);
      
      const nodeData = nodeResponse.nodes?.[nodeId]?.document;
      if (!nodeData) {
        await updateProgress("fetch", "failed", "Node not found in Figma");
        throw new Error('Could not find the specified node in Figma');
      }
      await updateProgress("fetch", "completed", `Found component: ${nodeData.name}`);
      
      const variables = variablesResponse.meta?.variables || {};
      const variableCollections = variablesResponse.meta?.variableCollections || {};
      
      // Use shared processing function
      return await processExtractedData(
        ctx,
        nodeData,
        variables,
        variableCollections,
        args.figmaUrl,
        fileKey,
        args.projectId,
        args.tenantId,
        args.userId,
        updateProgress
      );
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

// ============================================================================
// TEST CLAUDE CONNECTION
// ============================================================================

export const testClaudeConnection = action({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; error?: string }> => {
    // Verify tenant access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    const claudeApiKey: string | null = await ctx.runQuery(api.settings.get, { 
      tenantId: args.tenantId,
      userId: args.userId, 
      key: 'claudeApiKey' 
    });
    
    if (!claudeApiKey) {
      return {
        success: false,
        message: 'Claude API Key not configured',
        error: 'Please add your Claude API Key in Settings.',
      };
    }
    
    try {
      // Test with a simple prompt
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2024-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Say "Hello" if you can read this.',
            },
          ],
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Claude API error: ${response.status}`,
          error: errorText,
        };
      }
      
      const result = await response.json();
      const content = result.content[0]?.text || '';
      
      return {
        success: true,
        message: 'Claude API is working!',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to Claude API',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

