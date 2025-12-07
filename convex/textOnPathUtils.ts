/**
 * Text on Path Utilities
 * 
 * Handles text on path (not directly supported in CSS)
 * Provides workarounds using SVG
 */

/**
 * Generate SVG for text on path
 * CSS doesn't support text on path, so we use SVG
 */
export function generateTextOnPathSVG(
  text: string,
  pathData: string,
  typography: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number | string;
    fill?: { r: number; g: number; b: number; a: number };
  },
  width: number,
  height: number
): string {
  const { r, g, b, a } = typography.fill || { r: 0, g: 0, b: 0, a: 1 };
  const fillColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="text-path" d="${pathData}" />
  </defs>
  <text font-family="${typography.fontFamily}" font-size="${typography.fontSize}" font-weight="${typography.fontWeight}" fill="${fillColor}">
    <textPath href="#text-path" startOffset="0%">
      ${text}
    </textPath>
  </text>
</svg>
  `.trim();
}

/**
 * Check if text node is on a path
 */
export function isTextOnPath(node: any): boolean {
  // Figma text on path is indicated by:
  // - textNode.textStyleRange with path property
  // - or textNode.textPath property
  return !!(node.textPath || node.textStyleRange?.some((range: any) => range.path));
}

/**
 * Extract path data from Figma text on path node
 */
export function extractTextPathData(node: any): string | null {
  if (node.textPath) {
    return node.textPath.data;
  }
  
  if (node.textStyleRange) {
    const pathRange = node.textStyleRange.find((range: any) => range.path);
    if (pathRange?.path?.data) {
      return pathRange.path.data;
    }
  }
  
  return null;
}

