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
// CLAUDE API - Enhanced with Token Matching
// ============================================================================

interface ClaudeGenerationContext {
  componentName: string;
  nodeData: FigmaNode;
  extractedProps: Record<string, any>;
  variants: Array<{ name: string; properties: Record<string, string> }>;
  usedVariables: Array<{ name: string; value: string; type?: string }>;
  tokenMatches: TokenMatch[];
  projectTokens: ProjectToken[];
  irs?: IRS;
  irt?: IRT;
  iml?: IML;
}

async function generateComponentWithClaude(
  context: ClaudeGenerationContext,
  claudeApiKey: string,
): Promise<{ code: string; css: string }> {
  const {
    componentName,
    extractedProps,
    variants,
    usedVariables,
    tokenMatches,
    projectTokens,
    irs,
    irt,
    iml,
  } = context;

  console.log(`[CLAUDE] Building prompt for ${componentName}`);
  console.log(`[CLAUDE] Token matches: ${tokenMatches.filter(t => t.matchedToken).length}/${tokenMatches.length}`);
  
  // Build the CSS variable token table for Claude
  const tokenTable = tokenMatches
    .filter(t => t.matchedToken)
    .map(t => `| ${t.figmaVarName} | ${t.matchedToken!.cssVar} | ${t.matchedToken!.value} |`)
    .join('\n');

  // Build list of available tokens (only the ones this component needs)
  const relevantTokens = tokenMatches
    .filter(t => t.matchedToken)
    .map(t => t.matchedToken!);

  // Build enhanced prompt with token matching
  let prompt = `You are an expert React/TypeScript developer creating pixel-perfect components.

## CRITICAL: Use CSS Variables for ALL Design Tokens

You MUST use the CSS variables provided below. DO NOT use hardcoded color values, spacing, or other design values.

### Token Mapping Table (Figma Variable → CSS Variable → Value)
| Figma Variable | CSS Variable | Resolved Value |
|---------------|--------------|----------------|
${tokenTable || '| (no tokens matched) | - | - |'}

### Available CSS Variables for This Component:
${relevantTokens.map(t => `- ${t.cssVar} /* ${t.value} */`).join('\n') || '(no tokens available)'}

---

## Component: ${componentName}

### Extracted Visual Properties:
\`\`\`json
${JSON.stringify(extractedProps, null, 2)}
\`\`\`

### Figma Variables Used in Design:
${usedVariables.map(v => {
  const match = tokenMatches.find(t => t.figmaVarName === v.name);
  return `- ${v.name}: ${match?.matchedToken?.cssVar || v.value} (${v.type})`;
}).join('\n')}

### Variants (${variants.length} total):
${variants.slice(0, 10).map(v => `- ${v.name}: ${JSON.stringify(v.properties)}`).join('\n') || '(no variants)'}`;

  // Add IRS data if available
  if (irs) {
    prompt += `

### Structure (IRS):
- Type: ${irs.meta.componentType}
- Layout: ${irs.layoutIntent.horizontal}/${irs.layoutIntent.vertical}
- Slots: ${irs.slots.map(s => s.name).join(', ') || 'none'}
- States: ${irs.stateMapping?.map(s => s.semanticState).join(', ') || 'default only'}`;
  }

  // Add IML data if available
  if (iml) {
    prompt += `

### Interaction Model (IML):
- Category: ${iml.componentCategory}
- ARIA Role: ${iml.aria.role || 'none'}
- Keyboard: ${iml.keyboard.slice(0, 5).map(k => k.key).join(', ') || 'none'}`;
  }

  prompt += `

---

## Requirements:

1. **CSS Variables**: Use \`var(--token-name)\` syntax for ALL design values. Reference the token table above.
2. **Pixel Perfect**: Match the Figma design exactly - dimensions, spacing, colors, typography.
3. **TypeScript**: Export a properly typed functional component with all variant props.
4. **Accessibility**: Include proper ARIA attributes${iml?.aria.role ? ` (role="${iml.aria.role}")` : ''}.
5. **No Placeholders**: Generate complete, working CSS with actual values.
6. **Component Structure**: ${irs?.slots.length ? `Support these slots: ${irs.slots.map(s => s.name).join(', ')}` : 'Standard component structure'}

## Output Format:

Return ONLY valid JSON (no markdown, no explanation):
{
  "code": "// Complete TypeScript React component code",
  "css": "/* Complete CSS using var(--token-name) syntax */"
}`;

  console.log(`[CLAUDE] Prompt size: ${prompt.length} chars`);

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
    console.error(`[CLAUDE] API error: ${response.status}`, error);
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text || '';
  
  console.log(`[CLAUDE] Response received: ${content.length} chars`);
  
  // Parse the JSON response
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[CLAUDE] Successfully parsed response`);
      
      // Validate output contains CSS variables
      const cssVarCount = (parsed.css?.match(/var\(--/g) || []).length;
      console.log(`[CLAUDE] Output contains ${cssVarCount} CSS variable references`);
      
      return parsed;
    }
    throw new Error('No JSON found in response');
  } catch (e) {
    console.error(`[CLAUDE] Failed to parse response:`, e);
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
    console.log(`[FIGMA] Starting extraction for URL: ${args.figmaUrl}`);
    
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
      console.error(`[FIGMA] Invalid URL format: ${args.figmaUrl}`);
      throw new Error('Invalid Figma URL');
    }
    const fileKey = urlMatch[2];
    console.log(`[FIGMA] File key: ${fileKey}`);
    
    // Extract node ID from URL
    const nodeIdMatch = args.figmaUrl.match(/node-id=([^&]+)/);
    const nodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]).replace('-', ':') : null;
    
    if (!nodeId) {
      console.error(`[FIGMA] No node ID in URL`);
      throw new Error('No node ID found in URL. Please select a specific component.');
    }
    console.log(`[FIGMA] Node ID: ${nodeId}`);
    
    // Get API keys from settings
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
    
    // =========================================================================
    // STEP 1: Fetch Project Tokens
    // =========================================================================
    console.log(`[TOKENS] Fetching project tokens...`);
    const projectTokens: ProjectToken[] = await ctx.runQuery(api.tokens.list, {
      projectId: args.projectId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    console.log(`[TOKENS] Found ${projectTokens.length} tokens in project`);
    
    if (projectTokens.length === 0) {
      console.warn(`[TOKENS] Warning: No tokens uploaded for this project. Component will use hardcoded values.`);
    }
    
    // =========================================================================
    // STEP 2: Fetch Figma Data
    // =========================================================================
    console.log(`[FIGMA] Fetching node data...`);
    
    const [nodeResponse, variablesResponse] = await Promise.all([
      fetchFigmaNode(fileKey, nodeId, figmaPat),
      fetchFigmaVariables(fileKey, figmaPat),
    ]);
    
    const nodeData = nodeResponse.nodes?.[nodeId]?.document;
    if (!nodeData) {
      console.error(`[FIGMA] Node not found in response`);
      throw new Error('Could not find the specified node in Figma');
    }
    console.log(`[FIGMA] Got node: ${nodeData.name} (${nodeData.type})`);
    
    const variables = variablesResponse.meta?.variables || {};
    const variableCollections = variablesResponse.meta?.variableCollections || {};
    console.log(`[FIGMA] Found ${Object.keys(variables).length} Figma variables`);
    
    // =========================================================================
    // STEP 3: Extract IRs
    // =========================================================================
    console.log(`[IRS] Extracting structure...`);
    const irs = extractIRS(nodeData, args.figmaUrl, fileKey);
    console.log(`[IRS] Extracted: ${irs.tree.length} nodes, ${irs.variants.length} variants, ${irs.slots.length} slots`);
    
    console.log(`[IRT] Extracting tokens...`);
    const allNodes = [nodeData, ...(nodeData.children || [])];
    const irt = extractIRT(variables, variableCollections, allNodes);
    console.log(`[IRT] Extracted: ${irt.tokens.length} tokens, ${Object.keys(irt.modeValues).length} modes`);
    
    console.log(`[IML] Classifying component...`);
    const componentIntelligence = classifyComponent(irs);
    const iml = extractIML(irs, componentIntelligence);
    console.log(`[IML] Category: ${componentIntelligence.category} (${(componentIntelligence.confidence * 100).toFixed(0)}% confidence)`);
    
    // =========================================================================
    // STEP 4: Match Figma Variables to Project Tokens
    // =========================================================================
    const componentName = nodeData.name.replace(/[^a-zA-Z0-9]/g, '');
    const extractedProps = extractNodeProperties(nodeData);
    const variants = extractVariants(nodeData);
    const usedVariables = findBoundVariables(nodeData, variables);
    
    console.log(`[TOKENS] Matching ${usedVariables.length} Figma variables to project tokens...`);
    
    // Convert usedVariables to format expected by matchFigmaVarsToTokens
    const figmaVarsForMatching = usedVariables.map((v, i) => ({
      id: `var_${i}`, // Generate ID if not present
      name: v.name,
      value: v.value,
      type: v.type,
    }));
    
    // Convert project tokens to format expected by matcher
    const tokensForMatching = projectTokens.map(t => ({
      name: t.name,
      value: t.value,
      type: t.type,
    }));
    
    const tokenMatches = matchFigmaVarsToTokens(figmaVarsForMatching, tokensForMatching);
    
    const matchedCount = tokenMatches.filter(t => t.matchedToken).length;
    const unmatchedCount = tokenMatches.filter(t => !t.matchedToken).length;
    console.log(`[TOKENS] Matched: ${matchedCount}, Unmatched: ${unmatchedCount}`);
    
    if (unmatchedCount > 0) {
      const unmatchedNames = tokenMatches
        .filter(t => !t.matchedToken)
        .map(t => t.figmaVarName)
        .slice(0, 5);
      console.log(`[TOKENS] Unmatched variables: ${unmatchedNames.join(', ')}${unmatchedCount > 5 ? '...' : ''}`);
    }
    
    // Enrich usedVariables with CSS variable names
    const enrichedVariables = usedVariables.map(v => {
      const match = tokenMatches.find(t => t.figmaVarName === v.name);
      return {
        ...v,
        cssVar: match?.matchedToken?.cssVar,
      };
    });
    
    // =========================================================================
    // STEP 5: Generate Code with Claude (Primary)
    // =========================================================================
    console.log(`[CLAUDE] Generating component code...`);
    
    const claudeContext: ClaudeGenerationContext = {
      componentName,
      nodeData,
      extractedProps,
      variants,
      usedVariables,
      tokenMatches,
      projectTokens,
      irs,
      irt,
      iml,
    };
    
    const claudeResult = await generateComponentWithClaude(claudeContext, claudeApiKey);
    
    const code = claudeResult.code;
    const css = claudeResult.css;
    
    // Validate output
    const cssVarCount = (css?.match(/var\(--/g) || []).length;
    console.log(`[OUTPUT] Generated code: ${code.length} chars, CSS: ${css.length} chars, CSS vars: ${cssVarCount}`);
    
    // Build variant CSS (if Claude didn't include it)
    const variantCss = variants.slice(0, 10).map(v => {
      const variantClass = Object.values(v.properties).join('-').toLowerCase().replace(/\s+/g, '-');
      return `.${componentName.toLowerCase()}--${variantClass} { /* variant styles */ }`;
    }).join('\n');
    
    console.log(`[OUTPUT] Extraction complete for ${componentName}`);
    
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
      usedVariables: enrichedVariables,
      tokenMatches,
      irs,
      irt,
      iml,
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

