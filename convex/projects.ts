import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all projects for a user
export const list = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return [];
    }
    // Get projects that belong to this user
    const allProjects = await ctx.db.query("projects").collect();
    return allProjects.filter(p => p.userId === args.userId);
  },
});

// Get active project for a user
export const getActive = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null;
    }
    // Get all projects and filter by user and active status
    const allProjects = await ctx.db.query("projects").collect();
    const activeProject = allProjects.find(p => p.userId === args.userId && p.isActive);
    return activeProject || null;
  },
});

// Create a new project for a user
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if this is the first project for this user
    const allProjects = await ctx.db.query("projects").collect();
    const userProjects = allProjects.filter(p => p.userId === args.userId);
    const isFirst = userProjects.length === 0;
    
    // If this is the first, it becomes active automatically
    // Otherwise, deactivate existing active projects for this user
    if (!isFirst) {
      for (const project of userProjects) {
        if (project.isActive) {
          await ctx.db.patch(project._id, { isActive: false });
        }
      }
    }
    
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      isActive: true, // New project is always active
      createdAt: now,
      updatedAt: now,
      userId: args.userId,
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId,
      user: args.userId,
      action: "create",
      target: `Project: ${args.name}`,
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
    // Verify this project belongs to the user
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== args.userId) {
      throw new Error("Project not found or access denied");
    }
    
    // Deactivate all projects for this user
    const allProjects = await ctx.db.query("projects").collect();
    const userProjects = allProjects.filter(p => p.userId === args.userId);
    for (const p of userProjects) {
      if (p.isActive) {
        await ctx.db.patch(p._id, { isActive: false });
      }
    }
    
    // Activate selected project
    await ctx.db.patch(args.id, { isActive: true, updatedAt: Date.now() });
    
    return args.id;
  },
});

// Migration: Assign orphan projects to a user
export const migrateOrphanProjects = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const allProjects = await ctx.db.query("projects").collect();
    const orphans = allProjects.filter(p => !p.userId);
    
    for (const project of orphans) {
      await ctx.db.patch(project._id, { userId: args.userId });
    }
    
    return { migrated: orphans.length };
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
    const project = await ctx.db.get(id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or access denied");
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
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== args.userId) {
      throw new Error("Project not found or access denied");
    }
    
    await ctx.db.delete(args.id);
    
    // If we deleted the active project, activate another one for this user
    if (project.isActive) {
      const allProjects = await ctx.db.query("projects").collect();
      const remaining = allProjects.find(p => p.userId === args.userId && p._id !== args.id);
      if (remaining) {
        await ctx.db.patch(remaining._id, { isActive: true });
      }
    }
    
    return args.id;
  },
});
