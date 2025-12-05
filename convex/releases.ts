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

// Get all releases for a project
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return [];
    }
    
    return await ctx.db
      .query("releases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
      .order("desc")
      .collect();
  },
});

// Get the latest published release for a project
export const latest = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (!args.projectId) {
      return null;
    }
    
    return await ctx.db
      .query("releases")
      .withIndex("by_project_status", (q) => 
        q.eq("projectId", args.projectId!).eq("status", "published")
      )
      .order("desc")
      .first();
  },
});

// Get a single release by ID (with access check)
export const get = query({
  args: { 
    id: v.id("releases"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const release = await ctx.db.get(args.id);
    if (!release) return null;
    
    // If userId provided, verify access
    if (args.userId) {
      const project = await ctx.db.get(release.projectId);
      if (!project || project.userId !== args.userId) {
        return null;
      }
    }
    
    return release;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

// Create a new release
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    version: v.string(),
    changelog: v.string(),
    components: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...releaseData } = args;
    
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, userId);
    
    // Input validation
    const version = releaseData.version.trim();
    if (!version) {
      throw new Error("Version is required");
    }
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      throw new Error("Version must be in semver format (e.g., 1.0.0)");
    }
    
    // Check for duplicate version
    const existing = await ctx.db
      .query("releases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("version"), version))
      .first();
    
    if (existing) {
      throw new Error(`Release ${version} already exists`);
    }
    
    const releaseId = await ctx.db.insert("releases", {
      ...releaseData,
      version,
      status: "draft",
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: args.projectId,
      user: userId,
      action: "create",
      target: `Release: ${version}`,
      targetType: "release",
    });
    
    return releaseId;
  },
});

// Update release status
export const updateStatus = mutation({
  args: {
    id: v.id("releases"),
    userId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("in_progress"),
      v.literal("published"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Release not found");
    }
    
    // Verify project access
    await verifyProjectAccess(ctx, existing.projectId, args.userId);
    
    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ["in_progress"],
      in_progress: ["published", "failed"],
      published: [], // Cannot change once published
      failed: ["draft"], // Can retry from failed
    };
    
    if (!validTransitions[existing.status]?.includes(args.status)) {
      throw new Error(`Cannot transition from ${existing.status} to ${args.status}`);
    }
    
    const updates: any = { status: args.status };
    
    if (args.status === "published") {
      updates.publishedAt = Date.now();
    }
    
    await ctx.db.patch(args.id, updates);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: args.userId,
      action: "release",
      target: `Release ${existing.version}: ${args.status}`,
      targetType: "release",
    });
    
    return args.id;
  },
});

// Update release changelog
export const updateChangelog = mutation({
  args: {
    id: v.id("releases"),
    userId: v.string(),
    changelog: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Release not found");
    }
    
    // Verify project access
    await verifyProjectAccess(ctx, existing.projectId, args.userId);
    
    // Only allow editing draft releases
    if (existing.status !== "draft") {
      throw new Error("Can only edit draft releases");
    }
    
    await ctx.db.patch(args.id, { changelog: args.changelog });
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: args.userId,
      action: "update",
      target: `Release ${existing.version}: changelog updated`,
      targetType: "release",
    });
    
    return args.id;
  },
});

// Delete a release (only drafts)
export const remove = mutation({
  args: {
    id: v.id("releases"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    
    if (!existing) {
      throw new Error("Release not found");
    }
    
    // Verify project access
    await verifyProjectAccess(ctx, existing.projectId, args.userId);
    
    // Only allow deleting draft releases
    if (existing.status !== "draft") {
      throw new Error("Can only delete draft releases");
    }
    
    await ctx.db.delete(args.id);
    
    // Log activity
    await ctx.db.insert("activity", {
      projectId: existing.projectId,
      user: args.userId,
      action: "delete",
      target: `Release: ${existing.version}`,
      targetType: "release",
    });
    
    return args.id;
  },
});
