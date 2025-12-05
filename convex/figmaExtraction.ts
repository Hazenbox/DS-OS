import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Store pending extraction requests and results
export const createExtractionRequest = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    figmaUrl: v.optional(v.string()),
    nodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("figmaExtractions", {
      projectId: args.projectId,
      userId: args.userId,
      figmaUrl: args.figmaUrl,
      nodeId: args.nodeId,
      status: "pending",
      createdAt: Date.now(),
    });
    return requestId;
  },
});

export const updateExtractionResult = mutation({
  args: {
    requestId: v.id("figmaExtractions"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("pending")),
    result: v.optional(v.object({
      componentName: v.string(),
      description: v.optional(v.string()),
      code: v.string(),
      css: v.string(),
      variants: v.array(v.object({
        name: v.string(),
        properties: v.any(),
        css: v.string(),
      })),
      extractedProperties: v.any(),
      usedVariables: v.array(v.object({
        name: v.string(),
        value: v.string(),
        type: v.optional(v.string()),
      })),
    })),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      status: args.status,
      result: args.result,
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const getExtractionRequest = query({
  args: {
    requestId: v.id("figmaExtractions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

export const getPendingExtractions = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("figmaExtractions")
      .withIndex("by_project_status", (q) => 
        q.eq("projectId", args.projectId).eq("status", "pending")
      )
      .collect();
  },
});

export const getLatestExtraction = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const extractions = await ctx.db
      .query("figmaExtractions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(1);
    return extractions[0] || null;
  },
});

