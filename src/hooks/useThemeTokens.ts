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
  availableModes: string[];
  currentMode: string;
}

interface UseThemeTokensResult extends ThemeTokensState {
  compile: () => Promise<void>;
  getTokenValue: (tokenName: string) => string | undefined;
  setMode: (mode: string) => void;
  tokenMap: Record<string, string>;
}

const STYLE_ELEMENT_ID = 'ds-os-theme-tokens';

/**
 * Hook to manage global theme tokens with multi-mode support
 * 
 * Usage:
 * ```tsx
 * const { isLoading, tokenCount, compile, getTokenValue, setMode, currentMode } = useThemeTokens({
 *   projectId,
 *   tenantId,
 *   userId,
 *   defaultMode: 'light', // Optional: default mode
 * });
 * 
 * // Get a specific token's CSS variable
 * const primaryColor = getTokenValue('color-primary-500'); // "var(--color-primary-500)"
 * 
 * // Switch modes
 * setMode('dark');
 * ```
 */
export function useThemeTokens({
  projectId,
  tenantId,
  userId,
  autoInject = true,
  defaultMode = 'default',
}: {
  projectId: Id<"projects"> | null | undefined;
  tenantId: Id<"tenants"> | null | undefined;
  userId: Id<"users"> | null | undefined;
  autoInject?: boolean;
  defaultMode?: string;
}): UseThemeTokensResult {
  const [state, setState] = useState<ThemeTokensState>({
    isLoading: true,
    isCompiling: false,
    error: null,
    tokenCount: 0,
    version: null,
    cssInjected: false,
    availableModes: [],
    currentMode: defaultMode,
  });

  const [tokenMap, setTokenMap] = useState<Record<string, string>>({});
  const convex = useConvex();
  
  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  // Apply mode to document element
  const applyMode = useCallback((mode: string) => {
    // Set data-theme attribute for mode-specific CSS selectors
    document.documentElement.setAttribute('data-theme', mode);
    console.log(`[TOKENS] Applied theme mode: ${mode}`);
  }, []);

  // Inject CSS from CDN URL or fallback content
  const injectCSS = useCallback(async (cssUrl?: string, cssContent?: string) => {
    // Remove existing style element if present
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) {
      existing.remove();
    }

    // Prefer CDN URL if available
    if (cssUrl) {
      try {
        // Create link element for CDN (better caching)
        const linkElement = document.createElement('link');
        linkElement.id = STYLE_ELEMENT_ID;
        linkElement.rel = 'stylesheet';
        linkElement.href = cssUrl;
        linkElement.crossOrigin = 'anonymous';
        document.head.appendChild(linkElement);

        console.log('[TOKENS] Injected CSS from CDN:', cssUrl);
        return true;
      } catch (error) {
        console.warn('[TOKENS] Failed to load CSS from CDN, falling back to inline:', error);
        // Fall through to inline CSS
      }
    }

    // Fallback to inline CSS if CDN unavailable or no URL
    if (cssContent) {
      const styleElement = document.createElement('style');
      styleElement.id = STYLE_ELEMENT_ID;
      styleElement.textContent = cssContent;
      document.head.appendChild(styleElement);

      console.log('[TOKENS] Injected global theme CSS inline (fallback)');
      return true;
    }

    return false;
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

      // Load JSON map from CDN or fallback
      let map: Record<string, string> = {};
      if (bundle.jsonUrl) {
        try {
          const response = await fetch(bundle.jsonUrl);
          if (response.ok) {
            map = await response.json();
            console.log('[TOKENS] Loaded JSON map from CDN:', bundle.jsonUrl);
          } else {
            throw new Error('Failed to fetch from CDN');
          }
        } catch (error) {
          console.warn('[TOKENS] Failed to load JSON from CDN, using fallback:', error);
          if (bundle.jsonContent) {
            map = JSON.parse(bundle.jsonContent) as Record<string, string>;
          }
        }
      } else if (bundle.jsonContent) {
        map = JSON.parse(bundle.jsonContent) as Record<string, string>;
      }
      setTokenMap(map);

      // Extract available modes from bundle (if available)
      const modes = bundle.modes || ['default'];
      // Use existing currentMode if valid, otherwise default to first available mode
      const currentMode = (state.currentMode && modes.includes(state.currentMode)) 
        ? state.currentMode 
        : (modes.includes('light') ? 'light' : modes[0]);

      // Inject CSS if autoInject is enabled (prefer CDN URL)
      let injected = false;
      if (autoInject) {
        injected = await injectCSS(bundle.cssUrl, bundle.cssContent);
        // Apply current mode after CSS injection
        if (injected) {
          applyMode(currentMode);
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        tokenCount: bundle.tokenCount,
        version: bundle.version,
        cssInjected: injected,
        availableModes: modes,
        currentMode: currentMode,
      }));

      console.log(`[TOKENS] Loaded theme bundle: ${bundle.tokenCount} tokens, version ${bundle.version}, modes: ${modes.join(', ')}`);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[TOKENS] Failed to load theme bundle:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load theme',
      }));
    }
  }, [projectId, tenantId, userId, convex, autoInject, injectCSS, applyMode]);

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

  // Set theme mode
  const setMode = useCallback((mode: string) => {
    if (!state.availableModes.includes(mode) && mode !== 'default') {
      console.warn(`[TOKENS] Mode "${mode}" not available. Available modes: ${state.availableModes.join(', ')}`);
      return;
    }
    
    setState(prev => ({ ...prev, currentMode: mode }));
    applyMode(mode);
    console.log(`[TOKENS] Switched to mode: ${mode}`);
  }, [state.availableModes, applyMode]);

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
    setMode,
    tokenMap,
  };
}

export default useThemeTokens;

