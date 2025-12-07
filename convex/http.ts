/**
 * HTTP Router
 * 
 * Routes HTTP requests to appropriate handlers.
 * Used for SCIM v2 endpoints and SSO callbacks.
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

// Import SCIM handlers
import { listUsers, getUser, createUser, updateUser, patchUser, deleteUser } from "./scim/users";

const http = httpRouter();

// SCIM v2 Users endpoints
http.route({
  path: "/scim/v2/Users",
  method: "GET",
  handler: listUsers,
});

http.route({
  path: "/scim/v2/Users/:id",
  method: "GET",
  handler: getUser,
});

http.route({
  path: "/scim/v2/Users",
  method: "POST",
  handler: createUser,
});

http.route({
  path: "/scim/v2/Users/:id",
  method: "PUT",
  handler: updateUser,
});

http.route({
  path: "/scim/v2/Users/:id",
  method: "PATCH",
  handler: patchUser,
});

http.route({
  path: "/scim/v2/Users/:id",
  method: "DELETE",
  handler: deleteUser,
});

// SCIM v2 ServiceProviderConfig
http.route({
  path: "/scim/v2/ServiceProviderConfig",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response(
      JSON.stringify({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 200 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [
          {
            type: "oauthbearertoken",
            name: "OAuth Bearer Token",
            description: "Authentication using OAuth 2.0 Bearer Token",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

// SSO Callback handler (will be implemented)
http.route({
  path: "/auth/sso/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const tenantId = url.searchParams.get("tenantId");

    if (!code || !state || !tenantId) {
      return new Response("Missing required parameters", { status: 400 });
    }

    try {
      // Exchange code for session
      const result = await ctx.runAction(api.sso.oidcAction.exchangeCodeForSession, {
        code,
        state,
        tenantId: tenantId as any,
      });

      // Redirect to app with session token
      const redirectUrl = result.redirectUrl || "/";
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${redirectUrl}?sessionToken=${result.sessionToken}`,
        },
      });
    } catch (error: any) {
      return new Response(
        `SSO authentication failed: ${error.message}`,
        { status: 500 }
      );
    }
  }),
});

export default http;

