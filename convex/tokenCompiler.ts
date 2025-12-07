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

export const _getProjectTokens = internalQuery({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    console.log(`[TOKENS] Fetching tokens for project ${args.projectId}`);
    
    // Get all active token files for this project
    const activeFiles = await ctx.db
      .query("tokenFiles")
      .withIndex("by_tenant_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const activeFileIds = new Set(activeFiles.map((f) => f._id.toString()));
    console.log(`[TOKENS] Found ${activeFiles.length} active token files`);

    // Get all tokens for this project
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_tenant_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();

    // Filter to only include tokens from active files or manually added
    const activeTokens = tokens.filter((token) => {
      if (!token.sourceFileId) return true;
      return activeFileIds.has(token.sourceFileId.toString());
    });

    console.log(`[TOKENS] Returning ${activeTokens.length} active tokens (filtered from ${tokens.length} total)`);
    return activeTokens;
  },
});

export const _getExistingBundle = internalQuery({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    type: v.union(v.literal("global"), v.literal("component")),
    componentId: v.optional(v.id("components")),
  },
  handler: async (ctx, args) => {
    if (args.type === "global") {
      const bundles = await ctx.db
        .query("tokenBundles")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", args.projectId).eq("type", "global")
        )
        .collect();
      return bundles[0] || null;
    } else if (args.componentId) {
      const bundles = await ctx.db
        .query("tokenBundles")
        .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
        .collect();
      return bundles[0] || null;
    }
    return null;
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

export const _upsertBundle = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    type: v.union(v.literal("global"), v.literal("component")),
    componentId: v.optional(v.id("components")),
    version: v.string(),
    cssContent: v.optional(v.string()),
    jsonContent: v.string(),
    tokenCount: v.number(),
    modes: v.optional(v.array(v.string())),
    existingBundleId: v.optional(v.id("tokenBundles")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.existingBundleId) {
      // Update existing bundle
      await ctx.db.patch(args.existingBundleId, {
        version: args.version,
        cssContent: args.cssContent,
        jsonContent: args.jsonContent,
        tokenCount: args.tokenCount,
        modes: args.modes,
        updatedAt: now,
      });
      console.log(`[TOKENS] Updated bundle ${args.existingBundleId}`);
      return args.existingBundleId;
    } else {
      // Create new bundle
      const bundleId = await ctx.db.insert("tokenBundles", {
        tenantId: args.tenantId,
        projectId: args.projectId,
        type: args.type,
        componentId: args.componentId,
        version: args.version,
        cssContent: args.cssContent,
        jsonContent: args.jsonContent,
        tokenCount: args.tokenCount,
        modes: args.modes,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[TOKENS] Created new bundle ${bundleId}`);
      return bundleId;
    }
  },
});

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
    const tokens = await ctx.runQuery(internal.tokenCompiler._getProjectTokens, {
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
    const existingBundle = await ctx.runQuery(internal.tokenCompiler._getExistingBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
      type: "global",
    });

    // Generate version (semver-like based on timestamp)
    const version = `1.0.${Date.now()}`;

    // Upsert the bundle
    const bundleId = await ctx.runMutation(internal.tokenCompiler._upsertBundle, {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: "global",
      version,
      cssContent,
      jsonContent,
      tokenCount: tokens.length,
      modes: ["default"], // TODO: Support light/dark modes
      existingBundleId: existingBundle?._id,
    });

    console.log(`[TOKENS] Global theme compilation complete. Bundle ID: ${bundleId}`);

    return {
      bundleId,
      tokenCount: tokens.length,
      cssSize: cssContent.length,
      jsonSize: jsonContent.length,
    };
  },
});

// ============================================================================
// GET GLOBAL BUNDLE QUERY
// ============================================================================

export const getGlobalBundle = internalQuery({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const bundles = await ctx.db
      .query("tokenBundles")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", "global")
      )
      .collect();

    return bundles[0] || null;
  },
});

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
    const tokens = await ctx.runQuery(internal.tokenCompiler._getProjectTokens, {
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
    const existingBundle = await ctx.runQuery(internal.tokenCompiler._getExistingBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
      type: "component",
      componentId: args.componentId,
    });

    const version = `1.0.${Date.now()}`;

    // Upsert the bundle
    const bundleId = await ctx.runMutation(internal.tokenCompiler._upsertBundle, {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: "component",
      componentId: args.componentId,
      version,
      jsonContent,
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

export const getComponentBundle = internalQuery({
  args: {
    componentId: v.id("components"),
  },
  handler: async (ctx, args) => {
    const bundles = await ctx.db
      .query("tokenBundles")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();

    return bundles[0] || null;
  },
});

// ============================================================================
// PUBLIC QUERY FOR CLIENT
// ============================================================================

export const getProjectBundle = action({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify access
    await ctx.runQuery(api.tenants.get, {
      tenantId: args.tenantId,
      userId: args.userId,
    });

    const bundle = await ctx.runQuery(internal.tokenCompiler.getGlobalBundle, {
      projectId: args.projectId,
      tenantId: args.tenantId,
    });

    if (!bundle) {
      return null;
    }

    return {
      version: bundle.version,
      cssContent: bundle.cssContent,
      jsonContent: bundle.jsonContent,
      tokenCount: bundle.tokenCount,
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

