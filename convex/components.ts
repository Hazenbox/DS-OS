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
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Verify tenant access
  verifyTenantResource(ctx, tenantId, project);
}

// ============================================================================
// QUERIES
// ============================================================================

// Get all components for a project
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
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
    
    if (args.status) {
      return await ctx.db
        .query("components")
        .withIndex("by_tenant_project", (q) => 
          q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
        )
        .filter((q) => q.eq(q.field("status"), args.status!))
        .collect();
    }
    
    return await ctx.db
      .query("components")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
      )
      .collect();
  },
});

// Get a single component by ID (with tenant access verification)
export const get = query({
  args: { 
    id: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const component = await ctx.db.get(args.id);
    if (!component) return null;
    
    // Verify component belongs to tenant
    verifyTenantResource(ctx, args.tenantId, component);
    
    return component;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

// Create a new component
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    ),
    version: v.string(),
    code: v.string(),
    docs: v.string(),
    storybook: v.optional(v.string()),
    progressId: v.optional(v.id("extractionProgress")),
  },
  handler: async (ctx, args) => {
    const { tenantId, userId, projectId, name, status, version, code, docs, storybook, progressId } = args;
    
    // Verify tenant access and require developer role
    await getTenantContext(ctx, userId, tenantId);
    await requireRole(ctx, tenantId, userId, "developer");
    
    // Verify project access
    await verifyProjectAccess(ctx, projectId, tenantId, userId);
    
    // Input validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Component name is required");
    }
    if (trimmedName.length > 100) {
      throw new Error("Component name must be less than 100 characters");
    }
    
    // Validate version format (semver-like)
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      throw new Error("Version must be in semver format (e.g., 1.0.0)");
    }
    
    // Get user email for activity log
    const user = await ctx.db.get(userId);
    const userEmail = user?.email || "unknown";
    
    const componentId = await ctx.db.insert("components", {
      tenantId,
      projectId,
      name: trimmedName,
      status,
      version,
      code,
      docs,
      storybook,
      progressId,
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId,
      projectId: args.projectId,
      user: userEmail,
      action: "create",
      target: `Component: ${name}`,
      targetType: "component",
    });
    
    return componentId;
  },
});

// Update a component
export const update = mutation({
  args: {
    id: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    )),
    version: v.optional(v.string()),
    code: v.optional(v.string()),
    docs: v.optional(v.string()),
    storybook: v.optional(v.string()),
    progressId: v.optional(v.id("extractionProgress")),
  },
  handler: async (ctx, args) => {
    const { id, tenantId, userId, ...updates } = args;
    
    // Verify tenant access and require developer role
    await getTenantContext(ctx, userId, tenantId);
    await requireRole(ctx, tenantId, userId, "developer");
    
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Component not found");
    }
    
    // Verify component belongs to tenant
    verifyTenantResource(ctx, tenantId, existing);
    
    // Validate name if provided
    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) {
        throw new Error("Component name is required");
      }
      if (name.length > 100) {
        throw new Error("Component name must be less than 100 characters");
      }
      updates.name = name;
    }
    
    // Validate version if provided
    if (updates.version !== undefined && !/^\d+\.\d+\.\d+/.test(updates.version)) {
      throw new Error("Version must be in semver format (e.g., 1.0.0)");
    }
    
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, filteredUpdates);
    
    // Get user email for activity log
    const user = await ctx.db.get(userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId,
      projectId: existing.projectId,
      user: userEmail,
      action: "update",
      target: `Component: ${existing.name}`,
      targetType: "component",
    });
    
    return id;
  },
});

// Delete a component
export const remove = mutation({
  args: { 
    id: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Component not found");
    }
    
    // Verify component belongs to tenant
    verifyTenantResource(ctx, args.tenantId, existing);
    
    await ctx.db.delete(args.id);
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: existing.projectId,
      user: userEmail,
      action: "delete",
      target: `Component: ${existing.name}`,
      targetType: "component",
    });
    
    return args.id;
  },
});
