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
  indent: number = 2
): string {
  const indentStr = ' '.repeat(indent);
  
  // Check for vector graphics
  if (isVectorGraphic(node)) {
    return renderVectorGraphic(node, indent);
  }
  
  // Check for text on path
  if (node.type === 'TEXT' && (node as any).textPath) {
    return renderTextOnPath(node, indent);
  }
  
  // Regular node rendering
  return renderRegularNode(node, componentName, indent);
}

/**
 * Render a vector graphic as SVG
 */
function renderVectorGraphic(node: IRSNode, indent: number): string {
  const indentStr = ' '.repeat(indent);
  
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
    `${indentStr}  className="${node.name.toLowerCase().replace(/\s+/g, '-')}"\n` +
    `${indentStr}  dangerouslySetInnerHTML={{ __html: ${JSON.stringify(svg)} }}\n` +
    `${indentStr}  style={{\n` +
    `${indentStr}    width: ${node.boundingBox?.width || 100},\n` +
    `${indentStr}    height: ${node.boundingBox?.height || 100},\n` +
    `${indentStr}  }}\n` +
    `${indentStr}/>\n`;
}

/**
 * Render text on path as SVG
 */
function renderTextOnPath(node: IRSNode, indent: number): string {
  const indentStr = ' '.repeat(indent);
  
  const textPathData = extractTextPathData(node as any);
  if (!textPathData) {
    // Fallback to regular text if no path data
    return renderRegularNode(node, '', indent);
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
    `${indentStr}  className="${node.name.toLowerCase().replace(/\s+/g, '-')}"\n` +
    `${indentStr}  dangerouslySetInnerHTML={{ __html: ${JSON.stringify(svg)} }}\n` +
    `${indentStr}  style={{\n` +
    `${indentStr}    width: ${node.boundingBox?.width || 100},\n` +
    `${indentStr}    height: ${node.boundingBox?.height || 100},\n` +
    `${indentStr}  }}\n` +
    `${indentStr}/>\n`;
}

/**
 * Render a regular node (div, span, etc.)
 */
function renderRegularNode(node: IRSNode, componentName: string, indent: number): string {
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
  
  // Build className
  let className = node.name.toLowerCase().replace(/\s+/g, '-');
  if (node.slotName) {
    className += ` ${componentName.toLowerCase()}__${node.slotName}`;
  }
  
  // Build style object
  const styles: string[] = [];
  if (node.boundingBox) {
    if (node.boundingBox.width) styles.push(`width: ${node.boundingBox.width}px`);
    if (node.boundingBox.height) styles.push(`height: ${node.boundingBox.height}px`);
  }
  if (node.opacity !== undefined && node.opacity !== 1) {
    styles.push(`opacity: ${node.opacity}`);
  }
  
  let jsx = `${indentStr}<${tag}\n`;
  jsx += `${indentStr}  className="${className}"\n`;
  
  if (styles.length > 0) {
    jsx += `${indentStr}  style={{\n`;
    for (const style of styles) {
      jsx += `${indentStr}    ${style},\n`;
    }
    jsx += `${indentStr}  }}\n`;
  }
  
  // Add text content for TEXT nodes
  if (node.type === 'TEXT' && (node as any).characters) {
    jsx += `${indentStr}>\n`;
    jsx += `${indentStr}  ${(node as any).characters}\n`;
    jsx += `${indentStr}</${tag}>\n`;
  } else if (node.children && node.children.length > 0) {
    jsx += `${indentStr}>\n`;
    for (const child of node.children) {
      jsx += renderNode(child, componentName, indent + 2);
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
  indent: number = 2
): string {
  let jsx = '';
  for (const node of nodes) {
    jsx += renderNode(node, componentName, indent);
  }
  return jsx;
}

