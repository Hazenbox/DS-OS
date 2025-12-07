/**
 * SCIM Event Logging
 * 
 * Logs all SCIM operations for audit and debugging purposes.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * Log a SCIM event
 */
export const log = mutation({
  args: {
    tenantId: v.id("tenants"),
    operation: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("get"),
      v.literal("list")
    ),
    resourceType: v.union(v.literal("User"), v.literal("Group")),
    resourceId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("scimEvents", {
      tenantId: args.tenantId,
      operation: args.operation,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      externalId: args.externalId,
      success: args.success,
      errorMessage: args.errorMessage,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get SCIM events for a tenant
 */
export const list = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO: Add tenant access check
    
    const events = await ctx.db
      .query("scimEvents")
      .withIndex("by_tenant_created", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(args.limit || 100);
    
    return events;
  },
});

