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
 * Match Figma variables to project tokens by name similarity
 * Returns a map that can be used by Claude for code generation
 */
export function matchFigmaVarsToTokens(
  figmaVars: Array<{ id: string; name: string; value: string; type?: string }>,
  tokens: Array<{ name: string; value: string; type: string }>
): TokenMatch[] {
  const results: TokenMatch[] = [];

  for (const figmaVar of figmaVars) {
    const normalizedFigma = normalizeTokenName(figmaVar.name);

    // Try exact match first
    let bestMatch: { token: (typeof tokens)[0]; confidence: number } | null = null;

    for (const token of tokens) {
      const normalizedToken = normalizeTokenName(token.name);

      // Exact match
      if (normalizedFigma === normalizedToken) {
        bestMatch = { token, confidence: 1.0 };
        break;
      }

      // Partial match - token name contains figma var or vice versa
      if (normalizedToken.includes(normalizedFigma) || normalizedFigma.includes(normalizedToken)) {
        const similarity = Math.min(normalizedFigma.length, normalizedToken.length) /
          Math.max(normalizedFigma.length, normalizedToken.length);
        if (!bestMatch || similarity > bestMatch.confidence) {
          bestMatch = { token, confidence: similarity };
        }
      }

      // Suffix match (e.g., "500" matches "color-primary-500")
      const figmaParts = normalizedFigma.split("-");
      const tokenParts = normalizedToken.split("-");
      const commonParts = figmaParts.filter((p) => tokenParts.includes(p));
      if (commonParts.length > 0) {
        const partSimilarity = commonParts.length / Math.max(figmaParts.length, tokenParts.length);
        if (!bestMatch || partSimilarity > bestMatch.confidence) {
          bestMatch = { token, confidence: partSimilarity };
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

