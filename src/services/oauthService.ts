// OAuth Configuration
// These should be set in environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

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

// Open OAuth popup
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

// Google OAuth
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

// GitHub OAuth
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
  return openOAuthPopup(url, 'github');
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

// Parse GitHub code and get user info (requires backend)
export const getGitHubUserInfo = async (code: string): Promise<OAuthUserInfo> => {
  // GitHub OAuth requires exchanging the code on the server side
  // For now, we'll throw an error indicating server-side implementation is needed
  throw new Error('GitHub OAuth requires server-side token exchange. See setup instructions.');
};

// Check if OAuth is configured
export const isGoogleConfigured = () => Boolean(GOOGLE_CLIENT_ID);
export const isGitHubConfigured = () => Boolean(GITHUB_CLIENT_ID);

