/**
 * SCIM v2 Users Endpoints
 * 
 * Implements SCIM v2.0 User provisioning endpoints for enterprise SSO providers.
 * Supports: GET, POST, PUT, PATCH, DELETE operations on /scim/v2/Users
 */

import { v } from "convex/values";
import { httpAction } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

// SCIM User schema
interface SCIMUser {
  schemas: string[];
  id?: string;
  externalId?: string;
  userName: string;
  name: {
    formatted?: string;
    familyName?: string;
    givenName?: string;
  };
  displayName?: string;
  emails: Array<{
    value: string;
    type?: string;
    primary?: boolean;
  }>;
  active: boolean;
  meta?: {
    resourceType: string;
    created?: string;
    lastModified?: string;
  };
}

// Helper: Authenticate SCIM request
async function authenticateSCIMRequest(ctx: any, headers: Headers): Promise<Id<"tenants"> | null> {
  const authHeader = headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // Find tenant by SCIM token
  const configs = await ctx.runQuery(api.sso.config.listAll);
  for (const config of configs || []) {
    if (config.scimAuthTokenEncrypted === token) {
      return config.tenantId;
    }
  }
  
  return null;
}

// Helper: Convert TenantUser to SCIM User
function tenantUserToSCIM(tenantUser: any, user: any): SCIMUser {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: tenantUser._id,
    externalId: tenantUser.externalId,
    userName: tenantUser.email,
    name: {
      formatted: tenantUser.displayName || user.name,
      givenName: user.name?.split(" ")[0],
      familyName: user.name?.split(" ").slice(1).join(" ") || undefined,
    },
    displayName: tenantUser.displayName || user.name,
    emails: [
      {
        value: tenantUser.email,
        type: "work",
        primary: true,
      },
    ],
    active: tenantUser.isActive,
    meta: {
      resourceType: "User",
      created: new Date(tenantUser.createdAt).toISOString(),
      lastModified: new Date(tenantUser.updatedAt || tenantUser.createdAt).toISOString(),
    },
  };
}

// Helper: Convert SCIM User to TenantUser data
function scimUserToTenantUserData(scimUser: SCIMUser): {
  email: string;
  displayName?: string;
  externalId?: string;
  isActive: boolean;
  roles: string[];
} {
  const email = scimUser.emails?.[0]?.value || scimUser.userName;
  const displayName = scimUser.displayName || 
    scimUser.name?.formatted || 
    `${scimUser.name?.givenName || ""} ${scimUser.name?.familyName || ""}`.trim();

  return {
    email: email.toLowerCase(),
    displayName: displayName || email.split("@")[0],
    externalId: scimUser.externalId || scimUser.id,
    isActive: scimUser.active !== false,
    roles: ["viewer"], // Default role, can be mapped from SCIM groups
  };
}

// GET /scim/v2/Users - List users
export const listUsers = httpAction(async (ctx, request) => {
  const tenantId = await authenticateSCIMRequest(ctx, request.headers);
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: "401",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Get query parameters
    const url = new URL(request.url);
    const startIndex = parseInt(url.searchParams.get("startIndex") || "1");
    const count = parseInt(url.searchParams.get("count") || "100");
    const filter = url.searchParams.get("filter");

    // Get tenant users (need to find a user in the tenant first)
    // For SCIM, we'll query tenantUsers directly
    const tenantUsersRaw = await ctx.runQuery(api.scim.helpers.getTenantUsers, {
      tenantId,
    });
    
    // Apply filter if provided
    let filteredUsers = tenantUsersRaw || [];
    if (filter) {
      // Simple filter parsing (e.g., "userName eq \"user@example.com\"")
      const match = filter.match(/userName eq "([^"]+)"/);
      if (match) {
        filteredUsers = filteredUsers.filter((u: any) => u.email === match[1]);
      }
    }

    // Paginate
    const totalResults = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(startIndex - 1, startIndex - 1 + count);

    // Convert to SCIM format
    const scimUsers = await Promise.all(
      paginatedUsers.map(async (tenantUser: any) => {
        const user = await ctx.runQuery(api.scim.helpers.getUser, { userId: tenantUser.userId });
        return tenantUserToSCIM(tenantUser, user);
      })
    );

    // Log SCIM event
    await ctx.runMutation(api.scim.events.log, {
      tenantId,
      operation: "list",
      resourceType: "User",
      success: true,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults,
        itemsPerPage: count,
        startIndex,
        Resources: scimUsers,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    await ctx.runMutation(api.scim.events.log, {
      tenantId: tenantId!,
      operation: "list",
      resourceType: "User",
      success: false,
      errorMessage: error.message,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: error.message || "Internal server error",
        status: "500",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// GET /scim/v2/Users/:id - Get user
export const getUser = httpAction(async (ctx, request) => {
  const tenantId = await authenticateSCIMRequest(ctx, request.headers);
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: "401",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(request.url);
    const userId = url.pathname.split("/").pop();

    if (!userId) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User ID required",
          status: "400",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get tenant user by ID (userId is actually tenantUserId in SCIM)
    const tenantUser = await ctx.runQuery(api.scim.helpers.getTenantUserById, {
      tenantUserId: userId as any,
    });

    if (!tenantUser) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User not found",
          status: "404",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await ctx.runQuery(api.scim.helpers.getUser, { userId: tenantUser.userId });
    const scimUser = tenantUserToSCIM(tenantUser, user);

    await ctx.runMutation(api.scim.events.log, {
      tenantId,
      operation: "get",
      resourceType: "User",
      resourceId: userId,
      success: true,
    });

    return new Response(JSON.stringify(scimUser), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    await ctx.runMutation(api.scim.events.log, {
      tenantId: tenantId!,
      operation: "get",
      resourceType: "User",
      success: false,
      errorMessage: error.message,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: error.message || "Internal server error",
        status: "500",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// POST /scim/v2/Users - Create user
export const createUser = httpAction(async (ctx, request) => {
  const tenantId = await authenticateSCIMRequest(ctx, request.headers);
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: "401",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const scimUser: SCIMUser = await request.json();
    const userData = scimUserToTenantUserData(scimUser);

    // Create user via SSO provisioning
    const result = await ctx.runMutation(api.sso.oidc.provisionUser, {
      tenantId,
      email: userData.email,
      name: userData.displayName,
      externalId: userData.externalId || "",
      defaultRole: (userData.roles[0] as any) || "viewer",
    });

    // Get created tenant user
    const tenantUser = await ctx.runQuery(api.scim.helpers.getTenantUserByUserId, {
      tenantId,
      userId: result.userId as any,
    });

    const user = await ctx.runQuery(api.scim.helpers.getUser, { userId: result.userId });
    const createdSCIMUser = tenantUserToSCIM(tenantUser, user);

    await ctx.runMutation(api.scim.events.log, {
      tenantId,
      operation: "create",
      resourceType: "User",
      resourceId: result.userId,
      externalId: userData.externalId,
      success: true,
    });

    return new Response(JSON.stringify(createdSCIMUser), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    await ctx.runMutation(api.scim.events.log, {
      tenantId: tenantId!,
      operation: "create",
      resourceType: "User",
      success: false,
      errorMessage: error.message,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: error.message || "Internal server error",
        status: "500",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// PUT /scim/v2/Users/:id - Update user (full replace)
export const updateUser = httpAction(async (ctx, request) => {
  const tenantId = await authenticateSCIMRequest(ctx, request.headers);
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: "401",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(request.url);
    const userId = url.pathname.split("/").pop();
    const scimUser: SCIMUser = await request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User ID required",
          status: "400",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update user
    const userData = scimUserToTenantUserData(scimUser);
    const tenantUser = await ctx.runQuery(api.scim.helpers.getTenantUserById, {
      tenantUserId: userId as any,
    });
    
    if (!tenantUser || tenantUser.tenantId !== tenantId) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User not found",
          status: "404",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    
    await ctx.runMutation(api.scim.helpers.updateTenantUser, {
      tenantId,
      tenantUserId: userId as any,
      displayName: userData.displayName,
      isActive: userData.isActive,
      externalId: userData.externalId,
    });

    // Get updated user
    const updatedTenantUser = await ctx.runQuery(api.scim.helpers.getTenantUserById, {
      tenantUserId: userId as any,
    });

    if (!updatedTenantUser) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User not found",
          status: "404",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await ctx.runQuery(api.scim.helpers.getUser, { userId: updatedTenantUser.userId });
    const updatedSCIMUser = tenantUserToSCIM(updatedTenantUser, user);

    await ctx.runMutation(api.scim.events.log, {
      tenantId,
      operation: "update",
      resourceType: "User",
      resourceId: userId,
      externalId: userData.externalId,
      success: true,
    });

    return new Response(JSON.stringify(updatedSCIMUser), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    await ctx.runMutation(api.scim.events.log, {
      tenantId: tenantId!,
      operation: "update",
      resourceType: "User",
      success: false,
      errorMessage: error.message,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: error.message || "Internal server error",
        status: "500",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// PATCH /scim/v2/Users/:id - Partial update
export const patchUser = httpAction(async (ctx, request) => {
  const tenantId = await authenticateSCIMRequest(ctx, request.headers);
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: "401",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(request.url);
    const userId = url.pathname.split("/").pop();
    const patchRequest: {
      schemas: string[];
      Operations: Array<{
        op: "add" | "remove" | "replace";
        path?: string;
        value: any;
      }>;
    } = await request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User ID required",
          status: "400",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get current user
    const tenantUser = await ctx.runQuery(api.scim.helpers.getTenantUserById, {
      tenantUserId: userId as any,
    });

    if (!tenantUser) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User not found",
          status: "404",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Apply patch operations
    for (const operation of patchRequest.Operations) {
      if (operation.op === "replace") {
        if (operation.path === "active") {
          await ctx.runMutation(api.scim.helpers.updateTenantUser, {
            tenantId,
            tenantUserId: userId as any,
            isActive: operation.value,
          });
        } else if (operation.path === "displayName") {
          await ctx.runMutation(api.scim.helpers.updateTenantUser, {
            tenantId,
            tenantUserId: userId as any,
            displayName: operation.value,
          });
        }
      } else if (operation.op === "remove" && operation.path === "active") {
        await ctx.runMutation(api.scim.helpers.updateTenantUser, {
          tenantId,
          tenantUserId: userId as any,
          isActive: false,
        });
      }
    }

    // Get updated user
    const updatedTenantUser = await ctx.runQuery(api.scim.helpers.getTenantUserById, {
      tenantUserId: userId as any,
    });

    if (!updatedTenantUser) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User not found",
          status: "404",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await ctx.runQuery(api.scim.helpers.getUser, { userId: updatedTenantUser.userId });
    const updatedSCIMUser = tenantUserToSCIM(updatedTenantUser!, user);

    await ctx.runMutation(api.scim.events.log, {
      tenantId,
      operation: "update",
      resourceType: "User",
      resourceId: userId,
      success: true,
    });

    return new Response(JSON.stringify(updatedSCIMUser), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    await ctx.runMutation(api.scim.events.log, {
      tenantId: tenantId!,
      operation: "update",
      resourceType: "User",
      success: false,
      errorMessage: error.message,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: error.message || "Internal server error",
        status: "500",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// DELETE /scim/v2/Users/:id - Delete user
export const deleteUser = httpAction(async (ctx, request) => {
  const tenantId = await authenticateSCIMRequest(ctx, request.headers);
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: "401",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(request.url);
    const userId = url.pathname.split("/").pop();

    if (!userId) {
      return new Response(
        JSON.stringify({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          detail: "User ID required",
          status: "400",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deactivate user (soft delete)
    await ctx.runMutation(api.scim.helpers.updateTenantUser, {
      tenantId,
      tenantUserId: userId as any,
      isActive: false,
    });

    await ctx.runMutation(api.scim.events.log, {
      tenantId,
      operation: "delete",
      resourceType: "User",
      resourceId: userId,
      success: true,
    });

    return new Response(null, { status: 204 });
  } catch (error: any) {
    await ctx.runMutation(api.scim.events.log, {
      tenantId: tenantId!,
      operation: "delete",
      resourceType: "User",
      success: false,
      errorMessage: error.message,
    });

    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: error.message || "Internal server error",
        status: "500",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

