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

// Update test results for a release
export const updateTestResults = mutation({
  args: {
    releaseId: v.id("releases"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    visualDiffResults: v.optional(v.array(v.object({
      componentId: v.string(),
      variantId: v.optional(v.string()),
      passed: v.boolean(),
      diffPercentage: v.number(),
      diffImage: v.optional(v.string()),
      threshold: v.number(),
      screenshotUrl: v.optional(v.string()),
      figmaImageUrl: v.optional(v.string()),
      errors: v.optional(v.array(v.string())),
      testedAt: v.number(),
    }))),
    accessibilityResults: v.optional(v.array(v.object({
      componentId: v.string(),
      variantId: v.optional(v.string()),
      passed: v.boolean(),
      violations: v.array(v.object({
        id: v.string(),
        impact: v.string(),
        description: v.string(),
        help: v.string(),
        helpUrl: v.string(),
        nodes: v.array(v.string()),
      })),
      testedAt: v.number(),
      score: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const { releaseId, tenantId, userId, ...updates } = args;
    
    // Verify tenant access
    await getTenantContext(ctx, userId, tenantId);
    
    const release = await ctx.db.get(releaseId);
    if (!release) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, tenantId, release);
    
    // Update test results
    const updateData: any = {};
    
    if (updates.visualDiffResults !== undefined) {
      updateData.visualDiffResults = updates.visualDiffResults;
    }
    
    if (updates.accessibilityResults !== undefined) {
      updateData.accessibilityResults = updates.accessibilityResults;
    }
    
    await ctx.db.patch(releaseId, updateData);
    
    return releaseId;
  },
});

// Update release status
// Approve a component in a release
export const approveComponent = mutation({
  args: {
    releaseId: v.id("releases"),
    componentId: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const release = await ctx.db.get(args.releaseId);
    if (!release) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, release);
    
    // Verify component is in release
    if (!release.components.includes(args.componentId)) {
      throw new Error("Component not found in release");
    }
    
    // Get user email
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Update or create component approval
    const approvals = release.componentApprovals || [];
    const existingIndex = approvals.findIndex((a: any) => a.componentId === args.componentId);
    
    if (existingIndex >= 0) {
      approvals[existingIndex] = {
        componentId: args.componentId,
        status: "approved",
        approvedBy: userEmail,
        approvedAt: Date.now(),
        rejectedBy: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
      };
    } else {
      approvals.push({
        componentId: args.componentId,
        status: "approved",
        approvedBy: userEmail,
        approvedAt: Date.now(),
      });
    }
    
    await ctx.db.patch(args.releaseId, {
      componentApprovals: approvals,
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: release.projectId,
      user: userEmail,
      action: "component_approved",
      target: args.componentId,
      targetType: "component",
    });
  },
});

// Reject a component in a release
export const rejectComponent = mutation({
  args: {
    releaseId: v.id("releases"),
    componentId: v.string(),
    reason: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const release = await ctx.db.get(args.releaseId);
    if (!release) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, release);
    
    // Verify component is in release
    if (!release.components.includes(args.componentId)) {
      throw new Error("Component not found in release");
    }
    
    // Get user email
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Update or create component approval
    const approvals = release.componentApprovals || [];
    const existingIndex = approvals.findIndex((a: any) => a.componentId === args.componentId);
    
    if (existingIndex >= 0) {
      approvals[existingIndex] = {
        componentId: args.componentId,
        status: "rejected",
        rejectedBy: userEmail,
        rejectedAt: Date.now(),
        rejectionReason: args.reason.trim(),
        approvedBy: undefined,
        approvedAt: undefined,
      };
    } else {
      approvals.push({
        componentId: args.componentId,
        status: "rejected",
        rejectedBy: userEmail,
        rejectedAt: Date.now(),
        rejectionReason: args.reason.trim(),
      });
    }
    
    await ctx.db.patch(args.releaseId, {
      componentApprovals: approvals,
    });
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: release.projectId,
      user: userEmail,
      action: "component_rejected",
      target: args.componentId,
      targetType: "component",
    });
  },
});

// Approve entire release (all components approved)
export const approveRelease = mutation({
  args: {
    releaseId: v.id("releases"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const release = await ctx.db.get(args.releaseId);
    if (!release) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    verifyTenantResource(ctx, args.tenantId, release);
    
    // Check if all components are approved
    const approvals = release.componentApprovals || [];
    const allApproved = release.components.every((compId: string) => {
      const approval = approvals.find((a: any) => a.componentId === compId);
      return approval?.status === "approved";
    });
    
    if (!allApproved) {
      throw new Error("All components must be approved before approving the release");
    }
    
    // Update release status to published
    await ctx.db.patch(args.releaseId, {
      status: "published",
      publishedAt: Date.now(),
    });
    
    // Get user email for activity log
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    // Log activity
    await ctx.db.insert("activity", {
      tenantId: args.tenantId,
      projectId: release.projectId,
      user: userEmail,
      action: "release_approved",
      target: args.releaseId,
      targetType: "release",
    });
  },
});

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
