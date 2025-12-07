import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";

// ============================================================================
// HELPER: Verify project access (tenant-aware)
// ============================================================================
async function verifyProjectAccess(
  ctx: any,
  projectId: Id<"projects">,
  tenantId: Id<"tenants">,
  userId: Id<"users">
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Verify tenant access
  verifyTenantResource(ctx, tenantId, project);
}

// ============================================================================
// QUERIES
// ============================================================================

// Get all tokens for a project, optionally filtered by type
// Only returns tokens from active files (or manually added tokens without a source file)
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    if (!args.projectId) {
      return [];
    }
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return [];
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    // Get all inactive file IDs for this project
    const inactiveFiles = await ctx.db
      .query("tokenFiles")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
      )
      .filter((q) => q.eq(q.field("isActive"), false))
      .collect();
    
    const inactiveFileIds = new Set(inactiveFiles.map(f => f._id.toString()));
    
    let tokens;
    if (args.type) {
      tokens = await ctx.db
        .query("tokens")
        .withIndex("by_tenant_project", (q) => 
          q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
        )
        .filter((q) => q.eq(q.field("type"), args.type as any))
        .collect();
    } else {
      tokens = await ctx.db
        .query("tokens")
        .withIndex("by_tenant_project", (q) => 
          q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
        )
        .collect();
    }
    
    // Filter out tokens from inactive files
    return tokens.filter(token => {
      if (!token.sourceFileId) return true; // Manually added tokens always shown
      return !inactiveFileIds.has(token.sourceFileId.toString());
    });
  },
});

// Get a single token by ID (with tenant access verification)
export const get = query({
  args: { 
    id: v.id("tokens"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const token = await ctx.db.get(args.id);
    if (!token) return null;
    
    // Verify token belongs to tenant
    verifyTenantResource(ctx, args.tenantId, token);
    
    return token;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

// Create a new token
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
    value: v.string(),
    type: v.union(
      v.literal("color"),
      v.literal("typography"),
      v.literal("spacing"),
      v.literal("sizing"),
      v.literal("radius"),
      v.literal("shadow"),
      v.literal("blur"),
      v.literal("unknown")
    ),
    description: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, userId, ...tokenData } = args;
    
    // Verify tenant access and require developer role
    await getTenantContext(ctx, userId, tenantId);
    await requireRole(ctx, tenantId, userId, "developer");
    
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, tenantId, userId);
    
    // Input validation
    const name = tokenData.name.trim();
    if (!name) {
      throw new Error("Token name is required");
    }
    if (name.length > 100) {
      throw new Error("Token name must be less than 100 characters");
    }
    
    // Get user email for activity log
    const user = await ctx.db.get(userId);
    const userEmail = user?.email || "unknown";
    
    const tokenId = await ctx.db.insert("tokens", {
      tenantId,
      ...tokenData,
      name,
      description: tokenData.description?.trim(),
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId,
      projectId: args.projectId,
      user: userEmail,
      action: "create",
      target: `Token: ${name}`,
      targetType: "token",
    });
    
    return tokenId;
  },
});

// Update a token
export const update = mutation({
  args: {
    id: v.id("tokens"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    value: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("color"),
      v.literal("typography"),
      v.literal("spacing"),
      v.literal("sizing"),
      v.literal("radius"),
      v.literal("shadow"),
      v.literal("blur"),
      v.literal("unknown")
    )),
    description: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, tenantId, userId, ...updates } = args;
    
    // Verify tenant access and require developer role
    await getTenantContext(ctx, userId, tenantId);
    await requireRole(ctx, tenantId, userId, "developer");
    
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Token not found");
    }
    
    // Verify token belongs to tenant
    verifyTenantResource(ctx, tenantId, existing);
    
    // Validate name if provided
    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) {
        throw new Error("Token name is required");
      }
      if (name.length > 100) {
        throw new Error("Token name must be less than 100 characters");
      }
      updates.name = name;
    }
    
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, filteredUpdates);
    
    // Get user email for activity log
    const user = await ctx.db.get(userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId,
      projectId: existing.projectId,
      user: userEmail,
      action: "update",
      target: `Token: ${existing.name}`,
      targetType: "token",
    });
    
    return id;
  },
});

// Delete a token
export const remove = mutation({
  args: { 
    id: v.id("tokens"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Token not found");
    }
    
    // Verify token belongs to tenant
    verifyTenantResource(ctx, args.tenantId, existing);
    
    await ctx.db.delete(args.id);
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: existing.projectId,
      user: userEmail,
      action: "delete",
      target: `Token: ${existing.name}`,
      targetType: "token",
    });
    
    return args.id;
  },
});

// Bulk import tokens for a project
export const bulkImport = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    tokens: v.array(v.object({
      name: v.string(),
      value: v.string(),
      valueByMode: v.optional(v.any()), // Record<string, string>
      type: v.union(
        v.literal("color"),
        v.literal("typography"),
        v.literal("spacing"),
        v.literal("sizing"),
        v.literal("radius"),
        v.literal("shadow"),
        v.literal("blur"),
        v.literal("unknown")
      ),
      description: v.optional(v.string()),
      brand: v.optional(v.string()),
      modes: v.optional(v.array(v.string())),
    })),
    sourceFileId: v.optional(v.id("tokenFiles")),
    clearExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, args.tenantId, args.userId);
    
    // Limit bulk import size
    if (args.tokens.length > 1000) {
      throw new Error("Cannot import more than 1000 tokens at once");
    }
    
    // Optionally clear existing tokens for this project
    if (args.clearExisting) {
      const existingTokens = await ctx.db
        .query("tokens")
        .withIndex("by_tenant_project", (q) => 
          q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
        )
        .collect();
      for (const token of existingTokens) {
        await ctx.db.delete(token._id);
      }
    }
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Insert new tokens
    const insertedIds = [];
    for (const token of args.tokens) {
      const id = await ctx.db.insert("tokens", {
        tenantId: args.tenantId,
        name: token.name.trim(),
        value: token.value,
        valueByMode: token.valueByMode,
        type: token.type,
        description: token.description,
        brand: token.brand,
        modes: token.modes,
        projectId: args.projectId,
        sourceFileId: args.sourceFileId,
      });
      insertedIds.push(id);
    }
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      user: userEmail,
      action: "import",
      target: `Imported ${args.tokens.length} tokens`,
      targetType: "token",
    });
    
    return insertedIds;
  },
});

// Delete all tokens from a specific file
export const deleteByFile = mutation({
  args: {
    fileId: v.id("tokenFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    // Verify file belongs to tenant
    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }
    verifyTenantResource(ctx, args.tenantId, file);
    
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_source_file", (q) => q.eq("sourceFileId", args.fileId))
      .collect();
    
    // Verify all tokens belong to tenant
    for (const token of tokens) {
      verifyTenantResource(ctx, args.tenantId, token);
      await ctx.db.delete(token._id);
    }
    
    return { deletedCount: tokens.length };
  },
});
