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
        // Get params from hash (Google implicit flow) or search (GitHub code flow)
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const params = new URLSearchParams(hash || search);
        
        console.log('OAuth callback params:', Object.fromEntries(params.entries()));
        
        // Check for error
        const errorParam = params.get('error');
        if (errorParam) {
          throw new Error(params.get('error_description') || errorParam);
        }

        // Verify state (CSRF protection)
        const state = params.get('state');
        const savedState = sessionStorage.getItem('oauth_state');
        console.log('State check:', { received: state, saved: savedState });
        
        if (state && savedState && state !== savedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }
        sessionStorage.removeItem('oauth_state');

        if (provider === 'google') {
          // Google uses implicit flow, token is in the URL fragment
          const accessToken = params.get('access_token');
          if (!accessToken) {
            throw new Error('No access token received from Google');
          }

          console.log('Got access token, fetching user info...');
          const userInfo = await getGoogleUserInfo(accessToken);
          console.log('Got user info:', userInfo);
          
          // Send user info to parent window (the opener)
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'oauth_success',
              user: userInfo,
            }, window.location.origin);
            
            setStatus('success');
            
            // Auto-close after a short delay
            setTimeout(() => {
              window.close();
            }, 1500);
          } else {
            throw new Error('Parent window was closed. Please try again.');
          }
        } else if (provider === 'github') {
          // GitHub uses authorization code flow
          const code = params.get('code');
          if (!code) {
            throw new Error('No authorization code received from GitHub');
          }

          // Send the code to parent for server-side processing
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'oauth_github_code',
              code,
            }, window.location.origin);
            
            setStatus('success');
            
            setTimeout(() => {
              window.close();
            }, 1500);
          } else {
            throw new Error('Parent window was closed. Please try again.');
          }
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('error');
        
        // Send error to parent window
        if (window.opener && !window.opener.closed) {
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
      <div className="text-center p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-zinc-900 dark:text-white font-medium mb-1">Completing sign in...</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Please wait</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <p className="text-zinc-900 dark:text-white font-medium mb-1">Success!</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">This window will close automatically...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-zinc-900 dark:text-white font-medium mb-2">Authentication Failed</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
};
