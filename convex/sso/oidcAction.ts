/**
 * OIDC SSO Action - HTTP requests to OIDC providers
 * 
 * This file contains the action that makes external HTTP requests.
 * Actions can use "use node" directive for Node.js APIs.
 */

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Exchange authorization code for tokens and create session
 * This action makes HTTP requests to the OIDC provider
 */
export const exchangeCodeForSession = action({
  args: {
    code: v.string(),
    state: v.string(),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args): Promise<{
    sessionToken: string;
    expiresAt: number;
    redirectUrl?: string;
    user: { userId: string; email: string; name?: string };
  }> => {
    // First, validate state via mutation
    const callbackResult = await ctx.runMutation(api.sso.oidc.handleCallback, {
      code: args.code,
      state: args.state,
      tenantId: args.tenantId,
    });
    
    // Get full config (including encrypted secret)
    const config = await ctx.runQuery(api.sso.oidc.getConfigForExchange, {
      configId: callbackResult.configId,
      tenantId: args.tenantId,
    });
    
    if (!config) {
      throw new Error("SSO configuration not found");
    }
    
    // Exchange code for tokens
    const tokenResponse: Response = await fetch(config.tokenEndpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: config.redirectUri!,
        client_id: config.clientId!,
        client_secret: config.clientSecretEncrypted!, // In production, decrypt this
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }
    
    const tokens = await tokenResponse.json() as { access_token: string; id_token?: string };
    
    // Validate ID token (simplified - in production, verify signature)
    // For now, we'll get user info from userInfo endpoint
    const userInfoResponse: Response = await fetch(config.userInfoEndpoint!, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    
    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch user info");
    }
    
    const userInfo = await userInfoResponse.json() as {
      sub: string;
      email?: string;
      preferred_username?: string;
      name?: string;
      display_name?: string;
    };
    
    // Extract user information
    const email = userInfo.email || userInfo.preferred_username;
    const externalId = userInfo.sub;
    const name = userInfo.name || userInfo.display_name || email?.split("@")[0];
    
    if (!email || !externalId) {
      throw new Error("Missing required user information from IdP");
    }
    
    // Find or create user
    let user = await ctx.runQuery(api.sso.oidc.findUserByExternalId, {
      tenantId: args.tenantId,
      externalId,
      email,
    }) as { userId: string; email: string; name?: string; tenantUserId: string; needsUpdate?: boolean } | null;
    
    // Update externalId if needed
    if (user && 'needsUpdate' in user && user.needsUpdate) {
      await ctx.runMutation(api.sso.oidc.updateTenantUserExternalId, {
        tenantUserId: user.tenantUserId as any,
        externalId,
      });
      delete (user as any).needsUpdate;
    }
    
    if (!user && config.allowProvisioning) {
      // JIT provisioning - create user
      user = await ctx.runMutation(api.sso.oidc.provisionUser, {
        tenantId: args.tenantId,
        email,
        name,
        externalId,
        defaultRole: config.defaultRole || "viewer",
      }) as { userId: string; email: string; name?: string; tenantUserId: string };
    }
    
    if (!user) {
      throw new Error("User not found and provisioning is disabled");
    }
    
    // Create session
    const session = await ctx.runMutation(api.sso.oidc.createSSOSession, {
      userId: user.userId as any,
      tenantId: args.tenantId,
    }) as { token: string; expiresAt: number };
    
    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      redirectUrl: callbackResult.redirectUrl,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
    };
  },
});

