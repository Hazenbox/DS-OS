/**
 * SCIM Helper Functions
 * 
 * Internal queries and mutations used by SCIM endpoints.
 */

import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Get tenant users (for SCIM)
 */
export const getTenantUsers = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const tenantUsers = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    
    return tenantUsers;
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get tenant user by user ID
 */
export const getTenantUserByUserId = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant_user", (q) => 
        q.eq("tenantId", args.tenantId).eq("userId", args.userId)
      )
      .first();
  },
});

/**
 * Get tenant user by ID (tenant user ID)
 */
export const getTenantUserById = query({
  args: {
    tenantUserId: v.id("tenantUsers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantUserId);
  },
});

/**
 * Update tenant user
 */
export const updateTenantUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    tenantUserId: v.id("tenantUsers"),
    displayName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.displayName !== undefined) {
      updates.displayName = args.displayName;
    }
    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }
    if (args.externalId !== undefined) {
      updates.externalId = args.externalId;
    }
    
    await ctx.db.patch(args.tenantUserId, updates);
  },
});

