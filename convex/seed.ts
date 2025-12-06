import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";

// Clear all data for a specific project
export const clearProjectData = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
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
    
    // Clear tokens for this project
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    // Clear components for this project
    const components = await ctx.db
      .query("components")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();
    for (const component of components) {
      await ctx.db.delete(component._id);
    }
    
    // Clear activity for this project
    const activity = await ctx.db
      .query("activity")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();
    for (const act of activity) {
      await ctx.db.delete(act._id);
    }
    
    // Clear releases for this project
    const releases = await ctx.db
      .query("releases")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();
    for (const release of releases) {
      await ctx.db.delete(release._id);
    }
    
    return { 
      message: "Project data cleared",
      deleted: {
        tokens: tokens.length,
        components: components.length,
        activity: activity.length,
        releases: releases.length,
      }
    };
  },
});

// Clear all data (legacy - clears everything)
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear tokens
    const tokens = await ctx.db.query("tokens").collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    // Clear components
    const components = await ctx.db.query("components").collect();
    for (const component of components) {
      await ctx.db.delete(component._id);
    }
    
    // Clear activity
    const activity = await ctx.db.query("activity").collect();
    for (const act of activity) {
      await ctx.db.delete(act._id);
    }
    
    // Clear releases
    const releases = await ctx.db.query("releases").collect();
    for (const release of releases) {
      await ctx.db.delete(release._id);
    }
    
    // Clear settings
    const settings = await ctx.db.query("settings").collect();
    for (const setting of settings) {
      await ctx.db.delete(setting._id);
    }
    
    return { 
      message: "All data cleared",
      deleted: {
        tokens: tokens.length,
        components: components.length,
        activity: activity.length,
        releases: releases.length,
        settings: settings.length,
      }
    };
  },
});

// Kept for backwards compatibility - does nothing
export const seedInitialData = mutation({
  args: {},
  handler: async () => {
    return { 
      message: "No mock data to seed. Add your own data through the UI.",
      tokens: 0,
      components: 0
    };
  },
});
