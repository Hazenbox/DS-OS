/**
 * SSO Configuration Management
 * 
 * Functions for managing SSO (OIDC/SAML) configuration per tenant.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getTenantContext, requireRole } from "../tenantMiddleware";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get SSO configuration for a tenant
 */
export const get = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    
    if (!config) {
      return null;
    }
    
    // Don't return sensitive data
    return {
      _id: config._id,
      tenantId: config.tenantId,
      provider: config.provider,
      providerName: config.providerName,
      clientId: config.clientId,
      issuer: config.issuer,
      authorizationEndpoint: config.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      userInfoEndpoint: config.userInfoEndpoint,
      jwksUri: config.jwksUri,
      scopes: config.scopes,
      redirectUri: config.redirectUri,
      ssoUrl: config.ssoUrl,
      scimEnabled: config.scimEnabled,
      scimUrl: config.scimUrl,
      allowProvisioning: config.allowProvisioning,
      defaultRole: config.defaultRole,
      enabled: config.enabled,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  },
});

/**
 * Check if SSO is enabled for a tenant
 */
export const isEnabled = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("enabled"), true))
      .first();
    
    return !!config;
  },
});

/**
 * List all SSO configs (for SCIM authentication)
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db
      .query("ssoConfigs")
      .filter((q) => q.eq(q.field("scimEnabled"), true))
      .collect();
    
    return configs.map(config => ({
      _id: config._id,
      tenantId: config.tenantId,
      scimAuthTokenEncrypted: config.scimAuthTokenEncrypted,
    }));
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create or update OIDC SSO configuration
 */
export const setOidcConfig = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    providerName: v.string(),
    clientId: v.string(),
    clientSecret: v.string(), // Will be encrypted
    issuer: v.string(),
    authorizationEndpoint: v.string(),
    tokenEndpoint: v.string(),
    userInfoEndpoint: v.string(),
    jwksUri: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    redirectUri: v.string(),
    allowProvisioning: v.optional(v.boolean()),
    defaultRole: v.optional(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("developer"),
      v.literal("designer"),
      v.literal("viewer")
    )),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    const now = Date.now();
    
    // Check if config exists
    const existing = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("provider"), "oidc"))
      .first();
    
    // TODO: Encrypt client secret (use Convex secrets or external KMS)
    // For now, store as-is (NOT SECURE - must encrypt in production)
    const clientSecretEncrypted = args.clientSecret;
    
    if (existing) {
      // Update existing config
      await ctx.db.patch(existing._id, {
        providerName: args.providerName,
        clientId: args.clientId,
        clientSecretEncrypted,
        issuer: args.issuer,
        authorizationEndpoint: args.authorizationEndpoint,
        tokenEndpoint: args.tokenEndpoint,
        userInfoEndpoint: args.userInfoEndpoint,
        jwksUri: args.jwksUri,
        scopes: args.scopes || ["openid", "email", "profile"],
        redirectUri: args.redirectUri,
        allowProvisioning: args.allowProvisioning ?? true,
        defaultRole: args.defaultRole || "viewer",
        enabled: args.enabled ?? false,
        updatedAt: now,
      });
      
      return { _id: existing._id, updated: true };
    } else {
      // Create new config
      const configId = await ctx.db.insert("ssoConfigs", {
        tenantId: args.tenantId,
        provider: "oidc",
        providerName: args.providerName,
        clientId: args.clientId,
        clientSecretEncrypted,
        issuer: args.issuer,
        authorizationEndpoint: args.authorizationEndpoint,
        tokenEndpoint: args.tokenEndpoint,
        userInfoEndpoint: args.userInfoEndpoint,
        jwksUri: args.jwksUri,
        scopes: args.scopes || ["openid", "email", "profile"],
        redirectUri: args.redirectUri,
        allowProvisioning: args.allowProvisioning ?? true,
        defaultRole: args.defaultRole || "viewer",
        enabled: args.enabled ?? false,
        createdAt: now,
        updatedAt: now,
      });
      
      return { _id: configId, updated: false };
    }
  },
});

/**
 * Update SSO configuration (partial update)
 */
export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    enabled: v.optional(v.boolean()),
    allowProvisioning: v.optional(v.boolean()),
    defaultRole: v.optional(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("developer"),
      v.literal("designer"),
      v.literal("viewer")
    )),
  },
  handler: async (ctx, args) => {
    // Require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    
    if (!config) {
      throw new Error("SSO configuration not found");
    }
    
    const updates: any = {
      updatedAt: Date.now(),
    };
    
    if (args.enabled !== undefined) {
      updates.enabled = args.enabled;
    }
    if (args.allowProvisioning !== undefined) {
      updates.allowProvisioning = args.allowProvisioning;
    }
    if (args.defaultRole !== undefined) {
      updates.defaultRole = args.defaultRole;
    }
    
    await ctx.db.patch(config._id, updates);
    
    return { _id: config._id };
  },
});

/**
 * Delete SSO configuration
 */
export const remove = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    
    if (!config) {
      throw new Error("SSO configuration not found");
    }
    
    await ctx.db.delete(config._id);
    
    return { success: true };
  },
});

/**
 * Test SSO connection (validate configuration)
 */
export const testConnection = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    
    if (!config) {
      throw new Error("SSO configuration not found");
    }
    
    if (config.provider === "oidc") {
      // For OIDC, we can validate the issuer URL
      if (!config.issuer) {
        throw new Error("Issuer URL is required");
      }
      
      // Try to fetch the well-known configuration
      try {
        const wellKnownUrl = `${config.issuer}/.well-known/openid-configuration`;
        const response = await fetch(wellKnownUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
        }
        
        const oidcConfig = await response.json();
        
        // Validate endpoints match
        if (config.authorizationEndpoint !== oidcConfig.authorization_endpoint) {
          return {
            success: false,
            warning: "Authorization endpoint mismatch",
            details: {
              configured: config.authorizationEndpoint,
              discovered: oidcConfig.authorization_endpoint,
            },
          };
        }
        
        return {
          success: true,
          message: "SSO configuration is valid",
          details: {
            issuer: oidcConfig.issuer,
            authorizationEndpoint: oidcConfig.authorization_endpoint,
            tokenEndpoint: oidcConfig.token_endpoint,
            userInfoEndpoint: oidcConfig.userinfo_endpoint,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Failed to validate SSO configuration",
        };
      }
    }
    
    return {
      success: false,
      error: "Unsupported provider type",
    };
  },
});

/**
 * Generate SCIM authentication token
 */
export const generateSCIMToken = mutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Require admin role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "admin");
    
    // Generate secure random token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    
    // Get or create SSO config
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    
    if (!config) {
      throw new Error("SSO configuration not found. Please configure SSO first.");
    }
    
    // Update config with SCIM token
    await ctx.db.patch(config._id, {
      scimEnabled: true,
      scimAuthTokenEncrypted: token, // In production, encrypt this
      scimUrl: `${process.env.CONVEX_SITE_URL || ''}/scim/v2/Users`,
      updatedAt: Date.now(),
    });
    
    return {
      token,
      scimUrl: `${process.env.CONVEX_SITE_URL || ''}/scim/v2/Users`,
    };
  },
});

