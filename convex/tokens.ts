import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all tokens for a project, optionally filtered by type
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return [];
    }
    
    if (args.type) {
      return await ctx.db
        .query("tokens")
        .withIndex("by_project_type", (q) => 
          q.eq("projectId", args.projectId!).eq("type", args.type as any)
        )
        .collect();
    }
    
    return await ctx.db
      .query("tokens")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
      .collect();
  },
});

// Get a single token by ID
export const get = query({
  args: { id: v.id("tokens") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new token
export const create = mutation({
  args: {
    projectId: v.id("projects"),
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
    const tokenId = await ctx.db.insert("tokens", args);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: "Current User",
      action: "create",
      target: `Token: ${args.name}`,
      targetType: "token",
    });
    
    return tokenId;
  },
});

// Update a token
export const update = mutation({
  args: {
    id: v.id("tokens"),
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
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    
    if (!existing) {
      throw new Error("Token not found");
    }
    
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, filteredUpdates);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: "Current User",
      action: "update",
      target: `Token: ${existing.name}`,
      targetType: "token",
    });
    
    return id;
  },
});

// Delete a token
export const remove = mutation({
  args: { id: v.id("tokens") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Token not found");
    }
    
    await ctx.db.delete(args.id);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: "Current User",
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
    clearExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
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
        projectId: args.projectId,
      });
      insertedIds.push(id);
    }
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: "Current User",
      action: "import",
      target: `Imported ${args.tokens.length} tokens`,
      targetType: "token",
    });
    
    return insertedIds;
  },
});
