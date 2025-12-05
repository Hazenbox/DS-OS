import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================================
// HELPER: Verify project ownership
// ============================================================================
async function verifyProjectOwnership(
  ctx: any, 
  projectId: any, 
  userId: string
): Promise<any> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  if (project.userId !== userId) {
    throw new Error("Access denied: You don't own this project");
  }
  return project;
}

// ============================================================================
// QUERIES
// ============================================================================

// Get all projects for a user (using index!)
export const list = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return [];
    }
    // Use the index for efficient filtering
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get active project for a user (using index!)
export const getActive = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null;
    }
    // Use the composite index for efficient lookup
    return await ctx.db
      .query("projects")
      .withIndex("by_user_active", (q) => 
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .first();
  },
});

// Get a single project by ID (with ownership check)
export const get = query({
  args: {
    id: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== args.userId) {
      return null;
    }
    return project;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

// Create a new project for a user
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Input validation
    const name = args.name.trim();
    if (!name || name.length < 2) {
      throw new Error("Project name must be at least 2 characters");
    }
    if (name.length > 50) {
      throw new Error("Project name must be less than 50 characters");
    }
    
    const now = Date.now();
    
    // Deactivate any existing active projects for this user
    const activeProject = await ctx.db
      .query("projects")
      .withIndex("by_user_active", (q) => 
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .first();
    
    if (activeProject) {
      await ctx.db.patch(activeProject._id, { isActive: false });
    }
    
    const projectId = await ctx.db.insert("projects", {
      name,
      description: args.description?.trim(),
      isActive: true, // New project is always active
      createdAt: now,
      updatedAt: now,
      userId: args.userId,
    });
    
    // Log activity with actual user
    await ctx.db.insert("activity", {
      projectId,
      user: args.userId,
      action: "create",
      target: `Project: ${name}`,
      targetType: "system",
    });
    
    return projectId;
  },
});

// Set active project for a user
export const setActive = mutation({
  args: { 
    id: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    await verifyProjectOwnership(ctx, args.id, args.userId);
    
    // Deactivate current active project
    const currentActive = await ctx.db
      .query("projects")
      .withIndex("by_user_active", (q) => 
        q.eq("userId", args.userId).eq("isActive", true)
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

// Update project (only if user owns it)
export const update = mutation({
  args: {
    id: v.id("projects"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...updates } = args;
    
    // Verify ownership
    await verifyProjectOwnership(ctx, id, userId);
    
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

// Delete project (only if user owns it)
export const remove = mutation({
  args: { 
    id: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const project = await verifyProjectOwnership(ctx, args.id, args.userId);
    
    // Delete all associated data first (cascade delete)
    // Tokens
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    // Components
    const components = await ctx.db
      .query("components")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const component of components) {
      await ctx.db.delete(component._id);
    }
    
    // Releases
    const releases = await ctx.db
      .query("releases")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const release of releases) {
      await ctx.db.delete(release._id);
    }
    
    // Activity
    const activities = await ctx.db
      .query("activity")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }
    
    // Delete the project
    await ctx.db.delete(args.id);
    
    // If we deleted the active project, activate another one
    if (project.isActive) {
      const remaining = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      
      if (remaining) {
        await ctx.db.patch(remaining._id, { isActive: true });
      }
    }
    
    return args.id;
  },
});

// Migration: Assign orphan projects to a user (admin only)
export const migrateOrphanProjects = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // In production, add admin check here
    const allProjects = await ctx.db.query("projects").collect();
    const orphans = allProjects.filter(p => !p.userId);
    
    for (const project of orphans) {
      await ctx.db.patch(project._id, { userId: args.userId });
    }
    
    return { migrated: orphans.length };
  },
});
