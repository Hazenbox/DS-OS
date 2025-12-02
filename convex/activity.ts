import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all activity logs, ordered by creation time (newest first)
export const list = query({
  args: {
    limit: v.optional(v.number()),
    targetType: v.optional(v.union(
      v.literal("token"),
      v.literal("component"),
      v.literal("release"),
      v.literal("system")
    )),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("activity").order("desc");
    
    const activities = await query.collect();
    
    // Filter by targetType if specified
    let filtered = args.targetType 
      ? activities.filter(a => a.targetType === args.targetType)
      : activities;
    
    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }
    
    return filtered;
  },
});

// Create a new activity log entry
export const create = mutation({
  args: {
    user: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("import"),
      v.literal("download"),
      v.literal("release")
    ),
    target: v.string(),
    targetType: v.union(
      v.literal("token"),
      v.literal("component"),
      v.literal("release"),
      v.literal("system")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activity", args);
  },
});

// Clear old activity logs (keep last N entries)
export const cleanup = mutation({
  args: { keepCount: v.number() },
  handler: async (ctx, args) => {
    const activities = await ctx.db.query("activity").order("desc").collect();
    
    if (activities.length > args.keepCount) {
      const toDelete = activities.slice(args.keepCount);
      for (const activity of toDelete) {
        await ctx.db.delete(activity._id);
      }
      return toDelete.length;
    }
    
    return 0;
  },
});

