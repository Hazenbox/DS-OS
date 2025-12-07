import React, { useMemo } from 'react';
import { ConvexToken } from '../types';
import { Network, GitBranch } from 'lucide-react';

// ============================================================================
// TOKEN DEPENDENCY GRAPH VISUALIZATION
// ============================================================================

interface TokenDependencyGraphProps {
  tokens: ConvexToken[];
  selectedToken?: string;
  onTokenSelect?: (tokenId: string) => void;
}

/**
 * Visualize token dependencies and relationships
 */
export const TokenDependencyGraph: React.FC<TokenDependencyGraphProps> = ({
  tokens,
  selectedToken,
  onTokenSelect,
}) => {
  // Build dependency graph from token names
  const graph = useMemo(() => {
    const nodes: Array<{ id: string; name: string; type: string; dependencies: string[] }> = [];
    const edges: Array<{ from: string; to: string; type: 'alias' | 'reference' }> = [];
    
    for (const token of tokens) {
      const dependencies: string[] = [];
      
      // Check if token name references other tokens (e.g., "color.primary.500" might reference "color.primary")
      const parts = token.name.split('.');
      for (let i = 1; i < parts.length; i++) {
        const parentName = parts.slice(0, i).join('.');
        const parentToken = tokens.find(t => t.name === parentName);
        if (parentToken) {
          dependencies.push(parentToken._id);
          edges.push({
            from: token._id,
            to: parentToken._id,
            type: 'reference',
          });
        }
      }
      
      // Check for aliases (similar values)
      for (const otherToken of tokens) {
        if (otherToken._id !== token._id && areTokensSimilar(token, otherToken)) {
          if (!edges.find(e => e.from === token._id && e.to === otherToken._id)) {
            edges.push({
              from: token._id,
              to: otherToken._id,
              type: 'alias',
            });
          }
        }
      }
      
      nodes.push({
        id: token._id,
        name: token.name,
        type: token.type,
        dependencies,
      });
    }
    
    return { nodes, edges };
  }, [tokens]);
  
  // Group tokens by type
  const tokensByType = useMemo(() => {
    const groups: Record<string, ConvexToken[]> = {};
    for (const token of tokens) {
      if (!groups[token.type]) {
        groups[token.type] = [];
      }
      groups[token.type].push(token);
    }
    return groups;
  }, [tokens]);
  
  return (
    <div className="space-y-4">
      {/* Graph Overview */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Network size={16} className="text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Dependency Graph
          </h3>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Total Tokens</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-white">
              {tokens.length}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Dependencies</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-white">
              {graph.edges.filter(e => e.type === 'reference').length}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Aliases</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-white">
              {graph.edges.filter(e => e.type === 'alias').length}
            </div>
          </div>
        </div>
      </div>
      
      {/* Token Groups by Type */}
      <div className="space-y-3">
        {Object.entries(tokensByType).map(([type, typeTokens]) => (
          <div key={type} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white capitalize">
                {type} ({typeTokens.length})
              </h4>
            </div>
            
            <div className="space-y-2">
              {typeTokens.slice(0, 10).map(token => {
                const dependencies = graph.edges.filter(e => e.from === token._id);
                const dependents = graph.edges.filter(e => e.to === token._id);
                
                return (
                  <div
                    key={token._id}
                    className={`p-2 rounded border cursor-pointer transition-colors ${
                      selectedToken === token._id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                    onClick={() => onTokenSelect?.(token._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {token.name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {token.value}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {dependencies.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                            <GitBranch size={12} />
                            <span>{dependencies.length}</span>
                          </div>
                        )}
                        {dependents.length > 0 && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            ← {dependents.length}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {dependencies.length > 0 && selectedToken === token._id && (
                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          Dependencies:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {dependencies.map(edge => {
                            const depToken = tokens.find(t => t._id === edge.to);
                            return depToken ? (
                              <span
                                key={edge.to}
                                className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300"
                              >
                                {depToken.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {typeTokens.length > 10 && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                +{typeTokens.length - 10} more
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Check if two tokens are similar (potential aliases)
 */
function areTokensSimilar(token1: ConvexToken, token2: ConvexToken): boolean {
  if (token1.type !== token2.type) return false;
  
  // For colors, compare RGB values
  if (token1.type === 'color') {
    const color1 = parseColor(token1.value);
    const color2 = parseColor(token2.value);
    if (color1 && color2) {
      const distance = colorDistance(color1, color2);
      return distance < 10; // Threshold for color similarity
    }
  }
  
  // For numeric values, check if they're close
  if (token1.type === 'spacing' || token1.type === 'sizing' || token1.type === 'radius') {
    const num1 = parseFloat(token1.value);
    const num2 = parseFloat(token2.value);
    if (!isNaN(num1) && !isNaN(num2)) {
      return Math.abs(num1 - num2) < 1;
    }
  }
  
  return false;
}

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const hexMatch = value.match(/#([0-9a-f]{6})/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1].substring(0, 2), 16),
      g: parseInt(hexMatch[1].substring(2, 4), 16),
      b: parseInt(hexMatch[1].substring(4, 6), 16),
    };
  }
  
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
    };
  }
  
  return null;
}

function colorDistance(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

