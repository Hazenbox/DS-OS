// OAuth Configuration
// These should be set in environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = import.meta.env.VITE_GITHUB_CLIENT_SECRET || '';

// OAuth URLs
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';

// Redirect URI (should match your OAuth app settings)
const getRedirectUri = (provider: 'google' | 'github') => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/auth/callback/${provider}`;
};

export interface OAuthUserInfo {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name?: string;
  image?: string;
}

// Generate a random state for CSRF protection
const generateState = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Open OAuth popup for Google (implicit flow - returns token directly)
export const signInWithGoogle = async (): Promise<OAuthUserInfo> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID.');
  }

  const state = generateState();
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri('google'),
    response_type: 'token',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return openOAuthPopup(url, 'google');
};

// Open OAuth popup for GitHub (code flow - requires backend exchange)
export const signInWithGitHub = async (): Promise<OAuthUserInfo> => {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('GitHub OAuth not configured. Please set VITE_GITHUB_CLIENT_ID.');
  }

  const state = generateState();
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: getRedirectUri('github'),
    scope: 'read:user user:email',
    state,
  });

  const url = `${GITHUB_AUTH_URL}?${params.toString()}`;
  return openGitHubOAuthPopup(url);
};

// Open OAuth popup for Google
const openOAuthPopup = (url: string, provider: string): Promise<OAuthUserInfo> => {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      `${provider}_oauth`,
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'oauth_success') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        resolve(event.data.user as OAuthUserInfo);
      } else if (event.data?.type === 'oauth_error') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        reject(new Error(event.data.error || 'OAuth failed'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        reject(new Error('Authentication cancelled'));
      }
    }, 500);
  });
};

// Open OAuth popup for GitHub (handles code exchange)
const openGitHubOAuthPopup = (url: string): Promise<OAuthUserInfo> => {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'github_oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    // Listen for messages from the popup
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'oauth_github_code') {
        window.removeEventListener('message', handleMessage);
        
        try {
          // Exchange code for user info via Convex action
          const userInfo = await exchangeGitHubCode(event.data.code);
          popup.close();
          resolve(userInfo);
        } catch (err: any) {
          popup.close();
          reject(err);
        }
      } else if (event.data?.type === 'oauth_error') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        reject(new Error(event.data.error || 'OAuth failed'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        reject(new Error('Authentication cancelled'));
      }
    }, 500);
  });
};

// Exchange GitHub code for user info (calls Convex action)
const exchangeGitHubCode = async (code: string): Promise<OAuthUserInfo> => {
  // Import Convex client dynamically to avoid circular dependencies
  const { ConvexHttpClient } = await import('convex/browser');
  const { api } = await import('../../convex/_generated/api');
  
  const convexUrl = import.meta.env.VITE_CONVEX_URL || "http://localhost:3210";
  const client = new ConvexHttpClient(convexUrl);
  
  const result = await client.action(api.github.exchangeCodeForUser, {
    code,
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    redirectUri: getRedirectUri('github'),
  });
  
  if (!result.success || !result.user) {
    throw new Error(result.error || 'Failed to authenticate with GitHub');
  }
  
  return {
    provider: 'github',
    providerId: result.user.providerId,
    email: result.user.email,
    name: result.user.name,
    image: result.user.image,
  };
};

// Parse Google token and get user info
export const getGoogleUserInfo = async (accessToken: string): Promise<OAuthUserInfo> => {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get Google user info');
  }

  const data = await response.json();
  
  return {
    provider: 'google',
    providerId: data.id,
    email: data.email,
    name: data.name,
    image: data.picture,
  };
};

// Check if OAuth is configured
export const isGoogleConfigured = () => Boolean(GOOGLE_CLIENT_ID);
export const isGitHubConfigured = () => Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
