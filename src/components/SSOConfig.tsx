/**
 * SSO Configuration Component
 * 
 * Allows tenant admins to configure OIDC SSO for their organization.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { 
  Shield, 
  Check, 
  X, 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Settings as SettingsIcon,
  Users,
  Key
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

interface SSOConfigProps {
  tenantId: string;
  userId: string;
}

export const SSOConfig: React.FC<SSOConfigProps> = ({ tenantId, userId }) => {
  // Form state
  const [providerName, setProviderName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [issuer, setIssuer] = useState('');
  const [authorizationEndpoint, setAuthorizationEndpoint] = useState('');
  const [tokenEndpoint, setTokenEndpoint] = useState('');
  const [userInfoEndpoint, setUserInfoEndpoint] = useState('');
  const [jwksUri, setJwksUri] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [allowProvisioning, setAllowProvisioning] = useState(true);
  const [defaultRole, setDefaultRole] = useState<'viewer' | 'designer' | 'developer' | 'admin' | 'owner'>('viewer');
  const [enabled, setEnabled] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; details?: any } | null>(null);
  const [saved, setSaved] = useState(false);
  const [showSCIMToken, setShowSCIMToken] = useState(false);

  // Load existing config
  const ssoConfig = useQuery(
    api.sso.config.get,
    tenantId && userId ? { tenantId: tenantId as any, userId: userId as any } : "skip"
  );

  const setOidcConfig = useMutation(api.sso.config.setOidcConfig);
  const updateConfig = useMutation(api.sso.config.update);
  const testConnection = useMutation(api.sso.config.testConnection);
  const generateSCIMToken = useMutation(api.sso.config.generateSCIMToken);

  // Populate form when config loads
  useEffect(() => {
    if (ssoConfig) {
      setProviderName(ssoConfig.providerName || '');
      setClientId(ssoConfig.clientId || '');
      setIssuer(ssoConfig.issuer || '');
      setAuthorizationEndpoint(ssoConfig.authorizationEndpoint || '');
      setTokenEndpoint(ssoConfig.tokenEndpoint || '');
      setUserInfoEndpoint(ssoConfig.userInfoEndpoint || '');
      setJwksUri(ssoConfig.jwksUri || '');
      setRedirectUri(ssoConfig.redirectUri || '');
      setAllowProvisioning(ssoConfig.allowProvisioning ?? true);
      setDefaultRole(ssoConfig.defaultRole || 'viewer');
      setEnabled(ssoConfig.enabled || false);
    } else {
      // Set default redirect URI
      setRedirectUri(`${window.location.origin}/auth/sso/callback`);
    }
  }, [ssoConfig]);

  const handleSave = async () => {
    if (!tenantId || !userId) return;

    setIsSaving(true);
    setSaved(false);
    setTestResult(null);

    try {
      await setOidcConfig({
        tenantId: tenantId as any,
        userId: userId as any,
        providerName,
        clientId,
        clientSecret: clientSecret || (ssoConfig ? 'KEEP_EXISTING' : ''),
        issuer,
        authorizationEndpoint,
        tokenEndpoint,
        userInfoEndpoint,
        jwksUri: jwksUri || undefined,
        redirectUri,
        allowProvisioning,
        defaultRole,
        enabled,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Failed to save SSO configuration',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId || !userId) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection({
        tenantId: tenantId as any,
        userId: userId as any,
      });

      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Failed to test connection',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (newEnabled: boolean) => {
    if (!tenantId || !userId) return;

    setIsSaving(true);
    try {
      await updateConfig({
        tenantId: tenantId as any,
        userId: userId as any,
        enabled: newEnabled,
      });
      setEnabled(newEnabled);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Failed to update configuration',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <Shield size={20} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Single Sign-On (SSO)</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure OIDC SSO for your organization</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${enabled ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <button
            onClick={() => handleToggleEnabled(!enabled)}
            disabled={isSaving || !ssoConfig}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-700'
            } ${isSaving || !ssoConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`p-4 rounded-lg border ${
          testResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-3">
            {testResult.success ? (
              <Check size={20} className="text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                testResult.success
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}>
                {testResult.message || (testResult.success ? 'Connection test successful' : 'Connection test failed')}
              </p>
              {testResult.details && (
                <pre className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Provider Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Provider Name
          </label>
          <input
            type="text"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g., Okta, Azure AD, Google Workspace"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Client ID */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your OIDC client ID"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Client Secret */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Client Secret
          </label>
          <div className="relative">
            <input
              type={showClientSecret ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={ssoConfig ? "Leave empty to keep existing" : "Your OIDC client secret"}
              className="w-full h-8 px-3 pr-10 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={() => setShowClientSecret(!showClientSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {showClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Issuer URL */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Issuer URL
          </label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="https://your-tenant.okta.com"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Authorization Endpoint */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Authorization Endpoint
          </label>
          <input
            type="text"
            value={authorizationEndpoint}
            onChange={(e) => setAuthorizationEndpoint(e.target.value)}
            placeholder="https://your-tenant.okta.com/oauth2/v1/authorize"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Token Endpoint */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Token Endpoint
          </label>
          <input
            type="text"
            value={tokenEndpoint}
            onChange={(e) => setTokenEndpoint(e.target.value)}
            placeholder="https://your-tenant.okta.com/oauth2/v1/token"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* UserInfo Endpoint */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            UserInfo Endpoint
          </label>
          <input
            type="text"
            value={userInfoEndpoint}
            onChange={(e) => setUserInfoEndpoint(e.target.value)}
            placeholder="https://your-tenant.okta.com/oauth2/v1/userinfo"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Redirect URI */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
            Redirect URI
          </label>
          <input
            type="text"
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            placeholder="https://your-app.com/auth/sso/callback"
            className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Add this URL to your OIDC provider's allowed redirect URIs
          </p>
        </div>

        {/* Provisioning Settings */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-zinc-500" />
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white">User Provisioning</h4>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-zinc-900 dark:text-white">
                Just-In-Time (JIT) Provisioning
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Automatically create users on first SSO login
              </p>
            </div>
            <button
              onClick={() => setAllowProvisioning(!allowProvisioning)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                allowProvisioning ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  allowProvisioning ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {allowProvisioning && (
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                Default Role for New Users
              </label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as any)}
                className="w-full h-8 px-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="viewer">Viewer</option>
                <option value="designer">Designer</option>
                <option value="developer">Developer</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* SCIM Configuration */}
      {ssoConfig && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-zinc-500" />
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white">SCIM Provisioning</h4>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                SCIM Endpoint URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/scim/v2/Users`}
                  className="flex-1 h-8 px-3 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/scim/v2/Users`);
                  }}
                  className="h-8 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                SCIM Authentication Token
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Generate a secure token for SCIM authentication. Keep this token secret.
              </p>
              <div className="relative flex items-center gap-2">
                <input
                  type={showSCIMToken ? "text" : "password"}
                  readOnly
                  value={ssoConfig.scimAuthTokenEncrypted || "Not generated"}
                  className="flex-1 h-8 px-3 pr-10 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                />
                {ssoConfig.scimAuthTokenEncrypted && (
                  <button
                    type="button"
                    onClick={() => setShowSCIMToken(!showSCIMToken)}
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {showSCIMToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      const result = await generateSCIMToken({
                        tenantId: tenantId as any,
                        userId: userId as any,
                      });
                      setTestResult({
                        success: true,
                        message: 'SCIM token generated successfully',
                        details: { token: result.token, scimUrl: result.scimUrl },
                      });
                      // Refresh config to show new token
                      setTimeout(() => window.location.reload(), 1000);
                    } catch (error: any) {
                      setTestResult({
                        success: false,
                        message: error.message || 'Failed to generate SCIM token',
                      });
                    }
                  }}
                  className="h-8 px-3 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 px-4 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check size={16} />
              Saved
            </>
          ) : (
            <>
              <SettingsIcon size={16} />
              Save Configuration
            </>
          )}
        </button>
        <button
          onClick={handleTest}
          disabled={isTesting || !ssoConfig}
          className="h-8 px-4 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isTesting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <ExternalLink size={16} />
              Test Connection
            </>
          )}
        </button>
      </div>
    </div>
  );
};

