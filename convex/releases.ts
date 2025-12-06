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

// Get all releases for a project
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
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
    
    return await ctx.db
      .query("releases")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
      )
      .order("desc")
      .collect();
  },
});

// Get the latest published release for a project
export const latest = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    if (!args.projectId) {
      return null;
    }
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    const releases = await ctx.db
      .query("releases")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId!)
      )
      .filter((q) => q.eq(q.field("status"), "published"))
      .order("desc")
      .collect();
    
    return releases[0] || null;
  },
});

// Get a single release by ID (with tenant access check)
export const get = query({
  args: { 
    id: v.id("releases"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const release = await ctx.db.get(args.id);
    if (!release) return null;
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, release);
    
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
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    version: v.string(),
    changelog: v.string(),
    components: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, userId, ...releaseData } = args;
    
    // Verify tenant access and require developer role
    await getTenantContext(ctx, userId, tenantId);
    await requireRole(ctx, tenantId, userId, "developer");
    
    // Verify project access
    await verifyProjectAccess(ctx, args.projectId, tenantId, userId);
    
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
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", tenantId).eq("projectId", args.projectId)
      )
      .filter((q) => q.eq(q.field("version"), version))
      .first();
    
    if (existing) {
      throw new Error(`Release ${version} already exists`);
    }
    
    // Get user email for activity log
    const user = await ctx.db.get(userId);
    const userEmail = user?.email || "unknown";
    
    const releaseId = await ctx.db.insert("releases", {
      tenantId,
      ...releaseData,
      version,
      status: "draft",
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId,
      projectId: args.projectId,
      user: userEmail,
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
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    status: v.union(
      v.literal("draft"),
      v.literal("in_progress"),
      v.literal("published"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, existing);
    
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
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: existing.projectId,
      user: userEmail,
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
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    changelog: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, existing);
    
    // Only allow editing draft releases
    if (existing.status !== "draft") {
      throw new Error("Can only edit draft releases");
    }
    
    await ctx.db.patch(args.id, { changelog: args.changelog });
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: existing.projectId,
      user: userEmail,
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
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, existing);
    
    // Only allow deleting draft releases
    if (existing.status !== "draft") {
      throw new Error("Can only delete draft releases");
    }
    
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
      target: `Release: ${existing.version}`,
      targetType: "release",
    });
    
    return args.id;
  },
});
