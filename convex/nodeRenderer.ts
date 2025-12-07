/**
 * Node Renderer Utilities
 * 
 * Generates JSX/HTML for IRS nodes, handling special cases like:
 * - Vector graphics (SVG)
 * - Text on path (SVG)
 * - Regular nodes (div/span)
 */

import { IRSNode } from "../src/types/ir";
import { generateSVGFromVector, isVectorGraphic } from "./vectorGraphicsUtils";
import { generateTextOnPathSVG, isTextOnPath, extractTextPathData } from "./textOnPathUtils";

/**
 * Render a single IRS node to JSX string
 */
export function renderNode(
  node: IRSNode,
  componentName: string,
  indent: number = 2,
  tokenMap?: Record<string, string> // Map of token names to CSS variables
): string {
  const indentStr = ' '.repeat(indent);
  
  // Check for vector graphics
  if (isVectorGraphic(node)) {
    return renderVectorGraphic(node, indent, tokenMap);
  }
  
  // Check for text on path
  if (node.type === 'TEXT' && (node as any).textPath) {
    return renderTextOnPath(node, indent, tokenMap);
  }
  
  // Regular node rendering
  return renderRegularNode(node, componentName, indent, tokenMap);
}

/**
 * Render a vector graphic as SVG
 */
function renderVectorGraphic(node: IRSNode, indent: number, tokenMap?: Record<string, string>): string {
  const indentStr = ' '.repeat(indent);
  
  // Sanitize className
  const sanitizeClassName = (name: string): string => {
    return name
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };
  
  // Convert IRS node to format expected by generateSVGFromVector
  const vectorNode = {
    fills: node.fills || [],
    strokes: node.strokes || [],
    effects: node.effects || [],
    vectorPaths: (node as any).vectorPaths || [],
    width: node.boundingBox?.width || 100,
    height: node.boundingBox?.height || 100,
  };
  
  const svg = generateSVGFromVector(vectorNode);
  
  // Return JSX with dangerouslySetInnerHTML for SVG
  return `${indentStr}<div\n` +
    `${indentStr}  className="${sanitizeClassName(node.name)}"\n` +
    `${indentStr}  dangerouslySetInnerHTML={{ __html: ${JSON.stringify(svg)} }}\n` +
    `${indentStr}  style={{\n` +
    `${indentStr}    width: "${node.boundingBox?.width || 100}px",\n` +
    `${indentStr}    height: "${node.boundingBox?.height || 100}px",\n` +
    `${indentStr}  }}\n` +
    `${indentStr}/>\n`;
}

/**
 * Render text on path as SVG
 */
function renderTextOnPath(node: IRSNode, indent: number, tokenMap?: Record<string, string>): string {
  const indentStr = ' '.repeat(indent);
  
  // Sanitize className
  const sanitizeClassName = (name: string): string => {
    return name
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };
  
  const textPathData = extractTextPathData(node as any);
  if (!textPathData) {
    // Fallback to regular text if no path data
    return renderRegularNode(node, '', indent, tokenMap);
  }
  
  const text = (node as any).characters || node.name || '';
  const typography = node.typography || {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 'normal',
    letterSpacing: 0,
  };
  
  const fill = node.fills && node.fills.length > 0 && node.fills[0].type === 'solid'
    ? node.fills[0].color
    : { r: 0, g: 0, b: 0, a: 1 };
  
  const svg = generateTextOnPathSVG(
    text,
    textPathData,
    {
      ...typography,
      fill,
    },
    node.boundingBox?.width || 100,
    node.boundingBox?.height || 100
  );
  
  // Return JSX with dangerouslySetInnerHTML for SVG
  return `${indentStr}<div\n` +
    `${indentStr}  className="${sanitizeClassName(node.name)}"\n` +
    `${indentStr}  dangerouslySetInnerHTML={{ __html: ${JSON.stringify(svg)} }}\n` +
    `${indentStr}  style={{\n` +
    `${indentStr}    width: "${node.boundingBox?.width || 100}px",\n` +
    `${indentStr}    height: "${node.boundingBox?.height || 100}px",\n` +
    `${indentStr}  }}\n` +
    `${indentStr}/>\n`;
}

/**
 * Render a regular node (div, span, etc.)
 */
function renderRegularNode(node: IRSNode, componentName: string, indent: number, tokenMap?: Record<string, string>): string {
  const indentStr = ' '.repeat(indent);
  
  // Determine HTML tag
  let tag = 'div';
  if (node.type === 'TEXT') {
    tag = 'span';
  } else if (node.roleHint?.includes('button')) {
    tag = 'button';
  } else if (node.roleHint?.includes('input')) {
    tag = 'input';
  } else if (node.roleHint?.includes('label')) {
    tag = 'label';
  }
  
  // Build className - sanitize emojis and special characters
  const sanitizeClassName = (name: string): string => {
    return name
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };
  
  let className = sanitizeClassName(node.name);
  if (node.slotName) {
    className += ` ${componentName.toLowerCase()}__${sanitizeClassName(node.slotName)}`;
  }
  
  // Build style object - use token references when available, otherwise use values
  const styles: string[] = [];
  if (node.boundingBox) {
    // Try to find token for width/height
    const widthToken = tokenMap?.['width'] || tokenMap?.['sizing'] || null;
    const heightToken = tokenMap?.['height'] || tokenMap?.['sizing'] || null;
    
    if (node.boundingBox.width) {
      if (widthToken) {
        styles.push(`width: "${widthToken}"`);
      } else {
        styles.push(`width: "${node.boundingBox.width}px"`);
      }
    }
    if (node.boundingBox.height) {
      if (heightToken) {
        styles.push(`height: "${heightToken}"`);
      } else {
        styles.push(`height: "${node.boundingBox.height}px"`);
      }
    }
  }
  if (node.opacity !== undefined && node.opacity !== 1) {
    const opacityToken = tokenMap?.['opacity'] || null;
    if (opacityToken) {
      styles.push(`opacity: "${opacityToken}"`);
    } else {
      styles.push(`opacity: ${node.opacity}`);
    }
  }
  
  // Add fill colors from tokens if available
  if (node.fills && node.fills.length > 0) {
    const firstFill = node.fills[0];
    if (firstFill.type === 'solid' && firstFill.color) {
      const colorToken = tokenMap?.['color'] || tokenMap?.['fill'] || tokenMap?.['background'] || null;
      if (colorToken) {
        styles.push(`backgroundColor: "${colorToken}"`);
      } else {
        const color = `rgba(${Math.round(firstFill.color.r * 255)}, ${Math.round(firstFill.color.g * 255)}, ${Math.round(firstFill.color.b * 255)}, ${firstFill.color.a})`;
        styles.push(`backgroundColor: "${color}"`);
      }
    }
  }
  
  let jsx = `${indentStr}<${tag}\n`;
  if (className) {
    jsx += `${indentStr}  className="${className}"\n`;
  }
  
  if (styles.length > 0) {
    jsx += `${indentStr}  style={{\n`;
    for (const style of styles) {
      jsx += `${indentStr}    ${style},\n`;
    }
    jsx += `${indentStr}  }}\n`;
  }
  
  // Add text content for TEXT nodes - use children prop or slot instead of hardcoded text
  if (node.type === 'TEXT' && (node as any).characters) {
    // For text nodes, use children prop instead of hardcoded text
    jsx += `${indentStr}>\n`;
    jsx += `${indentStr}  {children || "${(node as any).characters}"}\n`;
    jsx += `${indentStr}</${tag}>\n`;
  } else if (node.children && node.children.length > 0) {
    jsx += `${indentStr}>\n`;
    for (const child of node.children) {
      jsx += renderNode(child, componentName, indent + 2, tokenMap);
    }
    jsx += `${indentStr}</${tag}>\n`;
  } else {
    jsx += `${indentStr}/>\n`;
  }
  
  return jsx;
}

/**
 * Render the entire IRS tree to JSX
 */
export function renderIRSTree(
  nodes: IRSNode[],
  componentName: string,
  indent: number = 2,
  tokenMap?: Record<string, string>
): string {
  console.log(`[NODE RENDERER] Rendering ${nodes.length} nodes`);
  let jsx = '';
  for (const node of nodes) {
    console.log(`[NODE RENDERER] Rendering node: ${node.name} (type: ${node.type}, children: ${node.children?.length || 0})`);
    const rendered = renderNode(node, componentName, indent, tokenMap);
    console.log(`[NODE RENDERER] Rendered node (${rendered.length} chars):`, rendered.substring(0, 300));
    jsx += rendered;
    // Note: renderNode already handles children recursively, so we don't need to call renderIRSTree again
  }
  console.log(`[NODE RENDERER] Total rendered JSX length: ${jsx.length}`);
  if (jsx.length === 0) {
    console.warn(`[NODE RENDERER] WARNING: No JSX generated! This means the component will be empty.`);
  }
  return jsx;
}

