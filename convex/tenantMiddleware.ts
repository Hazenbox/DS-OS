/**
 * Tenant Middleware Helpers
 * 
 * Ensures all operations are tenant-scoped and access-controlled.
 * Use these helpers in all Convex functions to enforce tenant isolation.
 */

import { Id } from "./_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

export interface TenantContext {
  tenantId: Id<"tenants">;
  userId: Id<"users">;
  roles: string[];
}

// ============================================================================
// TENANT ACCESS VERIFICATION
// ============================================================================

/**
 * Get tenant context from user session
 * This should be called at the start of every query/mutation
 */
export async function getTenantContext(
  ctx: any,
  userId: Id<"users">,
  tenantId?: Id<"tenants">
): Promise<TenantContext> {
  // If tenantId provided, verify access
  if (tenantId) {
    const tenantUser = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant_user", (q: any) =>
        q.eq("tenantId", tenantId).eq("userId", userId)
      )
      .first();

    if (!tenantUser || !tenantUser.isActive) {
      throw new Error("Access denied: User does not have access to this tenant");
    }

    return {
      tenantId,
      userId,
      roles: tenantUser.roles,
    };
  }

  // If no tenantId, try to find user's default tenant
  // For now, we'll require tenantId to be provided
  // In the future, we can implement a "default tenant" concept
  throw new Error("tenantId is required");
}

/**
 * Verify user has required role in tenant
 */
export async function requireRole(
  ctx: any,
  tenantId: Id<"tenants">,
  userId: Id<"users">,
  requiredRole: "owner" | "admin" | "developer" | "designer" | "viewer" | "billing"
): Promise<void> {
  const tenantUser = await ctx.db
    .query("tenantUsers")
    .withIndex("by_tenant_user", (q: any) =>
      q.eq("tenantId", tenantId).eq("userId", userId)
    )
    .first();

  if (!tenantUser || !tenantUser.isActive) {
    throw new Error("Access denied: User does not have access to this tenant");
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

  if (userMaxRole < requiredLevel) {
    throw new Error(
      `Access denied: ${requiredRole} role required, but user has ${tenantUser.roles.join(", ")}`
    );
  }
}

/**
 * Verify tenant access to a resource
 * Ensures the resource belongs to the tenant
 */
export async function verifyTenantResource<T extends { tenantId: Id<"tenants"> }>(
  ctx: any,
  tenantId: Id<"tenants">,
  resource: T | null
): Promise<T> {
  if (!resource) {
    throw new Error("Resource not found");
  }

  // tenantId is now required - all records must have it
  if (resource.tenantId !== tenantId) {
    throw new Error("Access denied: Resource does not belong to this tenant");
  }

  return resource;
}

/**
 * Get active tenant for user (first active tenant)
 * This is a helper for migration/backward compatibility
 */
export async function getActiveTenantForUser(
  ctx: any,
  userId: Id<"users">
): Promise<Id<"tenants"> | null> {
  const tenantUser = await ctx.db
    .query("tenantUsers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!tenantUser) {
    return null;
  }

  const tenant = await ctx.db.get(tenantUser.tenantId);
  if (!tenant || tenant.status !== "active") {
    return null;
  }

  return tenant._id;
}

/**
 * Create personal tenant for user (for migration)
 * This creates a "personal" tenant for users who don't have one yet
 */
export async function createPersonalTenant(
  ctx: any,
  userId: Id<"users">,
  userEmail: string
): Promise<Id<"tenants">> {
  // Get user to create tenant name
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const tenantName = user.name || userEmail.split("@")[0];
  const tenantSlug = `personal-${userId.replace(":", "-")}`;

  // Check if personal tenant already exists
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
      .first();

  if (existing) {
    return existing._id;
  }

  // Create tenant
  const tenantId = await ctx.db.insert("tenants", {
    name: `${tenantName}'s Workspace`,
    slug: tenantSlug,
    plan: "free",
    status: "active",
    metadata: { type: "personal", userId: userId },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Add user as owner
  await ctx.db.insert("tenantUsers", {
    tenantId,
    userId,
    email: userEmail,
    roles: ["owner"],
    isActive: true,
    createdAt: Date.now(),
  });

  // Create default quota
  await ctx.db.insert("tenantQuotas", {
    tenantId,
    maxProjects: 3,
    maxComponents: 50,
    monthlyBuildMinutes: 100,
    storageGB: 1,
    apiRequestsPerMinute: 60,
    maxUsers: 1,
  });

  // Create default settings
  await ctx.db.insert("tenantSettings", {
    tenantId,
    defaultTokenPolicy: "enforceSemantic",
    allowPublicSharing: false,
    retentionDays: 90,
  });

  return tenantId;
}

