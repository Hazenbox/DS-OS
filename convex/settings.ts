import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get a setting by key
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting?.value ?? null;
  },
});

// Get all settings
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("settings").collect();
  },
});

// Set a setting (upsert)
export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
      });
    }
  },
});

// Delete a setting
export const remove = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

