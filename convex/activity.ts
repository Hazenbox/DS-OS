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

// ============================================================================
// FIX ORPHANED ACTIVITIES - Migration helper
// ============================================================================

/**
 * Fix orphaned activities (activities without tenantId)
 * Associates them with their project's tenant, or deletes system activities
 */
export const fixOrphanedActivities = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      fixed: 0,
      deleted: 0,
      errors: [] as string[],
    };

    try {
      // Find all activities without tenantId
      const orphanedActivities = await ctx.db
        .query("activity")
        .filter((q) => q.eq(q.field("tenantId"), undefined))
        .collect();

      for (const activity of orphanedActivities) {
        try {
          // Try to find tenant from project
          if (activity.projectId) {
            const project = await ctx.db.get(activity.projectId);
            if (project?.tenantId) {
              await ctx.db.patch(activity._id, { tenantId: project.tenantId });
              results.fixed++;
              continue;
            }
          }

          // If no project or project has no tenant, delete the orphaned activity
          // (these are likely old system activities that can't be associated)
          await ctx.db.delete(activity._id);
          results.deleted++;
        } catch (error: any) {
          results.errors.push(`Error fixing activity ${activity._id}: ${error.message}`);
        }
      }
    } catch (error: any) {
      results.errors.push(error.message || String(error));
    }

    return {
      ...results,
      message: `Fixed ${results.fixed} activities, deleted ${results.deleted} orphaned activities`,
    };
  },
});
