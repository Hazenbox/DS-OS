/**
 * Blend Mode Utilities
 * 
 * Handles CSS workarounds for advanced Figma blend modes
 * that don't have direct CSS equivalents
 */

/**
 * Map Figma blend modes to CSS blend modes
 * Some require workarounds using mix-blend-mode or filters
 */
export function blendModeToCSS(blendMode: string): {
  css: string;
  requiresWorkaround: boolean;
  workaround?: string;
} {
  const blendModeMap: Record<string, { css: string; requiresWorkaround: boolean; workaround?: string }> = {
    'NORMAL': { css: 'normal', requiresWorkaround: false },
    'MULTIPLY': { css: 'multiply', requiresWorkaround: false },
    'SCREEN': { css: 'screen', requiresWorkaround: false },
    'OVERLAY': { css: 'overlay', requiresWorkaround: false },
    'DARKEN': { css: 'darken', requiresWorkaround: false },
    'LIGHTEN': { css: 'lighten', requiresWorkaround: false },
    'COLOR_DODGE': { css: 'color-dodge', requiresWorkaround: false },
    'COLOR_BURN': { css: 'color-burn', requiresWorkaround: false },
    'HARD_LIGHT': { css: 'hard-light', requiresWorkaround: false },
    'SOFT_LIGHT': { css: 'soft-light', requiresWorkaround: false },
    'DIFFERENCE': { css: 'difference', requiresWorkaround: false },
    'EXCLUSION': { css: 'exclusion', requiresWorkaround: false },
    'HUE': { css: 'hue', requiresWorkaround: false },
    'SATURATION': { css: 'saturation', requiresWorkaround: false },
    'COLOR': { css: 'color', requiresWorkaround: false },
    'LUMINOSITY': { css: 'luminosity', requiresWorkaround: false },
    
    // Figma-specific blend modes that need workarounds
    'PASS_THROUGH': { 
      css: 'normal', 
      requiresWorkaround: false 
    },
    'LINEAR_BURN': { 
      css: 'color-burn', 
      requiresWorkaround: true,
      workaround: 'filter: brightness(0.8) contrast(1.2);' // Approximation
    },
    'LINEAR_DODGE': { 
      css: 'color-dodge', 
      requiresWorkaround: true,
      workaround: 'filter: brightness(1.2) contrast(0.8);' // Approximation
    },
  };

  return blendModeMap[blendMode] || { 
    css: 'normal', 
    requiresWorkaround: true,
    workaround: `/* Unsupported blend mode: ${blendMode} - using normal as fallback */`
  };
}

/**
 * Generate CSS for blend mode with workarounds
 */
export function generateBlendModeCSS(blendMode: string): string {
  const { css, requiresWorkaround, workaround } = blendModeToCSS(blendMode);
  
  let result = `mix-blend-mode: ${css};\n`;
  
  if (requiresWorkaround && workaround) {
    result += `  ${workaround}\n`;
  }
  
  return result;
}

/**
 * Check if blend mode requires isolation context
 */
export function requiresIsolation(blendMode: string): boolean {
  const modesRequiringIsolation = [
    'MULTIPLY', 'SCREEN', 'OVERLAY', 'DARKEN', 'LIGHTEN',
    'COLOR_DODGE', 'COLOR_BURN', 'HARD_LIGHT', 'SOFT_LIGHT',
    'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY'
  ];
  
  return modesRequiringIsolation.includes(blendMode);
}

