import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all projects
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});

// Get active project
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const activeProjects = await ctx.db
      .query("projects")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return activeProjects[0] || null;
  },
});

// Create a new project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // If this is the first project, make it active
    const existingProjects = await ctx.db.query("projects").collect();
    const isFirst = existingProjects.length === 0;
    
    // If making this active, deactivate others
    if (isFirst) {
      for (const project of existingProjects) {
        if (project.isActive) {
          await ctx.db.patch(project._id, { isActive: false });
        }
      }
    }
    
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      isActive: isFirst,
      createdAt: now,
      updatedAt: now,
      createdBy: args.userEmail,
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      user: args.userEmail || "System",
      action: "create",
      target: `Project: ${args.name}`,
      targetType: "system",
    });
    
    return projectId;
  },
});

// Set active project
export const setActive = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    // Deactivate all projects
    const allProjects = await ctx.db.query("projects").collect();
    for (const project of allProjects) {
      if (project.isActive) {
        await ctx.db.patch(project._id, { isActive: false });
      }
    }
    
    // Activate selected project
    await ctx.db.patch(args.id, { isActive: true, updatedAt: Date.now() });
    
    return args.id;
  },
});

// Update project
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, { ...filteredUpdates, updatedAt: Date.now() });
    return id;
  },
});

// Delete project
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");
    
    await ctx.db.delete(args.id);
    
    // If we deleted the active project, activate another one
    if (project.isActive) {
      const remaining = await ctx.db.query("projects").first();
      if (remaining) {
        await ctx.db.patch(remaining._id, { isActive: true });
      }
    }
    
    return args.id;
  },
});

