import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================================
// HELPER: Verify project access
// ============================================================================
async function verifyProjectAccess(
  ctx: any,
  projectId: any,
  userId: string
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  if (project.userId !== userId) {
    throw new Error("Access denied: You don't have access to this project");
  }
}

// ============================================================================
// QUERIES
// ============================================================================

// Get all components for a project
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    )),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return [];
    }
    
    if (args.status) {
      return await ctx.db
        .query("components")
        .withIndex("by_project_status", (q) => 
          q.eq("projectId", args.projectId!).eq("status", args.status!)
        )
        .collect();
    }
    
    return await ctx.db
      .query("components")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
      .collect();
  },
});

// Get a single component by ID (with project access verification)
export const get = query({
  args: { 
    id: v.id("components"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.id);
    if (!component) return null;
    
    // If userId provided, verify access
    if (args.userId) {
      const project = await ctx.db.get(component.projectId);
      if (!project || project.userId !== args.userId) {
        return null;
      }
    }
    
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
    userId: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const { userId, ...componentData } = args;
    
    // Verify project access if userId provided
    if (userId) {
      await verifyProjectAccess(ctx, args.projectId, userId);
    }
    
    // Input validation
    const name = componentData.name.trim();
    if (!name) {
      throw new Error("Component name is required");
    }
    if (name.length > 100) {
      throw new Error("Component name must be less than 100 characters");
    }
    
    // Validate version format (semver-like)
    if (!/^\d+\.\d+\.\d+/.test(componentData.version)) {
      throw new Error("Version must be in semver format (e.g., 1.0.0)");
    }
    
    const componentId = await ctx.db.insert("components", {
      ...componentData,
      name,
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: userId || "System",
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
    userId: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const { id, userId, ...updates } = args;
    const existing = await ctx.db.get(id);
    
    if (!existing) {
      throw new Error("Component not found");
    }
    
    // Verify project access if userId provided
    if (userId) {
      await verifyProjectAccess(ctx, existing.projectId, userId);
    }
    
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
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: userId || "System",
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
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Component not found");
    }
    
    // Verify project access if userId provided
    if (args.userId) {
      await verifyProjectAccess(ctx, existing.projectId, args.userId);
    }
    
    await ctx.db.delete(args.id);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: args.userId || "System",
      action: "delete",
      target: `Component: ${existing.name}`,
      targetType: "component",
    });
    
    return args.id;
  },
});
