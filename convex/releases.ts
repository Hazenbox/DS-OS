import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all releases for a project
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return [];
    }
    
    return await ctx.db
      .query("releases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
      .order("desc")
      .collect();
  },
});

// Get the latest release for a project
export const latest = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return null;
    }
    
    const releases = await ctx.db
      .query("releases")
      .withIndex("by_project_status", (q) => 
        q.eq("projectId", args.projectId!).eq("status", "published")
      )
      .order("desc")
      .first();
    return releases;
  },
});

// Create a new release
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    version: v.string(),
    changelog: v.string(),
    components: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const releaseId = await ctx.db.insert("releases", {
      ...args,
      status: "draft",
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: "Current User",
      action: "create",
      target: `Release: ${args.version}`,
      targetType: "release",
    });
    
    return releaseId;
  },
});

// Update release status
export const updateStatus = mutation({
  args: {
    id: v.id("releases"),
    status: v.union(
      v.literal("draft"),
      v.literal("in_progress"),
      v.literal("published"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Release not found");
    }
    
    const updates: any = { status: args.status };
    
    if (args.status === "published") {
      updates.publishedAt = Date.now();
    }
    
    await ctx.db.patch(args.id, updates);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: "Current User",
      action: "release",
      target: `Release ${existing.version}: ${args.status}`,
      targetType: "release",
    });
    
    return args.id;
  },
});
