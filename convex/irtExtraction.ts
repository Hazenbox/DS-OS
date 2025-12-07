"use node";

import { IRT, SemanticToken, TokenDependencyGraph, TokenDependency } from "../src/types/ir";

// ============================================================================
// IRT EXTRACTION HELPERS
// ============================================================================

interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, any>;
  variableCollectionId?: string;
}

interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
}

interface FigmaNode {
  id: string;
  name: string;
  boundVariables?: Record<string, any>;
  children?: FigmaNode[];
}

/**
 * Extract IRT (Token IR) from Figma variables and bound variables in nodes
 */
export function extractIRT(
  variables: Record<string, FigmaVariable>,
  variableCollections: Record<string, FigmaVariableCollection>,
  nodes: FigmaNode[]
): IRT {
  const tokens: SemanticToken[] = [];
  const modeValues: Record<string, Record<string, string | number>> = {};
  const tokenUsage: Record<string, string[]> = {};
  
  // Extract tokens from variables
  for (const [varId, variable] of Object.entries(variables)) {
    const token = extractTokenFromVariable(variable, varId);
    if (token) {
      tokens.push(token);
      
      // Extract mode values
      for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
        if (!modeValues[modeId]) {
          modeValues[modeId] = {};
        }
        modeValues[modeId][token.name] = formatTokenValue(value, variable.resolvedType);
      }
    }
  }
  
  // Find token usage in nodes
  for (const node of nodes) {
    findTokenUsage(node, variables, tokenUsage);
  }
  
  // Build dependency graph
  const tokenGraph = buildTokenDependencyGraph(tokens);
  
  return {
    tokens,
    modeValues,
    tokenGraph,
    tokenUsage,
  };
}

/**
 * Extract a semantic token from a Figma variable
 */
function extractTokenFromVariable(
  variable: FigmaVariable,
  varId: string
): SemanticToken | null {
  const semanticName = inferSemanticName(variable.name, variable.resolvedType);
  const tokenType = inferTokenType(variable.resolvedType, variable.name);
  
  // Get primary value (first mode)
  const primaryValue = Object.values(variable.valuesByMode)[0];
  const formattedValue = formatTokenValue(primaryValue, variable.resolvedType);
  
  // Extract all mode values
  const modes: Record<string, string | number> = {};
  for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
    modes[modeId] = formatTokenValue(value, variable.resolvedType);
  }
  
  return {
    name: semanticName,
    semanticName,
    value: formattedValue,
    type: tokenType,
    modes,
    sourceVariableId: varId,
    description: `Extracted from Figma variable: ${variable.name}`,
  };
}

/**
 * Infer semantic token name from Figma variable name
 * Examples:
 * - "Primary/500" → "color.primary.500"
 * - "Spacing/16" → "spacing.16"
 * - "Typography/Body/Regular" → "typography.body.regular"
 */
function inferSemanticName(figmaName: string, resolvedType: string): string {
  // Normalize the name
  let name = figmaName
    .replace(/\//g, '.')
    .replace(/\s+/g, '.')
    .toLowerCase();
  
  // Remove common prefixes
  name = name.replace(/^(color|spacing|typography|sizing|radius|shadow|blur)\./, '');
  
  // Add type prefix if not present
  const typePrefix = inferTokenType(resolvedType, figmaName);
  if (!name.startsWith(typePrefix)) {
    name = `${typePrefix}.${name}`;
  }
  
  return name;
}

/**
 * Infer token type from Figma variable type and name
 */
function inferTokenType(resolvedType: string, name: string): SemanticToken['type'] {
  const normalizedName = name.toLowerCase();
  
  if (resolvedType === 'COLOR') return 'color';
  if (resolvedType === 'FLOAT') {
    if (normalizedName.includes('spacing') || normalizedName.includes('gap') || normalizedName.includes('padding') || normalizedName.includes('margin')) {
      return 'spacing';
    }
    if (normalizedName.includes('size') || normalizedName.includes('width') || normalizedName.includes('height')) {
      return 'sizing';
    }
    if (normalizedName.includes('radius') || normalizedName.includes('border')) {
      return 'radius';
    }
    return 'sizing';
  }
  if (normalizedName.includes('shadow') || normalizedName.includes('elevation')) return 'shadow';
  if (normalizedName.includes('blur')) return 'shadow';
  if (normalizedName.includes('font') || normalizedName.includes('typography') || normalizedName.includes('text')) return 'typography';
  
  return 'other';
}

/**
 * Format token value based on type
 */
function formatTokenValue(value: any, resolvedType: string): string | number {
  if (resolvedType === 'COLOR' && typeof value === 'object') {
    const { r, g, b, a } = value;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a ?? 1})`;
  }
  if (resolvedType === 'FLOAT') {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

/**
 * Find token usage in nodes
 */
function findTokenUsage(
  node: FigmaNode,
  variables: Record<string, FigmaVariable>,
  tokenUsage: Record<string, string[]>
): void {
  if (node.boundVariables) {
    for (const [prop, binding] of Object.entries(node.boundVariables)) {
      const varId = (binding as any)?.id;
      if (varId && variables[varId]) {
        const variable = variables[varId];
        const tokenName = inferSemanticName(variable.name, variable.resolvedType);
        
        if (!tokenUsage[tokenName]) {
          tokenUsage[tokenName] = [];
        }
        if (!tokenUsage[tokenName].includes(node.id)) {
          tokenUsage[tokenName].push(node.id);
        }
      }
    }
  }
  
  // Recursively check children
  if (node.children) {
    for (const child of node.children) {
      findTokenUsage(child, variables, tokenUsage);
    }
  }
}

/**
 * Build token dependency graph
 * Detects aliases and references between tokens
 */
function buildTokenDependencyGraph(tokens: SemanticToken[]): TokenDependencyGraph {
  const edges: TokenDependency[] = [];
  
  // Detect aliases (tokens with similar values)
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const token1 = tokens[i];
      const token2 = tokens[j];
      
      // Check if values are similar (for colors, use color distance)
      if (areTokensSimilar(token1, token2)) {
        edges.push({
          from: token1.name,
          to: token2.name,
          relationship: 'alias',
        });
      }
    }
  }
  
  return {
    nodes: tokens,
    edges,
  };
}

/**
 * Check if two tokens are similar (potential aliases)
 */
function areTokensSimilar(token1: SemanticToken, token2: SemanticToken): boolean {
  // Only compare tokens of the same type
  if (token1.type !== token2.type) return false;
  
  // For colors, compare RGB values
  if (token1.type === 'color') {
    const color1 = parseColor(String(token1.value));
    const color2 = parseColor(String(token2.value));
    if (color1 && color2) {
      const distance = colorDistance(color1, color2);
      return distance < 2.0; // Threshold for color similarity
    }
  }
  
  // For numeric values, check if they're close
  if (typeof token1.value === 'number' && typeof token2.value === 'number') {
    return Math.abs(token1.value - token2.value) < 0.1;
  }
  
  return false;
}

/**
 * Parse color string to RGB
 */
function parseColor(colorStr: string): { r: number; g: number; b: number } | null {
  // Parse rgba(r, g, b, a)
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
    };
  }
  
  // Parse hex
  const hexMatch = colorStr.match(/#([0-9a-f]{6})/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1].substring(0, 2), 16),
      g: parseInt(hexMatch[1].substring(2, 4), 16),
      b: parseInt(hexMatch[1].substring(4, 6), 16),
    };
  }
  
  return null;
}

/**
 * Calculate color distance (CIE76)
 */
function colorDistance(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
  // Simple Euclidean distance in RGB space
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

