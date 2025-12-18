"use node";

import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// TOKEN COMPILER - Generates CSS/JSON bundles from tokens
// ============================================================================

/**
 * Normalize token name to CSS-safe variable name
 * Examples:
 *   "color/primary/500" → "color-primary-500"
 *   "spacing.large" → "spacing-large"
 *   "Color Primary 500" → "color-primary-500"
 */
export function normalizeTokenName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\/\.]/g, '-')      // Replace / and . with -
    .replace(/\s+/g, '-')          // Replace spaces with -
    .replace(/[^a-z0-9-]/g, '')    // Remove non-alphanumeric
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '');        // Trim leading/trailing dashes
}

/**
 * Generate CSS variable declaration
 */
function tokenToCSSVar(name: string, value: string): string {
  const cssName = normalizeTokenName(name);
  return `  --${cssName}: ${value};`;
}

/**
 * Group tokens by type for organized CSS output
 */
function groupTokensByType(tokens: Array<{ name: string; value: string; type: string }>) {
  const groups: Record<string, Array<{ name: string; value: string }>> = {
    color: [],
    typography: [],
    spacing: [],
    sizing: [],
    radius: [],
    shadow: [],
    blur: [],
    unknown: [],
  };

  for (const token of tokens) {
    const group = groups[token.type] || groups.unknown;
    group.push({ name: token.name, value: token.value });
  }

  return groups;
}

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

// _getProjectTokens moved to tokenBundles.ts (non-Node.js file)

// _getExistingBundle moved to tokenBundles.ts (non-Node.js file)

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

// _upsertBundle moved to tokenBundles.ts (non-Node.js file)

// ============================================================================
// COMPILE GLOBAL THEME ACTION
// ============================================================================

export const compileGlobalTheme = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    bundleId: Id<"tokenBundles">;
    tokenCount: number;
    cssSize: number;
    jsonSize: number;
  }> => {
    console.log(`[TOKENS] Starting global theme compilation for project ${args.projectId}`);

    // Verify access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });

    // Get all active tokens
    const tokens = await ctx.runQuery(internal.tokenBundles._getProjectTokens, {
      projectId: args.projectId,
      tenantId: args.tenantId,
    });

    if (tokens.length === 0) {
      console.log(`[TOKENS] No tokens found for project`);
      throw new Error("No tokens found for this project. Please upload token files first.");
    }

    console.log(`[TOKENS] Compiling ${tokens.length} tokens into CSS bundle`);

    // Group tokens by type for organized CSS
    const grouped = groupTokensByType(tokens);

    // Generate CSS content
    let cssLines: string[] = [
      "/* DS-OS Generated Token Bundle */",
      `/* Generated: ${new Date().toISOString()} */`,
      `/* Token Count: ${tokens.length} */`,
      "",
      ":root {",
    ];

    // Add tokens by category with comments
    const categories = ["color", "typography", "spacing", "sizing", "radius", "shadow", "blur", "unknown"];
    for (const category of categories) {
      const categoryTokens = grouped[category];
      if (categoryTokens.length > 0) {
        cssLines.push(`  /* ${category.charAt(0).toUpperCase() + category.slice(1)} Tokens */`);
        for (const token of categoryTokens) {
          cssLines.push(tokenToCSSVar(token.name, token.value));
        }
        cssLines.push("");
      }
    }

    cssLines.push("}");
    const cssContent = cssLines.join("\n");

    // Generate JSON map: { originalName: cssVarName }
    const jsonMap: Record<string, string> = {};
    for (const token of tokens) {
      const cssVarName = `var(--${normalizeTokenName(token.name)})`;
      jsonMap[token.name] = cssVarName;
    }
    const jsonContent = JSON.stringify(jsonMap, null, 2);

    console.log(`[TOKENS] Generated CSS: ${cssContent.length} bytes, JSON: ${jsonContent.length} bytes`);

    // Check for existing bundle
    const existingBundle = await ctx.runQuery(internal.tokenBundles._getExistingBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
      type: "global",
    });

    // Collect all available modes from tokens
    const allModes = new Set<string>();
    for (const token of tokens) {
      if (token.modes && Array.isArray(token.modes)) {
        token.modes.forEach((mode: string) => allModes.add(mode));
      }
    }
    const availableModes = Array.from(allModes).length > 0 ? Array.from(allModes) : ["default"];
    
    // Generate version (semantic versioning: major.minor.patch)
    // Major: breaking changes (schema changes) - always 1 for now
    // Minor: increments when new tokens are added
    // Patch: timestamp-based for cache busting
    const existingTokenCount = existingBundle?.tokenCount || 0;
    const versionMajor = 1;
    let versionMinor = 0;
    if (existingBundle) {
      const parts = existingBundle.version.split('.');
      versionMinor = parseInt(parts[1] || '0');
      if (tokens.length > existingTokenCount) {
        versionMinor += 1; // New tokens added
      }
    } else if (tokens.length > 0) {
      versionMinor = 0; // First version
    }
    const versionPatch = Math.floor(Date.now() / 1000) % 100000; // Unix timestamp mod for patch
    const version = `${versionMajor}.${versionMinor}.${versionPatch}`;

    // Generate mode-specific CSS if multiple modes exist
    let finalCssContent = cssContent;
    if (availableModes.length > 1) {
      // Generate CSS for each mode
      const modeCss: string[] = [];
      modeCss.push("/* DS-OS Generated Token Bundle - Multi-Mode */");
      modeCss.push(`/* Generated: ${new Date().toISOString()} */`);
      modeCss.push(`/* Token Count: ${tokens.length} */`);
      modeCss.push(`/* Modes: ${availableModes.join(', ')} */`);
      modeCss.push("");
      
      for (const mode of availableModes) {
        modeCss.push(`[data-theme="${mode}"] {`);
        const modeTokens = tokens.filter((t: any) => 
          !t.valueByMode || t.valueByMode[mode] !== undefined
        );
        for (const token of modeTokens) {
          const tokenValue = token.valueByMode?.[mode] || token.value;
          modeCss.push(tokenToCSSVar(token.name, tokenValue));
        }
        modeCss.push("}");
        modeCss.push("");
      }
      
      // Also include default :root for backward compatibility
      modeCss.push(":root {");
      for (const token of tokens) {
        modeCss.push(tokenToCSSVar(token.name, token.value));
      }
      modeCss.push("}");
      
      finalCssContent = modeCss.join("\n");
    }

    // Upload to CDN (Vercel Blob Storage)
    let cssUrl: string | undefined;
    let jsonUrl: string | undefined;
    
    try {
      const storageResult = await ctx.runAction(api.storage.uploadBundle, {
        tenantId: args.tenantId,
        projectId: args.projectId,
        version,
        type: "global",
        cssContent: finalCssContent,
        jsonContent,
        modes: availableModes,
      });
      cssUrl = storageResult.cssUrl;
      jsonUrl = storageResult.jsonUrl;
      console.log(`[TOKENS] Uploaded bundles to CDN: CSS=${cssUrl}, JSON=${jsonUrl}`);
    } catch (error) {
      console.error(`[TOKENS] Failed to upload to CDN, using DB fallback:`, error);
      // Continue with DB storage as fallback
    }

    // Upsert the bundle (with CDN URLs if available)
    const bundleId = await ctx.runMutation(internal.tokenBundles._upsertBundle, {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: "global",
      version,
      cssContent: finalCssContent, // Keep for fallback
      jsonContent, // Keep for fallback
      cssUrl,
      jsonUrl,
      tokenCount: tokens.length,
      modes: availableModes,
      existingBundleId: existingBundle?._id,
    });

    console.log(`[TOKENS] Global theme compilation complete. Bundle ID: ${bundleId}`);

    return {
      bundleId,
      tokenCount: tokens.length,
      cssSize: finalCssContent.length,
      jsonSize: jsonContent.length,
    };
  },
});

// ============================================================================
// COMPILE SEMANTIC TOKENS ACTION
// ============================================================================

export const compileSemanticTokens = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    bundleId: Id<"tokenBundles">;
    tokenCount: number;
    cssSize: number;
    jsonSize: number;
  }> => {
    console.log(`[TOKENS] Starting semantic token compilation for project ${args.projectId}`);

    // Verify access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });

    // Get all tokens, filter for semantic layer
    const allTokens = await ctx.runQuery(internal.tokenBundles._getProjectTokens, {
      projectId: args.projectId,
      tenantId: args.tenantId,
    });

    // Filter for semantic tokens only
    const tokens = allTokens.filter((t: any) => t.layer === "semantic");
    
    if (tokens.length === 0) {
      throw new Error("No semantic tokens found for this project");
    }

    console.log(`[TOKENS] Found ${tokens.length} semantic tokens`);

    // Check for existing bundle
    const existingBundle = await ctx.runQuery(internal.tokenBundles._getExistingBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
      type: "semantic",
    });

    // Generate version (increment if exists)
    const version = existingBundle
      ? `${existingBundle.version.split(".")[0]}.${parseInt(existingBundle.version.split(".")[1] || "0") + 1}`
      : "1.0";

    // Group tokens by type
    const grouped = groupTokensByType(tokens);

    // Generate JSON map
    const jsonMap: Record<string, any> = {};
    for (const token of tokens) {
      const cssName = normalizeTokenName(token.name);
      jsonMap[cssName] = {
        name: token.name,
        value: token.value,
        type: token.type,
        cssVar: `var(--${cssName})`,
      };
    }
    const jsonContent = JSON.stringify(jsonMap, null, 2);

    // Generate CSS with mode support
    let finalCssContent: string;
    const availableModes: string[] = [];

    // Check if any tokens have multi-mode support
    for (const token of tokens) {
      if (token.valueByMode && typeof token.valueByMode === "object") {
        const modes = Object.keys(token.valueByMode);
        availableModes.push(...modes);
      }
    }

    const uniqueModes = Array.from(new Set(availableModes));

    if (uniqueModes.length === 0) {
      // Single mode - simple CSS
      const cssLines: string[] = [];
      cssLines.push(":root {");
      for (const token of tokens) {
        cssLines.push(tokenToCSSVar(token.name, token.value));
      }
      cssLines.push("}");
      finalCssContent = cssLines.join("\n");
    } else {
      // Multi-mode CSS
      const modeCss: string[] = [];
      
      // Generate mode-specific CSS
      for (const mode of uniqueModes) {
        modeCss.push(`[data-theme="${mode}"] {`);
        const modeTokens = tokens.filter((t: any) => t.valueByMode?.[mode]);
        for (const token of modeTokens) {
          const tokenValue = (token as any).valueByMode?.[mode] || token.value;
          modeCss.push(tokenToCSSVar(token.name, tokenValue));
        }
        modeCss.push("}");
        modeCss.push("");
      }
      
      // Also include default :root for backward compatibility
      modeCss.push(":root {");
      for (const token of tokens) {
        modeCss.push(tokenToCSSVar(token.name, token.value));
      }
      modeCss.push("}");
      
      finalCssContent = modeCss.join("\n");
    }

    // Upload to CDN (Vercel Blob Storage)
    let cssUrl: string | undefined;
    let jsonUrl: string | undefined;
    
    try {
      const storageResult = await ctx.runAction(api.storage.uploadBundle, {
        tenantId: args.tenantId,
        projectId: args.projectId,
        version,
        type: "semantic",
        cssContent: finalCssContent,
        jsonContent,
        modes: uniqueModes,
      });
      cssUrl = storageResult.cssUrl;
      jsonUrl = storageResult.jsonUrl;
      console.log(`[TOKENS] Uploaded semantic bundles to CDN: CSS=${cssUrl}, JSON=${jsonUrl}`);
    } catch (error) {
      console.error(`[TOKENS] Failed to upload to CDN, using DB fallback:`, error);
      // Continue with DB storage as fallback
    }

    // Upsert the bundle (with CDN URLs if available)
    const bundleId = await ctx.runMutation(internal.tokenBundles._upsertBundle, {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: "semantic",
      version,
      cssContent: finalCssContent, // Keep for fallback
      jsonContent, // Keep for fallback
      cssUrl,
      jsonUrl,
      tokenCount: tokens.length,
      modes: uniqueModes,
      existingBundleId: existingBundle?._id,
    });

    console.log(`[TOKENS] Semantic token compilation complete. Bundle ID: ${bundleId}`);

    return {
      bundleId,
      tokenCount: tokens.length,
      cssSize: finalCssContent.length,
      jsonSize: jsonContent.length,
    };
  },
});

// ============================================================================
// GET GLOBAL BUNDLE QUERY
// ============================================================================

// getGlobalBundle moved to tokenBundles.ts (non-Node.js file)

// ============================================================================
// COMPILE COMPONENT TOKENS ACTION
// ============================================================================

/**
 * Extract token references from component code
 * Looks for patterns like:
 *   var(--token-name)
 *   --token-name
 *   token references in comments
 */
function extractTokenRefsFromCode(code: string, css: string): string[] {
  const refs = new Set<string>();

  // Match var(--token-name) patterns
  const varMatches = (code + css).matchAll(/var\(--([a-z0-9-]+)\)/gi);
  for (const match of varMatches) {
    refs.add(match[1]);
  }

  // Match --token-name patterns (CSS custom properties)
  const cssVarMatches = (code + css).matchAll(/--([a-z0-9-]+)/gi);
  for (const match of cssVarMatches) {
    refs.add(match[1]);
  }

  return Array.from(refs);
}

/**
 * Match extracted token refs to actual project tokens
 * Uses fuzzy matching to handle naming variations
 */
function matchTokenRefs(
  refs: string[],
  tokens: Array<{ name: string; value: string; type: string }>
): Array<{ name: string; value: string; type: string; cssVar: string }> {
  const matched: Array<{ name: string; value: string; type: string; cssVar: string }> = [];

  for (const ref of refs) {
    // Direct match by normalized name
    const directMatch = tokens.find(
      (t) => normalizeTokenName(t.name) === ref
    );
    if (directMatch) {
      matched.push({
        name: directMatch.name,
        value: directMatch.value,
        type: directMatch.type,
        cssVar: `var(--${ref})`,
      });
      continue;
    }

    // Fuzzy match: check if token name contains the ref
    const fuzzyMatch = tokens.find((t) => {
      const normalized = normalizeTokenName(t.name);
      return normalized.includes(ref) || ref.includes(normalized);
    });
    if (fuzzyMatch) {
      matched.push({
        name: fuzzyMatch.name,
        value: fuzzyMatch.value,
        type: fuzzyMatch.type,
        cssVar: `var(--${normalizeTokenName(fuzzyMatch.name)})`,
      });
    }
  }

  return matched;
}

export const compileComponentTokens = action({
  args: {
    componentId: v.id("components"),
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    bundleId: Id<"tokenBundles">;
    tokenCount: number;
    matchedTokens: Array<{ name: string; cssVar: string }>;
    unmatchedRefs: string[];
  }> => {
    console.log(`[TOKENS] Starting component token compilation for ${args.componentId}`);

    // Verify access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });

    // Get component
    const component = await ctx.runQuery(api.components.get, {
      id: args.componentId,
      tenantId: args.tenantId,
      userId: args.userId,
    });

    if (!component) {
      throw new Error("Component not found");
    }

    // Get all project tokens
    const tokens = await ctx.runQuery(internal.tokenBundles._getProjectTokens, {
      projectId: args.projectId,
      tenantId: args.tenantId,
    });

    console.log(`[TOKENS] Analyzing component code for token references`);

    // Extract token refs from component code and docs (which contains CSS)
    const codeRefs = extractTokenRefsFromCode(component.code, component.docs || "");
    console.log(`[TOKENS] Found ${codeRefs.length} potential token references: ${codeRefs.slice(0, 10).join(", ")}...`);

    // Match refs to actual tokens
    const matchedTokens = matchTokenRefs(codeRefs, tokens);
    console.log(`[TOKENS] Matched ${matchedTokens.length} tokens`);

    // Find unmatched refs
    const matchedNames = new Set(matchedTokens.map((t) => normalizeTokenName(t.name)));
    const unmatchedRefs = codeRefs.filter((ref) => !matchedNames.has(ref));
    if (unmatchedRefs.length > 0) {
      console.log(`[TOKENS] Unmatched refs: ${unmatchedRefs.join(", ")}`);
    }

    // Generate JSON map for this component (only the tokens it needs)
    const jsonMap: Record<string, { value: string; cssVar: string; type: string }> = {};
    for (const token of matchedTokens) {
      jsonMap[token.name] = {
        value: token.value,
        cssVar: token.cssVar,
        type: token.type,
      };
    }
    const jsonContent = JSON.stringify(jsonMap, null, 2);

    // Check for existing bundle
    const existingBundle = await ctx.runQuery(internal.tokenBundles._getExistingBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
      type: "component",
      componentId: args.componentId,
    });

    const version = `1.0.${Date.now()}`;

    // Upload to CDN (Vercel Blob Storage)
    let jsonUrl: string | undefined;
    
    try {
      const storageResult = await ctx.runAction(api.storage.uploadBundle, {
        tenantId: args.tenantId,
        projectId: args.projectId,
        version,
        type: "component",
        componentId: args.componentId,
        jsonContent,
      });
      jsonUrl = storageResult.jsonUrl;
      console.log(`[TOKENS] Uploaded component bundle to CDN: JSON=${jsonUrl}`);
    } catch (error) {
      console.error(`[TOKENS] Failed to upload component bundle to CDN, using DB fallback:`, error);
      // Continue with DB storage as fallback
    }

    // Upsert the bundle (with CDN URL if available)
    const bundleId = await ctx.runMutation(internal.tokenBundles._upsertBundle, {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: "component",
      componentId: args.componentId,
      version,
      jsonContent, // Keep for fallback
      jsonUrl,
      tokenCount: matchedTokens.length,
      existingBundleId: existingBundle?._id,
    });

    console.log(`[TOKENS] Component token compilation complete. Bundle ID: ${bundleId}`);

    return {
      bundleId,
      tokenCount: matchedTokens.length,
      matchedTokens: matchedTokens.map((t) => ({ name: t.name, cssVar: t.cssVar })),
      unmatchedRefs,
    };
  },
});

// ============================================================================
// GET COMPONENT BUNDLE QUERY
// ============================================================================

// getComponentBundle moved to tokenBundles.ts (non-Node.js file)

// ============================================================================
// PUBLIC QUERY FOR CLIENT
// ============================================================================

export const getProjectBundle = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    version: string;
    cssContent?: string;
    jsonContent?: string;
    cssUrl?: string;
    jsonUrl?: string;
    tokenCount: number;
    modes: string[];
    updatedAt: number;
  } | null> => {
    // Verify access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });

    const bundle = await ctx.runQuery(internal.tokenBundles.getGlobalBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
    });

    if (!bundle) {
      return null;
    }

    return {
      version: bundle.version,
      cssContent: bundle.cssContent, // Fallback if CDN unavailable
      jsonContent: bundle.jsonContent, // Fallback if CDN unavailable
      cssUrl: bundle.cssUrl, // CDN URL (preferred)
      jsonUrl: bundle.jsonUrl, // CDN URL (preferred)
      tokenCount: bundle.tokenCount,
      modes: bundle.modes || ['default'],
      updatedAt: bundle.updatedAt,
    };
  },
});

export const getSemanticBundle = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    version: string;
    cssContent?: string;
    jsonContent?: string;
    cssUrl?: string;
    jsonUrl?: string;
    tokenCount: number;
    modes: string[];
    updatedAt: number;
  } | null> => {
    // Verify access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });

    const bundle = await ctx.runQuery(internal.tokenBundles.getSemanticBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
    });

    if (!bundle) {
      return null;
    }

    return {
      version: bundle.version,
      cssContent: bundle.cssContent, // Fallback if CDN unavailable
      jsonContent: bundle.jsonContent, // Fallback if CDN unavailable
      cssUrl: bundle.cssUrl, // CDN URL (preferred)
      jsonUrl: bundle.jsonUrl, // CDN URL (preferred)
      tokenCount: bundle.tokenCount,
      modes: bundle.modes || ['default'],
      updatedAt: bundle.updatedAt,
    };
  },
});

// ============================================================================
// TOKEN NAME MATCHER - For Figma variable to token matching
// ============================================================================

export interface TokenMatch {
  figmaVarName: string;
  figmaVarId: string;
  matchedToken: {
    name: string;
    value: string;
    type: string;
    cssVar: string;
  } | null;
  confidence: number; // 0-1
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy string matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score from Levenshtein distance (0-1)
 */
function similarityFromLevenshtein(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  return 1 - (distance / maxLen);
}

/**
 * Parse color value to normalized format for comparison
 */
function parseColorValue(value: string): { r: number; g: number; b: number; a: number } | null {
  // Parse rgba(r, g, b, a)
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10),
        g: parseInt(rgbaMatch[2], 10),
        b: parseInt(rgbaMatch[3], 10),
        a: parseFloat(rgbaMatch[4] || '1'),
      };
  }

  // Parse hex #RRGGBB or #RGB
  const hexMatch = value.match(/#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    } else {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1,
      };
    }
  }

  return null;
}

/**
 * Calculate color similarity (0-1)
 * Uses CIE76 color distance formula
 */
function colorSimilarity(color1: string, color2: string): number {
  const c1 = parseColorValue(color1);
  const c2 = parseColorValue(color2);
  
  if (!c1 || !c2) return 0;
  
  // Calculate Euclidean distance in RGB space
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);
  
  // Normalize to 0-1 (max distance in RGB space is ~441)
  const maxDistance = 441; // sqrt(255^2 * 3)
  const similarity = 1 - (distance / maxDistance);
  
  // Only consider it a match if similarity is high (>0.95 = very close colors)
  return Math.max(0, similarity);
}

/**
 * Parse numeric value (spacing, sizing, etc.)
 */
function parseNumericValue(value: string | number): number | null {
  if (typeof value === 'number') return value;
  
  // Extract number from string (e.g., "16px" -> 16)
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Calculate numeric similarity (0-1)
 * For spacing, sizing, radius values
 */
function numericSimilarity(value1: string | number, value2: string | number): number {
  const num1 = parseNumericValue(value1);
  const num2 = parseNumericValue(value2);
  
  if (num1 === null || num2 === null) return 0;
  if (num1 === num2) return 1.0;
  
  // Calculate relative difference
  const max = Math.max(Math.abs(num1), Math.abs(num2));
  if (max === 0) return 1.0;
  
  const diff = Math.abs(num1 - num2);
  const similarity = 1 - (diff / max);
  
  // Only consider exact or very close matches (>0.99)
  return similarity > 0.99 ? similarity : 0;
}

/**
 * Enhanced fuzzy name matching with multiple strategies
 */
function fuzzyNameMatch(str1: string, str2: string): number {
  const normalized1 = normalizeTokenName(str1);
  const normalized2 = normalizeTokenName(str2);
  
  // Exact match
  if (normalized1 === normalized2) return 1.0;
  
  // Levenshtein distance similarity
  const levenshteinSim = similarityFromLevenshtein(normalized1, normalized2);
  
  // Substring match (one contains the other)
  let substringSim = 0;
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    substringSim = Math.min(normalized1.length, normalized2.length) /
                   Math.max(normalized1.length, normalized2.length);
  }
  
  // Word/part matching
  const parts1 = normalized1.split('-');
  const parts2 = normalized2.split('-');
  const commonParts = parts1.filter(p => parts2.includes(p));
  const partSim = commonParts.length > 0 
    ? commonParts.length / Math.max(parts1.length, parts2.length)
    : 0;
  
  // Weighted combination
  // Levenshtein is most accurate, substring is good for partial matches, parts for structured names
  const combined = (
    levenshteinSim * 0.5 +      // 50% weight on edit distance
    substringSim * 0.3 +        // 30% weight on substring
    partSim * 0.2               // 20% weight on parts
  );
  
  return Math.min(1.0, combined);
}

/**
 * Match Figma variables to project tokens by name similarity AND value
 * Returns a map that can be used by Claude for code generation
 */
export function matchFigmaVarsToTokens(
  figmaVars: Array<{ id: string; name: string; value: string; type?: string }>,
  tokens: Array<{ name: string; value: string; type: string }>
): TokenMatch[] {
  const results: TokenMatch[] = [];

  for (const figmaVar of figmaVars) {
    const normalizedFigma = normalizeTokenName(figmaVar.name);
    const figmaType = figmaVar.type?.toLowerCase() || 'unknown';

    // Try exact match first
    let bestMatch: { token: (typeof tokens)[0]; confidence: number; method: string } | null = null;

    for (const token of tokens) {
      const normalizedToken = normalizeTokenName(token.name);
      const tokenType = token.type?.toLowerCase() || 'unknown';

      // Type must match (or be compatible)
      const typeCompatible = 
        figmaType === tokenType ||
        (figmaType === 'color' && tokenType === 'color') ||
        (figmaType === 'float' && ['spacing', 'sizing', 'radius'].includes(tokenType)) ||
        figmaType === 'unknown' || tokenType === 'unknown';

      if (!typeCompatible) continue;

      // Strategy 1: Exact name match
      if (normalizedFigma === normalizedToken) {
        bestMatch = { token, confidence: 1.0, method: 'exact' };
        break;
      }

      // Strategy 2: Enhanced fuzzy name matching
      const nameSimilarity = fuzzyNameMatch(figmaVar.name, token.name);
      if (nameSimilarity > 0.7) { // Threshold for name matching
        if (!bestMatch || nameSimilarity > bestMatch.confidence) {
          bestMatch = { token, confidence: nameSimilarity, method: 'fuzzy-name' };
        }
      }

      // Strategy 3: Value-based matching (only if name match is weak)
      if (!bestMatch || bestMatch.confidence < 0.8) {
        let valueSimilarity = 0;
        
        if (figmaType === 'color' || tokenType === 'color') {
          valueSimilarity = colorSimilarity(figmaVar.value, token.value);
          // Color matching is very reliable, boost confidence
          if (valueSimilarity > 0.95) {
            const combinedConfidence = Math.max(
              (nameSimilarity * 0.3) + (valueSimilarity * 0.7), // 70% weight on value
              valueSimilarity * 0.9 // At least 90% of value similarity
            );
            if (!bestMatch || combinedConfidence > bestMatch.confidence) {
              bestMatch = { token, confidence: combinedConfidence, method: 'value-color' };
            }
          }
        } else if (['spacing', 'sizing', 'radius'].includes(tokenType) || figmaType === 'float') {
          valueSimilarity = numericSimilarity(figmaVar.value, token.value);
          // Numeric matching requires exact match
          if (valueSimilarity > 0.99) {
            const combinedConfidence = Math.max(
              (nameSimilarity * 0.4) + (valueSimilarity * 0.6), // 60% weight on value
              valueSimilarity * 0.95 // At least 95% of value similarity
            );
            if (!bestMatch || combinedConfidence > bestMatch.confidence) {
              bestMatch = { token, confidence: combinedConfidence, method: 'value-numeric' };
            }
          }
        }
      }
    }

    results.push({
      figmaVarName: figmaVar.name,
      figmaVarId: figmaVar.id,
      matchedToken: bestMatch
        ? {
            name: bestMatch.token.name,
            value: bestMatch.token.value,
            type: bestMatch.token.type,
            cssVar: `var(--${normalizeTokenName(bestMatch.token.name)})`,
          }
        : null,
      confidence: bestMatch?.confidence || 0,
    });
  }

  return results;
}

