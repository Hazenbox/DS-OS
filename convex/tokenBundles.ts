import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

// ============================================================================
// TOKEN BUNDLE QUERIES (Non-Node.js file for queries)
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

export const _upsertBundle = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    type: v.union(v.literal("global"), v.literal("component")),
    componentId: v.optional(v.id("components")),
    version: v.string(),
    cssContent: v.optional(v.string()),
    jsonContent: v.string(),
    cssUrl: v.optional(v.string()), // CDN URL
    jsonUrl: v.optional(v.string()), // CDN URL
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
        cssContent: args.cssContent, // Keep for fallback
        jsonContent: args.jsonContent, // Keep for fallback
        cssUrl: args.cssUrl,
        jsonUrl: args.jsonUrl,
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
        cssContent: args.cssContent, // Keep for fallback
        jsonContent: args.jsonContent, // Keep for fallback
        cssUrl: args.cssUrl,
        jsonUrl: args.jsonUrl,
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

