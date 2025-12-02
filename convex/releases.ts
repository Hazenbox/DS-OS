import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all releases
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("releases").order("desc").collect();
  },
});

// Get the latest release
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const releases = await ctx.db
      .query("releases")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .first();
    return releases;
  },
});

// Create a new release
export const create = mutation({
  args: {
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
      user: "Current User",
      action: "release",
      target: `Release ${existing.version}: ${args.status}`,
      targetType: "release",
    });
    
    return args.id;
  },
});

