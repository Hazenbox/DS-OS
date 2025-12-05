import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all token files for a project
export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tokenFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Create a new token file
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    originalName: v.string(),
    content: v.string(),
    tokenCount: v.number(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const fileId = await ctx.db.insert("tokenFiles", {
      projectId: args.projectId,
      name: args.name,
      originalName: args.originalName,
      content: args.content,
      tokenCount: args.tokenCount,
      isActive: true, // New files are active by default
      uploadedAt: Date.now(),
      uploadedBy: args.uploadedBy,
    });
    return fileId;
  },
});

// Rename a token file
export const rename = mutation({
  args: {
    id: v.id("tokenFiles"),
    projectId: v.id("projects"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file || file.projectId !== args.projectId) {
      throw new Error("File not found or access denied");
    }
    
    await ctx.db.patch(args.id, { name: args.name });
    return { success: true };
  },
});

// Toggle active status
export const toggleActive = mutation({
  args: {
    id: v.id("tokenFiles"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file || file.projectId !== args.projectId) {
      throw new Error("File not found or access denied");
    }
    
    await ctx.db.patch(args.id, { isActive: !file.isActive });
    return { success: true, isActive: !file.isActive };
  },
});

// Delete a token file
export const remove = mutation({
  args: {
    id: v.id("tokenFiles"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file || file.projectId !== args.projectId) {
      throw new Error("File not found or access denied");
    }
    
    // Also delete tokens linked to this file
    const linkedTokens = await ctx.db
      .query("tokens")
      .withIndex("by_source_file", (q) => q.eq("sourceFileId", args.id))
      .collect();
    
    for (const token of linkedTokens) {
      await ctx.db.delete(token._id);
    }
    
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Get file content (for preview/download)
export const getContent = query({
  args: {
    id: v.id("tokenFiles"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file || file.projectId !== args.projectId) {
      return null;
    }
    return {
      name: file.name,
      content: file.content,
    };
  },
});

