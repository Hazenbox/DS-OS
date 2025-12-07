/**
 * OIDC SSO Authentication
 * 
 * Implements OIDC (OpenID Connect) Single Sign-On flow for enterprise customers.
 * Supports providers like Okta, Azure AD, Google Workspace.
 */

import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { getTenantContext } from "../tenantMiddleware";

// Generate a secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a secure random string for state/nonce
function generateRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get SSO configuration for a tenant
 */
export const getConfig = query({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("provider"), "oidc"))
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
      enabled: config.enabled,
      allowProvisioning: config.allowProvisioning,
      defaultRole: config.defaultRole,
      redirectUri: config.redirectUri,
    };
  },
});

/**
 * Check if tenant has SSO enabled
 */
export const isEnabled = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant_enabled", (q) => 
        q.eq("tenantId", args.tenantId).eq("enabled", true)
      )
      .filter((q) => q.eq(q.field("provider"), "oidc"))
      .first();
    
    return !!config;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Initiate OIDC login - generates state/nonce and returns authorization URL
 */
export const initiateLogin = mutation({
  args: {
    tenantId: v.id("tenants"),
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get OIDC config for tenant
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant_enabled", (q) => 
        q.eq("tenantId", args.tenantId).eq("enabled", true)
      )
      .filter((q) => q.eq(q.field("provider"), "oidc"))
      .first();
    
    if (!config || !config.enabled) {
      throw new Error("SSO is not configured or enabled for this tenant");
    }
    
    if (!config.clientId || !config.authorizationEndpoint || !config.redirectUri) {
      throw new Error("SSO configuration is incomplete");
    }
    
    // Generate state and nonce for CSRF protection
    const state = generateRandomString();
    const nonce = generateRandomString();
    
    // Store state in database (expires in 10 minutes)
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await ctx.db.insert("ssoStates", {
      state,
      nonce,
      tenantId: args.tenantId,
      redirectUrl: args.redirectUrl,
      createdAt: Date.now(),
      expiresAt,
    });
    
    // Build authorization URL
    const scopes = config.scopes || ["openid", "email", "profile"];
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state,
      nonce,
    });
    
    const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;
    
    return {
      authUrl,
      state,
    };
  },
});

/**
 * Handle OIDC callback - validates code and creates session
 * This will be called from an action that can make HTTP requests
 */
export const handleCallback = mutation({
  args: {
    code: v.string(),
    state: v.string(),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    // Verify state
    const ssoState = await ctx.db
      .query("ssoStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
    
    if (!ssoState || ssoState.tenantId !== args.tenantId) {
      throw new Error("Invalid state parameter");
    }
    
    if (ssoState.expiresAt < Date.now()) {
      throw new Error("State expired. Please try again.");
    }
    
    // Get OIDC config
    const config = await ctx.db
      .query("ssoConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("provider"), "oidc"))
      .first();
    
    if (!config || !config.enabled) {
      throw new Error("SSO configuration not found");
    }
    
    // Delete used state
    await ctx.db.delete(ssoState._id);
    
    // Return data needed for token exchange (will be done in action)
    return {
      configId: config._id as any,
      nonce: ssoState.nonce,
      redirectUrl: ssoState.redirectUrl,
    };
  },
});

// ============================================================================
// INTERNAL QUERIES/MUTATIONS (used by actions)
// ============================================================================

/**
 * Get config for token exchange (includes secret)
 */
export const getConfigForExchange = query({
  args: {
    configId: v.id("ssoConfigs"),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config || config.tenantId !== args.tenantId) {
      return null;
    }
    return config;
  },
});

/**
 * Update tenant user with external ID (mutation for patch operation)
 */
export const updateTenantUserExternalId = mutation({
  args: {
    tenantUserId: v.id("tenantUsers"),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tenantUserId, {
      externalId: args.externalId,
      ssoProvider: "oidc",
    });
  },
});

/**
 * Find user by external ID
 */
export const findUserByExternalId = query({
  args: {
    tenantId: v.id("tenants"),
    externalId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // First try by externalId
    const tenantUser = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("externalId"), args.externalId))
      .first();
    
    if (tenantUser) {
      const user = await ctx.db.get(tenantUser.userId);
      return {
        userId: tenantUser.userId,
        email: tenantUser.email,
        name: tenantUser.displayName,
        tenantUserId: tenantUser._id,
      };
    }
    
    // Fallback: try by email
    const tenantUserByEmail = await ctx.db
      .query("tenantUsers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("email"), args.email.toLowerCase()))
      .first();
    
    if (tenantUserByEmail) {
      // Update with externalId (need to use mutation)
      // For now, return the user and update will happen in action
      const user = await ctx.db.get(tenantUserByEmail.userId);
      return {
        userId: tenantUserByEmail.userId,
        email: tenantUserByEmail.email,
        name: tenantUserByEmail.displayName,
        tenantUserId: tenantUserByEmail._id,
        needsUpdate: true, // Flag to update externalId
      };
    }
    
    return null;
  },
});

/**
 * Provision user via JIT (Just-In-Time)
 */
export const provisionUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.optional(v.string()),
    externalId: v.string(),
    defaultRole: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("developer"),
      v.literal("designer"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    // Check if user already exists globally
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    
    if (!user) {
      // Create user
      const userId = await ctx.db.insert("users", {
        email: args.email.toLowerCase(),
        name: args.name,
        emailVerified: true, // SSO users are pre-verified
        role: "user",
        provider: "oidc",
        providerId: args.externalId,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }
    
    if (!user) {
      throw new Error("Failed to create user");
    }
    
    // Create tenant user relationship
    const tenantUserId = await ctx.db.insert("tenantUsers", {
      tenantId: args.tenantId,
      userId: user._id,
      email: user.email,
      displayName: user.name,
      roles: [args.defaultRole],
      isActive: true,
      ssoProvider: "oidc",
      externalId: args.externalId,
      createdAt: Date.now(),
    });
    
    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      tenantUserId,
    };
  },
});

/**
 * Create SSO session
 */
export const createSSOSession = mutation({
  args: {
    userId: v.id("users"),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const token = generateSessionToken();
    
    await ctx.db.insert("sessions", {
      userId: args.userId,
      token,
      expiresAt: now + SESSION_DURATION,
      createdAt: now,
      lastActiveAt: now,
    });
    
    return {
      token,
      expiresAt: now + SESSION_DURATION,
    };
  },
});

