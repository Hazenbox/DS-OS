import { useEffect, useState, useCallback, useRef } from 'react';
import { useConvex } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';

// ============================================================================
// COMPONENT TOKENS HOOK
// Loads minimal token bundle for a specific component
// ============================================================================

interface ComponentToken {
  name: string;
  value: string;
  cssVar: string;
  type: string;
}

interface ComponentTokensState {
  isLoading: boolean;
  isCompiling: boolean;
  error: string | null;
  tokens: ComponentToken[];
  version: string | null;
}

interface UseComponentTokensResult extends ComponentTokensState {
  compile: () => Promise<void>;
  getTokenValue: (tokenName: string) => string | undefined;
  getCSSVar: (tokenName: string) => string | undefined;
}

/**
 * Hook to manage tokens for a specific component
 * 
 * Usage:
 * ```tsx
 * const { tokens, compile, getCSSVar } = useComponentTokens({
 *   componentId,
 *   projectId,
 *   tenantId,
 *   userId,
 * });
 * 
 * // Get CSS variable for a token
 * const bgColor = getCSSVar('color-primary-500'); // "var(--color-primary-500)"
 * ```
 */
export function useComponentTokens({
  componentId,
  projectId,
  tenantId,
  userId,
}: {
  componentId: Id<"components"> | null | undefined;
  projectId: Id<"projects"> | null | undefined;
  tenantId: Id<"tenants"> | null | undefined;
  userId: Id<"users"> | null | undefined;
}): UseComponentTokensResult {
  const [state, setState] = useState<ComponentTokensState>({
    isLoading: true,
    isCompiling: false,
    error: null,
    tokens: [],
    version: null,
  });

  const convex = useConvex();
  const mountedRef = useRef(true);

  // Compile tokens for this component
  const compile = useCallback(async () => {
    if (!componentId || !projectId || !tenantId || !userId) {
      throw new Error('Missing required IDs for compilation');
    }

    try {
      setState(prev => ({ ...prev, isCompiling: true, error: null }));

      console.log(`[TOKENS] Compiling tokens for component ${componentId}...`);
      const result = await convex.action('tokenCompiler:compileComponentTokens' as any, {
        componentId,
        projectId,
        tenantId,
        userId,
      });

      if (!mountedRef.current) return;

      console.log(`[TOKENS] Component token compilation complete: ${result.tokenCount} tokens`);

      // Convert matched tokens to ComponentToken format
      const tokens: ComponentToken[] = result.matchedTokens.map((t: { name: string; cssVar: string }) => ({
        name: t.name,
        value: '', // Value not returned from compile, would need separate fetch
        cssVar: t.cssVar,
        type: 'unknown',
      }));

      setState(prev => ({
        ...prev,
        isCompiling: false,
        isLoading: false,
        tokens,
        version: `1.0.${Date.now()}`,
      }));

      if (result.unmatchedRefs.length > 0) {
        console.warn(`[TOKENS] Unmatched token references: ${result.unmatchedRefs.join(', ')}`);
      }

      return;
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[TOKENS] Component token compilation failed:', err);
      setState(prev => ({
        ...prev,
        isCompiling: false,
        error: err instanceof Error ? err.message : 'Compilation failed',
      }));
      throw err;
    }
  }, [componentId, projectId, tenantId, userId, convex]);

  // Get raw token value
  const getTokenValue = useCallback(
    (tokenName: string): string | undefined => {
      const token = state.tokens.find((t) => t.name === tokenName);
      return token?.value;
    },
    [state.tokens]
  );

  // Get CSS variable reference
  const getCSSVar = useCallback(
    (tokenName: string): string | undefined => {
      const token = state.tokens.find((t) => t.name === tokenName);
      return token?.cssVar;
    },
    [state.tokens]
  );

  // Auto-compile on mount if we have all IDs
  useEffect(() => {
    mountedRef.current = true;
    
    if (componentId && projectId && tenantId && userId) {
      compile().catch(() => {
        // Error already handled in compile()
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [componentId, projectId, tenantId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    compile,
    getTokenValue,
    getCSSVar,
  };
}

export default useComponentTokens;

