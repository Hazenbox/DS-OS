import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getGoogleUserInfo } from '../services/oauthService';

interface OAuthCallbackProps {
  provider: 'google' | 'github';
}

export const OAuthCallback: React.FC<OAuthCallbackProps> = ({ provider }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash || window.location.search.substring(1));
        
        // Check for error
        const errorParam = params.get('error');
        if (errorParam) {
          throw new Error(params.get('error_description') || errorParam);
        }

        // Verify state
        const state = params.get('state');
        const savedState = sessionStorage.getItem('oauth_state');
        if (state !== savedState) {
          throw new Error('Invalid state parameter');
        }
        sessionStorage.removeItem('oauth_state');

        if (provider === 'google') {
          // Google uses implicit flow, token is in the URL fragment
          const accessToken = params.get('access_token');
          if (!accessToken) {
            throw new Error('No access token received');
          }

          const userInfo = await getGoogleUserInfo(accessToken);
          
          // Send user info to parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth_success',
              user: userInfo,
            }, window.location.origin);
          }
          
          setStatus('success');
        } else if (provider === 'github') {
          // GitHub uses authorization code flow
          const code = params.get('code');
          if (!code) {
            throw new Error('No authorization code received');
          }

          // For GitHub, we need to exchange the code server-side
          // Send the code to parent for server-side processing
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth_github_code',
              code,
            }, window.location.origin);
          }
          
          setStatus('success');
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('error');
        
        // Send error to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth_error',
            error: err.message,
          }, window.location.origin);
        }
      }
    };

    handleCallback();
  }, [provider]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">Completing authentication...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-4" />
            <p className="text-zinc-900 dark:text-white font-medium mb-2">Success!</p>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">You can close this window.</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-zinc-900 dark:text-white font-medium mb-2">Authentication Failed</p>
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
};

