import { useEffect, useState, useCallback, useRef } from 'react';
import { useConvex } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';

// ============================================================================
// THEME TOKENS HOOK
// Injects global CSS variables from compiled token bundle
// ============================================================================

interface ThemeTokensState {
  isLoading: boolean;
  isCompiling: boolean;
  error: string | null;
  tokenCount: number;
  version: string | null;
  cssInjected: boolean;
}

interface UseThemeTokensResult extends ThemeTokensState {
  compile: () => Promise<void>;
  getTokenValue: (tokenName: string) => string | undefined;
  tokenMap: Record<string, string>;
}

const STYLE_ELEMENT_ID = 'ds-os-theme-tokens';

/**
 * Hook to manage global theme tokens
 * 
 * Usage:
 * ```tsx
 * const { isLoading, tokenCount, compile, getTokenValue } = useThemeTokens({
 *   projectId,
 *   tenantId,
 *   userId,
 * });
 * 
 * // Get a specific token's CSS variable
 * const primaryColor = getTokenValue('color-primary-500'); // "var(--color-primary-500)"
 * ```
 */
export function useThemeTokens({
  projectId,
  tenantId,
  userId,
  autoInject = true,
}: {
  projectId: Id<"projects"> | null | undefined;
  tenantId: Id<"tenants"> | null | undefined;
  userId: Id<"users"> | null | undefined;
  autoInject?: boolean;
}): UseThemeTokensResult {
  const [state, setState] = useState<ThemeTokensState>({
    isLoading: true,
    isCompiling: false,
    error: null,
    tokenCount: 0,
    version: null,
    cssInjected: false,
  });

  const [tokenMap, setTokenMap] = useState<Record<string, string>>({});
  const convex = useConvex();
  
  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  // Inject CSS into document head
  const injectCSS = useCallback((cssContent: string) => {
    // Remove existing style element if present
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) {
      existing.remove();
    }

    // Create and inject new style element
    const styleElement = document.createElement('style');
    styleElement.id = STYLE_ELEMENT_ID;
    styleElement.textContent = cssContent;
    document.head.appendChild(styleElement);

    console.log('[TOKENS] Injected global theme CSS into document head');
    return true;
  }, []);

  // Load and inject bundle
  const loadBundle = useCallback(async () => {
    if (!projectId || !tenantId || !userId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Use convex.action to call the action dynamically
      const bundle = await convex.action('tokenCompiler:getProjectBundle' as any, { 
        projectId, 
        tenantId, 
        userId 
      });

      if (!mountedRef.current) return;

      if (!bundle) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          tokenCount: 0,
          version: null,
          cssInjected: false,
        }));
        setTokenMap({});
        return;
      }

      // Parse JSON map
      const map = JSON.parse(bundle.jsonContent) as Record<string, string>;
      setTokenMap(map);

      // Inject CSS if autoInject is enabled
      let injected = false;
      if (autoInject && bundle.cssContent) {
        injected = injectCSS(bundle.cssContent);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        tokenCount: bundle.tokenCount,
        version: bundle.version,
        cssInjected: injected,
      }));

      console.log(`[TOKENS] Loaded theme bundle: ${bundle.tokenCount} tokens, version ${bundle.version}`);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[TOKENS] Failed to load theme bundle:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load theme',
      }));
    }
  }, [projectId, tenantId, userId, convex, autoInject, injectCSS]);

  // Compile and reload bundle
  const compile = useCallback(async () => {
    if (!projectId || !tenantId || !userId) {
      throw new Error('Missing required IDs for compilation');
    }

    try {
      setState(prev => ({ ...prev, isCompiling: true, error: null }));

      console.log('[TOKENS] Starting theme compilation...');
      const result = await convex.action('tokenCompiler:compileGlobalTheme' as any, { 
        projectId, 
        tenantId, 
        userId 
      });
      console.log(`[TOKENS] Compilation complete: ${result.tokenCount} tokens, ${result.cssSize} bytes CSS`);

      // Reload the bundle
      await loadBundle();

      if (mountedRef.current) {
        setState(prev => ({ ...prev, isCompiling: false }));
      }
    } catch (err) {
      console.error('[TOKENS] Compilation failed:', err);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isCompiling: false,
          error: err instanceof Error ? err.message : 'Compilation failed',
        }));
      }
      throw err;
    }
  }, [projectId, tenantId, userId, convex, loadBundle]);

  // Get token value from map
  const getTokenValue = useCallback(
    (tokenName: string): string | undefined => {
      return tokenMap[tokenName];
    },
    [tokenMap]
  );

  // Load bundle on mount and when IDs change
  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Optionally remove injected CSS on unmount
      // const existing = document.getElementById(STYLE_ELEMENT_ID);
      // if (existing) existing.remove();
    };
  }, []);

  return {
    ...state,
    compile,
    getTokenValue,
    tokenMap,
  };
}

export default useThemeTokens;

