/**
 * Vector Graphics Utilities
 * 
 * Handles conversion of Figma vector graphics to SVG
 * with minimal differences
 */

/**
 * Convert Figma vector path to SVG path string
 */
export function figmaPathToSVG(path: string): string {
  // Figma uses a different path format than SVG
  // Convert Figma path commands to SVG path commands
  // Figma: M (move), L (line), C (cubic bezier), Q (quadratic bezier), Z (close)
  // SVG: Same commands, but may need coordinate transformation
  
  // For now, return as-is (Figma paths are usually SVG-compatible)
  // May need transformation matrix application
  return path;
}

/**
 * Generate SVG from Figma vector node
 */
export function generateSVGFromVector(
  node: {
    fills?: any[];
    strokes?: any[];
    effects?: any[];
    vectorPaths?: Array<{ data: string; windingRule?: string }>;
    width: number;
    height: number;
  }
): string {
  let svg = `<svg width="${node.width}" height="${node.height}" xmlns="http://www.w3.org/2000/svg">\n`;
  
  // Add defs for gradients, filters, etc.
  svg += `  <defs>\n`;
  
  // Convert fills to SVG gradients if needed
  if (node.fills) {
    for (let i = 0; i < node.fills.length; i++) {
      const fill = node.fills[i];
      if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
        const gradientId = `gradient-${i}`;
        const gradientType = fill.type === 'GRADIENT_LINEAR' ? 'linearGradient' : 'radialGradient';
        
        svg += `    <${gradientType} id="${gradientId}">\n`;
        if (fill.gradientStops) {
          for (const stop of fill.gradientStops) {
            const { r, g, b, a } = stop.color;
            const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
            svg += `      <stop offset="${stop.position * 100}%" stop-color="${rgba}" />\n`;
          }
        }
        svg += `    </${gradientType}>\n`;
      }
    }
  }
  
  svg += `  </defs>\n`;
  
  // Add paths
  if (node.vectorPaths && node.vectorPaths.length > 0) {
    for (const path of node.vectorPaths) {
      svg += `  <path d="${figmaPathToSVG(path.data)}" `;
      
      // Add fill
      if (node.fills && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.color) {
          const { r, g, b, a } = fill.color;
          const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
          svg += `fill="${rgba}" `;
        } else if (fill.type?.includes('GRADIENT')) {
          svg += `fill="url(#gradient-0)" `;
        }
      } else {
        svg += `fill="none" `;
      }
      
      // Add stroke
      if (node.strokes && node.strokes.length > 0) {
        const stroke = node.strokes[0];
        if (stroke.type === 'SOLID' && stroke.color) {
          const { r, g, b, a } = stroke.color;
          const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
          svg += `stroke="${rgba}" stroke-width="${stroke.strokeWeight || 1}" `;
        }
      }
      
      // Add fill rule
      if (path.windingRule === 'EVENODD') {
        svg += `fill-rule="evenodd" `;
      }
      
      svg += `/>\n`;
    }
  }
  
  svg += `</svg>`;
  
  return svg;
}

/**
 * Check if a node is a vector graphic
 */
export function isVectorGraphic(node: { type: string }): boolean {
  return node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'STAR' || node.type === 'POLYGON';
}

