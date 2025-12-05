import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================================
// HELPER: Verify project access
// ============================================================================
async function verifyProjectAccess(
  ctx: any,
  projectId: any,
  userId: string
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  if (project.userId !== userId) {
    throw new Error("Access denied: You don't have access to this project");
  }
}

// ============================================================================
// QUERIES
// ============================================================================

// Get all tokens for a project, optionally filtered by type
// Only returns tokens from active files (or manually added tokens without a source file)
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return [];
    }
    
    // Get all inactive file IDs for this project
    const inactiveFiles = await ctx.db
      .query("tokenFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
      .filter((q) => q.eq(q.field("isActive"), false))
      .collect();
    
    const inactiveFileIds = new Set(inactiveFiles.map(f => f._id.toString()));
    
    let tokens;
    if (args.type) {
      tokens = await ctx.db
        .query("tokens")
        .withIndex("by_project_type", (q) => 
          q.eq("projectId", args.projectId!).eq("type", args.type as any)
        )
        .collect();
    } else {
      tokens = await ctx.db
        .query("tokens")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .collect();
    }
    
    // Filter out tokens from inactive files
    return tokens.filter(token => {
      if (!token.sourceFileId) return true; // Manually added tokens always shown
      return !inactiveFileIds.has(token.sourceFileId.toString());
    });
  },
});

// Get a single token by ID (with project access verification)
export const get = query({
  args: { 
    id: v.id("tokens"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.id);
    if (!token) return null;
    
    // If userId provided, verify access
    if (args.userId) {
      const project = await ctx.db.get(token.projectId);
      if (!project || project.userId !== args.userId) {
        return null;
      }
    }
    
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
    userId: v.string(),
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
    const { userId, ...tokenData } = args;
    
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, userId);
    
    // Input validation
    const name = tokenData.name.trim();
    if (!name) {
      throw new Error("Token name is required");
    }
    if (name.length > 100) {
      throw new Error("Token name must be less than 100 characters");
    }
    
    const tokenId = await ctx.db.insert("tokens", {
      ...tokenData,
      name,
      description: tokenData.description?.trim(),
    });
    
    // Log activity with actual user
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: userId,
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
    projectId: v.id("projects"),
    userId: v.string(),
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
    const { id, projectId, userId, ...updates } = args;
    
    // Verify project access
    await verifyProjectAccess(ctx, projectId, userId);
    
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Token not found");
    }
    
    // Verify token belongs to this project
    if (existing.projectId.toString() !== projectId.toString()) {
      throw new Error("Token does not belong to this project");
    }
    
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
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: userId,
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
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, args.userId);
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Token not found");
    }
    
    // Verify token belongs to this project
    if (existing.projectId.toString() !== args.projectId.toString()) {
      throw new Error("Token does not belong to this project");
    }
    
    await ctx.db.delete(args.id);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: args.userId,
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
    userId: v.string(),
    tokens: v.array(v.object({
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
    })),
    sourceFileId: v.optional(v.id("tokenFiles")),
    clearExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, args.userId);
    
    // Limit bulk import size
    if (args.tokens.length > 1000) {
      throw new Error("Cannot import more than 1000 tokens at once");
    }
    
    // Optionally clear existing tokens for this project
    if (args.clearExisting) {
      const existingTokens = await ctx.db
        .query("tokens")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      for (const token of existingTokens) {
        await ctx.db.delete(token._id);
      }
    }
    
    // Insert new tokens
    const insertedIds = [];
    for (const token of args.tokens) {
      const id = await ctx.db.insert("tokens", {
        ...token,
        name: token.name.trim(),
        projectId: args.projectId,
        sourceFileId: args.sourceFileId,
      });
      insertedIds.push(id);
    }
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: args.userId,
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
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, args.userId);
    
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_source_file", (q) => q.eq("sourceFileId", args.fileId))
      .collect();
    
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    return { deletedCount: tokens.length };
  },
});
