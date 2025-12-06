import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";

// ============================================================================
// HELPER: Verify project access (tenant-aware)
// ============================================================================
async function verifyProjectAccess(
  ctx: any,
  projectId: Id<"projects">,
  tenantId: Id<"tenants">,
  userId: Id<"users">
): Promise<any> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Verify tenant access
  verifyTenantResource(ctx, tenantId, project);
  
  return project;
}

// ============================================================================
// QUERIES
// ============================================================================

// Get all projects for a tenant
export const list = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Use tenant index for efficient filtering
    return await ctx.db
      .query("projects")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

// Get active project for a tenant
export const getActive = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Use tenant index for efficient lookup
    return await ctx.db
      .query("projects")
      .withIndex("by_tenant_active", (q) => 
        q.eq("tenantId", args.tenantId).eq("isActive", true)
      )
      .first();
  },
});

// Get a single project by ID (with tenant access check)
export const get = query({
  args: {
    id: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const project = await ctx.db.get(args.id);
    if (!project) {
      return null;
    }
    
    // Verify tenant access to project
    verifyTenantResource(ctx, args.tenantId, project);
    
    return project;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

// Create a new project for a tenant
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and check quota
    const context = await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Check quota (require developer role to create)
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    // Check quota
    const quota = await ctx.db
      .query("tenantQuotas")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    
    if (quota?.maxProjects && projects.length >= quota.maxProjects) {
      throw new Error(`Project limit reached. Maximum ${quota.maxProjects} projects allowed.`);
    }
    
    // Input validation
    const name = args.name.trim();
    if (!name || name.length < 2) {
      throw new Error("Project name must be at least 2 characters");
    }
    if (name.length > 50) {
      throw new Error("Project name must be less than 50 characters");
    }
    
    const now = Date.now();
    
    // Deactivate any existing active projects for this tenant
    const activeProject = await ctx.db
      .query("projects")
      .withIndex("by_tenant_active", (q) => 
        q.eq("tenantId", args.tenantId).eq("isActive", true)
      )
      .first();
    
    if (activeProject) {
      await ctx.db.patch(activeProject._id, { isActive: false });
    }
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    const projectId = await ctx.db.insert("projects", {
      tenantId: args.tenantId,
      name,
      description: args.description?.trim(),
      isActive: true, // New project is always active
      createdAt: now,
      updatedAt: now,
      userId: userEmail, // Keep for backward compatibility
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId,
      user: userEmail,
      action: "create",
      target: `Project: ${name}`,
      targetType: "system",
    });
    
    return projectId;
  },
});

// Set active project for a tenant
export const setActive = mutation({
  args: { 
    id: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    const context = await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Verify project access
    await verifyProjectAccess(ctx, args.id, args.tenantId, args.userId);
    
    // Deactivate current active project for this tenant
    const currentActive = await ctx.db
      .query("projects")
      .withIndex("by_tenant_active", (q) => 
        q.eq("tenantId", args.tenantId).eq("isActive", true)
      )
      .first();
    
    if (currentActive && currentActive._id !== args.id) {
      await ctx.db.patch(currentActive._id, { isActive: false });
    }
    
    // Activate selected project
    await ctx.db.patch(args.id, { isActive: true, updatedAt: Date.now() });
    
    return args.id;
  },
});

// Update project (tenant-aware)
export const update = mutation({
  args: {
    id: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, tenantId, userId, ...updates } = args;
    
    // Verify tenant access and require developer role
    await getTenantContext(ctx, userId, tenantId);
    await requireRole(ctx, tenantId, userId, "developer");
    
    // Verify project access
    await verifyProjectAccess(ctx, id, tenantId, userId);
    
    // Validate name if provided
    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name || name.length < 2) {
        throw new Error("Project name must be at least 2 characters");
      }
      if (name.length > 50) {
        throw new Error("Project name must be less than 50 characters");
      }
      updates.name = name;
    }
    
    if (updates.description !== undefined) {
      updates.description = updates.description.trim();
    }
    
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, { ...filteredUpdates, updatedAt: Date.now() });
    return id;
  },
});

// Delete project (tenant-aware, requires admin role)
export const remove = mutation({
  args: { 
    id: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    // Verify project access
    const project = await verifyProjectAccess(ctx, args.id, args.tenantId, args.userId);
    
    // Delete all associated data first (cascade delete)
    // Tokens
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.id)
      )
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    // Components
    const components = await ctx.db
      .query("components")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.id)
      )
      .collect();
    for (const component of components) {
      await ctx.db.delete(component._id);
    }
    
    // Token Files
    const tokenFiles = await ctx.db
      .query("tokenFiles")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.id)
      )
      .collect();
    for (const tokenFile of tokenFiles) {
      await ctx.db.delete(tokenFile._id);
    }
    
    // Releases
    const releases = await ctx.db
      .query("releases")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.id)
      )
      .collect();
    for (const release of releases) {
      await ctx.db.delete(release._id);
    }
    
    // Activity
    const activities = await ctx.db
      .query("activity")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.id)
      )
      .collect();
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }
    
    // Delete the project
    await ctx.db.delete(args.id);
    
    // If we deleted the active project, activate another one for this tenant
    if (project.isActive) {
      const remaining = await ctx.db
        .query("projects")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .first();
      
      if (remaining) {
        await ctx.db.patch(remaining._id, { isActive: true });
      }
    }
    
    return args.id;
  },
});

// Migration: Assign orphan projects to a tenant (admin only)
// This is a migration helper - should not be used in normal operations
export const migrateOrphanProjects = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    const allProjects = await ctx.db.query("projects").collect();
    const orphans = allProjects.filter(p => !p.tenantId);
    
    for (const project of orphans) {
      await ctx.db.patch(project._id, { tenantId: args.tenantId });
    }
    
    return { migrated: orphans.length };
  },
});
