import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";

// Get all activity logs for a project, ordered by creation time (newest first)
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
    targetType: v.optional(v.union(
      v.literal("token"),
      v.literal("component"),
      v.literal("release"),
      v.literal("system")
    )),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    if (!args.projectId) {
      return [];
    }
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return [];
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    const activities = await ctx.db
      .query("activity")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
      )
      .order("desc")
      .collect();
    
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

// Create a new activity log entry (internal use - tenantId should be provided)
export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.optional(v.id("projects")),
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

// Clear old activity logs for a project (keep last N entries)
export const cleanup = mutation({
  args: { 
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    keepCount: v.number() 
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    const activities = await ctx.db
      .query("activity")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .order("desc")
      .collect();
    
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
