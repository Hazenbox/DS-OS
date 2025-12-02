import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all components
export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    )),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("components")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("components").collect();
  },
});

// Get a single component by ID
export const get = query({
  args: { id: v.id("components") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new component
export const create = mutation({
  args: {
    name: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    ),
    version: v.string(),
    code: v.string(),
    docs: v.string(),
  },
  handler: async (ctx, args) => {
    const componentId = await ctx.db.insert("components", args);
    
    // Log activity
    await ctx.db.insert("activity", {
      user: "Current User",
      action: "create",
      target: `Component: ${args.name}`,
      targetType: "component",
    });
    
    return componentId;
  },
});

// Update a component
export const update = mutation({
  args: {
    id: v.id("components"),
    name: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    )),
    version: v.optional(v.string()),
    code: v.optional(v.string()),
    docs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    
    if (!existing) {
      throw new Error("Component not found");
    }
    
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, filteredUpdates);
    
    // Log activity
    await ctx.db.insert("activity", {
      user: "Current User",
      action: "update",
      target: `Component: ${existing.name}`,
      targetType: "component",
    });
    
    return id;
  },
});

// Delete a component
export const remove = mutation({
  args: { id: v.id("components") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Component not found");
    }
    
    await ctx.db.delete(args.id);
    
    // Log activity
    await ctx.db.insert("activity", {
      user: "Current User",
      action: "delete",
      target: `Component: ${existing.name}`,
      targetType: "component",
    });
    
    return args.id;
  },
});

