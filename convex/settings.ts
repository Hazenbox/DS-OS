import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext } from "./tenantMiddleware";

// Get a setting by key for a tenant (migrated from user-scoped)
export const get = query({
  args: { 
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    key: v.string() 
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_tenant_key", (q) => 
        q.eq("tenantId", args.tenantId).eq("key", args.key)
      )
      .first();
    return setting?.value ?? null;
  },
});

// Get all settings for a tenant
export const list = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    return await ctx.db
      .query("settings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

// Set a setting for a tenant (upsert)
export const set = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_tenant_key", (q) => 
        q.eq("tenantId", args.tenantId).eq("key", args.key)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        tenantId: args.tenantId,
        userId: args.userId, // Keep for backward compatibility
        key: args.key,
        value: args.value,
      });
    }
  },
});

// Delete a setting for a tenant
export const remove = mutation({
  args: { 
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    key: v.string() 
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_tenant_key", (q) => 
        q.eq("tenantId", args.tenantId).eq("key", args.key)
      )
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
