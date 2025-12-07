/**
 * Project Member Management
 * 
 * Handles project-level access control and member management.
 * Project members are in addition to tenant members - both must have access.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, requireRole } from "./tenantMiddleware";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all members of a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);

    // Verify user has access to this project (must be tenant member)
    const project = await ctx.db.get(args.projectId);
    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    // Get all project members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          user: user
            ? {
                email: user.email,
                name: user.name,
                image: user.image,
              }
            : null,
        };
      })
    );

    return membersWithDetails;
  },
});

/**
 * Get project member details for a specific user
 */
export const get = query({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);

    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    // Get project member
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.targetUserId)
      )
      .first();

    if (!member || !member.isActive) {
      return null;
    }

    const user = await ctx.db.get(args.targetUserId);
    return {
      ...member,
      user: user
        ? {
            email: user.email,
            name: user.name,
            image: user.image,
          }
        : null,
    };
  },
});

/**
 * Check if user has access to a project
 */
export const hasAccess = query({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // First verify tenant access
    try {
      await getTenantContext(ctx, args.userId, args.tenantId);
    } catch {
      return { hasAccess: false, role: null };
    }

    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project || project.tenantId !== args.tenantId) {
      return { hasAccess: false, role: null };
    }

    // Check if user is a project member
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .first();

    if (!member || !member.isActive) {
      return { hasAccess: false, role: null };
    }

    return { hasAccess: true, role: member.role };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Add a member to a project
 * Requires: admin role in project (or owner)
 */
export const add = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Current user performing the action
    targetUserId: v.id("users"), // User to add
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);

    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    // Verify current user has permission (admin or owner role in project)
    const currentMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .first();

    if (!currentMember || !currentMember.isActive) {
      throw new Error("Access denied: You are not a member of this project");
    }

    if (currentMember.role !== "owner" && currentMember.role !== "admin") {
      throw new Error("Access denied: Admin or owner role required");
    }

    // Verify target user is a tenant member
    const tenantUser = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.targetUserId)
      )
      .first();

    if (!tenantUser || !tenantUser.isActive) {
      throw new Error("User must be a member of the tenant first");
    }

    // Check if member already exists
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.targetUserId)
      )
      .first();

    if (existing) {
      if (existing.isActive) {
        throw new Error("User is already a member of this project");
      }
      // Reactivate and update role
      await ctx.db.patch(existing._id, {
        role: args.role,
        isActive: true,
        addedBy: args.userId,
        addedAt: Date.now(),
      });
      return existing._id;
    }

    // Add new member
    const memberId = await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      tenantId: args.tenantId,
      userId: args.targetUserId,
      role: args.role,
      addedBy: args.userId,
      addedAt: Date.now(),
      isActive: true,
    });

    return memberId;
  },
});

/**
 * Update a project member's role
 * Requires: admin role in project (or owner)
 */
export const updateRole = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Current user performing the action
    targetUserId: v.id("users"), // User whose role to update
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);

    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    // Verify current user has permission (admin or owner)
    const currentMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .first();

    if (!currentMember || !currentMember.isActive) {
      throw new Error("Access denied: You are not a member of this project");
    }

    if (currentMember.role !== "owner" && currentMember.role !== "admin") {
      throw new Error("Access denied: Admin or owner role required");
    }

    // Prevent removing the last owner
    if (args.role !== "owner" && currentMember.userId === args.targetUserId && currentMember.role === "owner") {
      // Check if there are other owners
      const allMembers = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const owners = allMembers.filter(
        (m) => m.role === "owner" && m.userId !== args.targetUserId
      );

      if (owners.length === 0) {
        throw new Error("Cannot remove the last owner from the project");
      }
    }

    // Find target member
    const targetMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.targetUserId)
      )
      .first();

    if (!targetMember || !targetMember.isActive) {
      throw new Error("User is not a member of this project");
    }

    // Update role
    await ctx.db.patch(targetMember._id, {
      role: args.role,
    });

    return targetMember._id;
  },
});

/**
 * Remove a member from a project
 * Requires: admin role in project (or owner)
 */
export const remove = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Current user performing the action
    targetUserId: v.id("users"), // User to remove
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);

    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    // Verify current user has permission (admin or owner)
    const currentMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .first();

    if (!currentMember || !currentMember.isActive) {
      throw new Error("Access denied: You are not a member of this project");
    }

    if (currentMember.role !== "owner" && currentMember.role !== "admin") {
      throw new Error("Access denied: Admin or owner role required");
    }

    // Prevent removing the last owner
    if (currentMember.userId === args.targetUserId && currentMember.role === "owner") {
      const allMembers = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const owners = allMembers.filter(
        (m) => m.role === "owner" && m.userId !== args.targetUserId
      );

      if (owners.length === 0) {
        throw new Error("Cannot remove the last owner from the project");
      }
    }

    // Find and deactivate member
    const targetMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.targetUserId)
      )
      .first();

    if (!targetMember || !targetMember.isActive) {
      throw new Error("User is not a member of this project");
    }

    // Deactivate instead of delete (for audit trail)
    await ctx.db.patch(targetMember._id, {
      isActive: false,
    });

    return targetMember._id;
  },
});

