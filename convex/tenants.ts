import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// HELPER: Verify tenant access
// ============================================================================

/**
 * Verify that a user has access to a tenant
 * Returns the tenantUser record if access is granted
 */
async function verifyTenantAccess(
  ctx: any,
  tenantId: Id<"tenants">,
  userId: Id<"users">
): Promise<Id<"tenantUsers">> {
  const tenantUser = await ctx.db
    .query("tenantUsers")
    .withIndex("by_tenant_user", (q: any) =>
      q.eq("tenantId", tenantId).eq("userId", userId)
    )
    .first();

  if (!tenantUser || !tenantUser.isActive) {
    throw new Error("Access denied: User does not have access to this tenant");
  }

  return tenantUser._id;
}

/**
 * Check if user has required role in tenant
 */
async function hasRole(
  ctx: any,
  tenantId: Id<"tenants">,
  userId: Id<"users">,
  requiredRole: "owner" | "admin" | "developer" | "designer" | "viewer" | "billing"
): Promise<boolean> {
  const tenantUser = await ctx.db
    .query("tenantUsers")
    .withIndex("by_tenant_user", (q: any) =>
      q.eq("tenantId", tenantId).eq("userId", userId)
    )
    .first();

  if (!tenantUser || !tenantUser.isActive) {
    return false;
  }

  // Role hierarchy: owner > admin > developer > designer > viewer
  const roleHierarchy: Record<string, number> = {
    owner: 5,
    admin: 4,
    developer: 3,
    designer: 2,
    viewer: 1,
    billing: 0, // Special role, no hierarchy
  };

  const userMaxRole = Math.max(
    ...tenantUser.roles.map((r: string) => roleHierarchy[r] || 0)
  );
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userMaxRole >= requiredLevel;
}

// ============================================================================
// TENANT CRUD
// ============================================================================

/**
 * Create a new tenant
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    userId: v.id("users"),
    plan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))
    ),
  },
  handler: async (ctx, args) => {
    // Check if slug is already taken
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error(`Tenant slug "${args.slug}" is already taken`);
    }

    // Create tenant
    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
      plan: args.plan || "free",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Add creator as owner
    await ctx.db.insert("tenantUsers", {
      tenantId,
      userId: args.userId,
      email: "", // Will be populated from users table
      roles: ["owner"],
      isActive: true,
      createdAt: Date.now(),
    });

    // Create default quota for free plan
    await ctx.db.insert("tenantQuotas", {
      tenantId,
      maxProjects: 3,
      maxComponents: 50,
      monthlyBuildMinutes: 100,
      storageGB: 1,
      apiRequestsPerMinute: 60,
      maxUsers: 3,
    });

    // Create default settings
    await ctx.db.insert("tenantSettings", {
      tenantId,
      defaultTokenPolicy: "enforceSemantic",
      allowPublicSharing: false,
      retentionDays: 90,
    });

    return tenantId;
  },
});

/**
 * Get tenant by ID
 */
export const get = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify access
    await verifyTenantAccess(ctx, args.tenantId, args.userId);

    return await ctx.db.get(args.tenantId);
  },
});

/**
 * Get tenant by slug
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!tenant) {
      return null;
    }

    // Verify access
    await verifyTenantAccess(ctx, tenant._id, args.userId);

    return tenant;
  },
});

/**
 * List tenants for a user
 */
export const list = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tenantUsers = await ctx.db
      .query("tenantUsers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const tenantIds = tenantUsers.map((tu) => tu.tenantId);
    const tenants = await Promise.all(
      tenantIds.map((id) => ctx.db.get(id))
    );

    return tenants.filter((t) => t && t.status !== "deleted");
  },
});

/**
 * Update tenant
 */
export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    plan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))
    ),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("deleted"),
        v.literal("pending")
      )
    ),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const hasAdmin = await hasRole(ctx, args.tenantId, args.userId, "admin");
    if (!hasAdmin) {
      throw new Error("Access denied: Admin role required");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    await ctx.db.patch(args.tenantId, {
      ...(args.name && { name: args.name }),
      ...(args.plan && { plan: args.plan }),
      ...(args.status && { status: args.status }),
      updatedAt: Date.now(),
    });

    return args.tenantId;
  },
});

// ============================================================================
// TENANT USERS
// ============================================================================

/**
 * Get tenant users
 */
export const getUsers = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify access
    await verifyTenantAccess(ctx, args.tenantId, args.userId);

    const tenantUsers = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Enrich with user data
    const enriched = await Promise.all(
      tenantUsers.map(async (tu) => {
        const user = await ctx.db.get(tu.userId);
        return {
          ...tu,
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

    return enriched;
  },
});

/**
 * Invite user to tenant
 */
export const inviteUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Inviter
    email: v.string(),
    roles: v.array(
      v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("developer"),
        v.literal("designer"),
        v.literal("viewer"),
        v.literal("billing")
      )
    ),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const hasAdmin = await hasRole(ctx, args.tenantId, args.userId, "admin");
    if (!hasAdmin) {
      throw new Error("Access denied: Admin role required");
    }

    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found. User must sign up first.");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant_user", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      throw new Error("User is already a member of this tenant");
    }

    // Create tenant user
    await ctx.db.insert("tenantUsers", {
      tenantId: args.tenantId,
      userId: user._id,
      email: args.email,
      roles: args.roles,
      isActive: true,
      invitedBy: args.userId,
      invitedAt: Date.now(),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update user roles
 */
export const updateUserRoles = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Requester
    targetUserId: v.id("users"), // User to update
    roles: v.array(
      v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("developer"),
        v.literal("designer"),
        v.literal("viewer"),
        v.literal("billing")
      )
    ),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const hasAdmin = await hasRole(ctx, args.tenantId, args.userId, "admin");
    if (!hasAdmin) {
      throw new Error("Access denied: Admin role required");
    }

    const tenantUser = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant_user", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.targetUserId)
      )
      .first();

    if (!tenantUser) {
      throw new Error("User is not a member of this tenant");
    }

    await ctx.db.patch(tenantUser._id, {
      roles: args.roles,
    });

    return { success: true };
  },
});

/**
 * Remove user from tenant
 */
export const removeUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Requester
    targetUserId: v.id("users"), // User to remove
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const hasAdmin = await hasRole(ctx, args.tenantId, args.userId, "admin");
    if (!hasAdmin) {
      throw new Error("Access denied: Admin role required");
    }

    // Don't allow removing yourself
    if (args.userId === args.targetUserId) {
      throw new Error("Cannot remove yourself from tenant");
    }

    const tenantUser = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant_user", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("userId", args.targetUserId)
      )
      .first();

    if (!tenantUser) {
      throw new Error("User is not a member of this tenant");
    }

    await ctx.db.patch(tenantUser._id, {
      isActive: false,
    });

    return { success: true };
  },
});

// ============================================================================
// TENANT SETTINGS
// ============================================================================

/**
 * Get tenant settings
 */
export const getSettings = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify access
    await verifyTenantAccess(ctx, args.tenantId, args.userId);

    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    return settings;
  },
});

/**
 * Update tenant settings
 */
export const updateSettings = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    defaultTokenPolicy: v.optional(
      v.union(v.literal("enforceSemantic"), v.literal("allowCustom"))
    ),
    allowPublicSharing: v.optional(v.boolean()),
    retentionDays: v.optional(v.number()),
    allowedDomains: v.optional(v.array(v.string())),
    customBrand: v.optional(
      v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        favicon: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const hasAdmin = await hasRole(ctx, args.tenantId, args.userId, "admin");
    if (!hasAdmin) {
      throw new Error("Access denied: Admin role required");
    }

    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        ...(args.defaultTokenPolicy && {
          defaultTokenPolicy: args.defaultTokenPolicy,
        }),
        ...(args.allowPublicSharing !== undefined && {
          allowPublicSharing: args.allowPublicSharing,
        }),
        ...(args.retentionDays !== undefined && {
          retentionDays: args.retentionDays,
        }),
        ...(args.allowedDomains && { allowedDomains: args.allowedDomains }),
        ...(args.customBrand && { customBrand: args.customBrand }),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: args.tenantId,
        defaultTokenPolicy: args.defaultTokenPolicy || "enforceSemantic",
        allowPublicSharing: args.allowPublicSharing || false,
        retentionDays: args.retentionDays || 90,
        ...(args.allowedDomains && { allowedDomains: args.allowedDomains }),
        ...(args.customBrand && { customBrand: args.customBrand }),
      });
    }

    return { success: true };
  },
});

// ============================================================================
// TENANT QUOTAS
// ============================================================================

/**
 * Get tenant quota
 */
export const getQuota = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify access
    await verifyTenantAccess(ctx, args.tenantId, args.userId);

    const quota = await ctx.db
      .query("tenantQuotas")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    return quota;
  },
});

/**
 * Check if tenant has quota available
 */
export const checkQuota = query({
  args: {
    tenantId: v.id("tenants"),
    resource: v.union(
      v.literal("projects"),
      v.literal("components"),
      v.literal("users")
    ),
  },
  handler: async (ctx, args) => {
    const quota = await ctx.db
      .query("tenantQuotas")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!quota) {
      return { available: true, limit: null, used: 0 };
    }

    let limit: number | undefined;
    let used = 0;

    switch (args.resource) {
      case "projects":
        limit = quota.maxProjects;
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
          .collect();
        used = projects.length;
        break;
      case "components":
        limit = quota.maxComponents;
        const components = await ctx.db
          .query("components")
          .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
          .collect();
        used = components.length;
        break;
      case "users":
        limit = quota.maxUsers;
        const users = await ctx.db
          .query("tenantUsers")
          .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();
        used = users.length;
        break;
    }

    return {
      available: limit === undefined || used < limit,
      limit,
      used,
    };
  },
});

