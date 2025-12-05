import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * GitHub OAuth Token Exchange
 * 
 * GitHub requires server-side token exchange (unlike Google's implicit flow).
 * This action exchanges the authorization code for an access token,
 * then fetches the user's profile information.
 */

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// Exchange GitHub code for access token and get user info
export const exchangeCodeForUser = action({
  args: {
    code: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    user?: {
      providerId: string;
      email: string;
      name?: string;
      image?: string;
    };
    error?: string;
  }> => {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: args.clientId,
          client_secret: args.clientSecret,
          code: args.code,
          redirect_uri: args.redirectUri,
        }),
      });

      const tokenData: GitHubTokenResponse = await tokenResponse.json();

      if (tokenData.error) {
        return {
          success: false,
          error: tokenData.error_description || tokenData.error,
        };
      }

      if (!tokenData.access_token) {
        return {
          success: false,
          error: 'No access token received from GitHub',
        };
      }

      // Get user profile
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        return {
          success: false,
          error: 'Failed to fetch GitHub user profile',
        };
      }

      const userData: GitHubUser = await userResponse.json();

      // Get user's primary email if not public
      let email = userData.email;
      
      if (!email) {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (emailsResponse.ok) {
          const emails: GitHubEmail[] = await emailsResponse.json();
          const primaryEmail = emails.find(e => e.primary && e.verified);
          email = primaryEmail?.email || emails.find(e => e.verified)?.email || null;
        }
      }

      if (!email) {
        return {
          success: false,
          error: 'Could not retrieve email from GitHub. Please make sure your email is verified.',
        };
      }

      return {
        success: true,
        user: {
          providerId: userData.id.toString(),
          email,
          name: userData.name || userData.login,
          image: userData.avatar_url,
        },
      };
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return {
        success: false,
        error: 'Failed to authenticate with GitHub',
      };
    }
  },
});

