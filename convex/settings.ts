import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get a setting by key for a specific user
export const get = query({
  args: { 
    userId: v.string(),
    key: v.string() 
  },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => 
        q.eq("userId", args.userId).eq("key", args.key)
      )
      .first();
    return setting?.value ?? null;
  },
});

// Get all settings for a user
export const list = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Set a setting for a user (upsert)
export const set = mutation({
  args: {
    userId: v.string(),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => 
        q.eq("userId", args.userId).eq("key", args.key)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        userId: args.userId,
        key: args.key,
        value: args.value,
      });
    }
  },
});

// Delete a setting for a user
export const remove = mutation({
  args: { 
    userId: v.string(),
    key: v.string() 
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => 
        q.eq("userId", args.userId).eq("key", args.key)
      )
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
