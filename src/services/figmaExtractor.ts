// Figma Property Extractor - 100% Extraction Implementation
// Based on docs/guides/100_PERCENT_EXTRACTION_IMPLEMENTATION.md

import { Token } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaGradientStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE';
  color?: FigmaColor;
  opacity?: number;
  gradientStops?: FigmaGradientStop[];
  gradientHandlePositions?: { x: number; y: number }[];
  scaleMode?: string;
  visible?: boolean;
}

export interface FigmaStroke {
  type: string;
  color?: FigmaColor;
  opacity?: number;
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  letterSpacing?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  textDecoration?: string;
  textCase?: string;
}

export interface FigmaLayoutProps {
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  layoutWrap?: string;
  layoutGrow?: number;
}

export interface ExtractedProperties {
  // Fills
  fills: FigmaFill[];
  backgroundColor?: string;
  backgroundGradient?: string;
  
  // Strokes
  strokes: FigmaStroke[];
  strokeWeight?: number;
  strokeAlign?: string;
  strokeCap?: string;
  strokeJoin?: string;
  strokeDashes?: number[];
  borderColor?: string;
  borderWidth?: number;
  
  // Effects
  effects: FigmaEffect[];
  boxShadow?: string;
  backdropFilter?: string;
  filter?: string;
  
  // Layout
  layout: FigmaLayoutProps;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  padding?: string;
  flexWrap?: string;
  flexGrow?: number;
  
  // Dimensions
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  
  // Corner Radius
  cornerRadius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  borderRadius?: string;
  
  // Typography
  typography?: FigmaTextStyle;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  color?: string;
  
  // Visual
  opacity?: number;
  blendMode?: string;
  overflow?: string;
  
  // Transform
  rotation?: number;
  
  // Constraints
  constraints?: {
    horizontal: string;
    vertical: string;
  };
  
  // Raw CSS
  css: Record<string, string>;
  
  // Token mappings
  tokenMappings: Array<{
    property: string;
    tokenName: string;
    tokenValue: string;
  }>;
}

export interface FigmaVariant {
  name: string;
  properties: Record<string, string>;
  extractedProps: ExtractedProperties;
}

export interface ExtractedComponent {
  name: string;
  description?: string;
  baseProps: ExtractedProperties;
  variants: FigmaVariant[];
  componentCode: string;
  cssCode: string;
  usedTokens: Token[];
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export function figmaColorToRgba(color: FigmaColor, opacity: number = 1): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a * opacity;
  
  if (a === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// ============================================================================
// FILL EXTRACTION
// ============================================================================

export function extractFills(fills: FigmaFill[]): { backgroundColor?: string; backgroundGradient?: string } {
  const visibleFills = fills.filter(f => f.visible !== false);
  if (visibleFills.length === 0) return {};
  
  const fill = visibleFills[0];
  
  switch (fill.type) {
    case 'SOLID':
      if (fill.color) {
        return { backgroundColor: figmaColorToRgba(fill.color, fill.opacity ?? 1) };
      }
      break;
      
    case 'GRADIENT_LINEAR':
      if (fill.gradientStops && fill.gradientHandlePositions) {
        const stops = fill.gradientStops
          .map(s => `${figmaColorToRgba(s.color)} ${Math.round(s.position * 100)}%`)
          .join(', ');
        
        // Calculate angle from handle positions
        const handles = fill.gradientHandlePositions;
        if (handles.length >= 2) {
          const dx = handles[1].x - handles[0].x;
          const dy = handles[1].y - handles[0].y;
          const angle = Math.round(Math.atan2(dy, dx) * (180 / Math.PI) + 90);
          return { backgroundGradient: `linear-gradient(${angle}deg, ${stops})` };
        }
        return { backgroundGradient: `linear-gradient(180deg, ${stops})` };
      }
      break;
      
    case 'GRADIENT_RADIAL':
      if (fill.gradientStops) {
        const stops = fill.gradientStops
          .map(s => `${figmaColorToRgba(s.color)} ${Math.round(s.position * 100)}%`)
          .join(', ');
        return { backgroundGradient: `radial-gradient(circle, ${stops})` };
      }
      break;
      
    case 'GRADIENT_ANGULAR':
      if (fill.gradientStops) {
        const stops = fill.gradientStops
          .map(s => `${figmaColorToRgba(s.color)} ${Math.round(s.position * 360)}deg`)
          .join(', ');
        return { backgroundGradient: `conic-gradient(${stops})` };
      }
      break;
      
    case 'GRADIENT_DIAMOND':
      if (fill.gradientStops) {
        const stops = fill.gradientStops
          .map(s => `${figmaColorToRgba(s.color)} ${Math.round(s.position * 100)}%`)
          .join(', ');
        return { backgroundGradient: `radial-gradient(ellipse, ${stops})` };
      }
      break;
  }
  
  return {};
}

// ============================================================================
// STROKE EXTRACTION
// ============================================================================

export function extractStrokes(
  strokes: FigmaStroke[],
  strokeWeight?: number,
  strokeAlign?: string,
  strokeDashes?: number[]
): { borderColor?: string; borderWidth?: number; borderStyle?: string } {
  const visibleStrokes = strokes.filter(s => s.color);
  if (visibleStrokes.length === 0 || !strokeWeight) return {};
  
  const stroke = visibleStrokes[0];
  const borderColor = stroke.color ? figmaColorToRgba(stroke.color, stroke.opacity ?? 1) : undefined;
  const borderStyle = strokeDashes && strokeDashes.length > 0 ? 'dashed' : 'solid';
  
  return {
    borderColor,
    borderWidth: strokeWeight,
    borderStyle
  };
}

// ============================================================================
// EFFECT EXTRACTION
// ============================================================================

export function extractEffects(effects: FigmaEffect[]): { boxShadow?: string; backdropFilter?: string; filter?: string } {
  const visibleEffects = effects.filter(e => e.visible !== false);
  if (visibleEffects.length === 0) return {};
  
  const shadows: string[] = [];
  let backdropBlur: string | undefined;
  let layerBlur: string | undefined;
  
  for (const effect of visibleEffects) {
    switch (effect.type) {
      case 'DROP_SHADOW':
        if (effect.color && effect.offset) {
          const color = figmaColorToRgba(effect.color);
          const x = effect.offset.x ?? 0;
          const y = effect.offset.y ?? 0;
          const blur = effect.radius ?? 0;
          const spread = effect.spread ?? 0;
          shadows.push(`${x}px ${y}px ${blur}px ${spread}px ${color}`);
        }
        break;
        
      case 'INNER_SHADOW':
        if (effect.color && effect.offset) {
          const color = figmaColorToRgba(effect.color);
          const x = effect.offset.x ?? 0;
          const y = effect.offset.y ?? 0;
          const blur = effect.radius ?? 0;
          const spread = effect.spread ?? 0;
          shadows.push(`inset ${x}px ${y}px ${blur}px ${spread}px ${color}`);
        }
        break;
        
      case 'LAYER_BLUR':
        if (effect.radius) {
          layerBlur = `blur(${effect.radius}px)`;
        }
        break;
        
      case 'BACKGROUND_BLUR':
        if (effect.radius) {
          backdropBlur = `blur(${effect.radius}px)`;
        }
        break;
    }
  }
  
  return {
    boxShadow: shadows.length > 0 ? shadows.join(', ') : undefined,
    backdropFilter: backdropBlur,
    filter: layerBlur
  };
}

// ============================================================================
// LAYOUT EXTRACTION
// ============================================================================

export function extractLayout(node: any): FigmaLayoutProps & { css: Record<string, string> } {
  const css: Record<string, string> = {};
  const layout: FigmaLayoutProps = {};
  
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    layout.layoutMode = node.layoutMode;
    css.display = 'flex';
    css.flexDirection = node.layoutMode === 'VERTICAL' ? 'column' : 'row';
    
    // Primary axis alignment
    switch (node.primaryAxisAlignItems) {
      case 'MIN': css.justifyContent = 'flex-start'; break;
      case 'CENTER': css.justifyContent = 'center'; break;
      case 'MAX': css.justifyContent = 'flex-end'; break;
      case 'SPACE_BETWEEN': css.justifyContent = 'space-between'; break;
    }
    layout.primaryAxisAlignItems = node.primaryAxisAlignItems;
    
    // Counter axis alignment
    switch (node.counterAxisAlignItems) {
      case 'MIN': css.alignItems = 'flex-start'; break;
      case 'CENTER': css.alignItems = 'center'; break;
      case 'MAX': css.alignItems = 'flex-end'; break;
      case 'STRETCH': css.alignItems = 'stretch'; break;
    }
    layout.counterAxisAlignItems = node.counterAxisAlignItems;
    
    // Padding
    const pt = node.paddingTop ?? 0;
    const pr = node.paddingRight ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft ?? 0;
    
    if (pt === pr && pr === pb && pb === pl) {
      if (pt > 0) css.padding = `${pt}px`;
    } else if (pt === pb && pl === pr) {
      css.padding = `${pt}px ${pr}px`;
    } else {
      css.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    }
    
    layout.paddingTop = pt;
    layout.paddingRight = pr;
    layout.paddingBottom = pb;
    layout.paddingLeft = pl;
    
    // Gap
    if (node.itemSpacing) {
      css.gap = `${node.itemSpacing}px`;
      layout.itemSpacing = node.itemSpacing;
    }
    
    // Wrap
    if (node.layoutWrap === 'WRAP') {
      css.flexWrap = 'wrap';
      layout.layoutWrap = 'WRAP';
    }
  }
  
  return { ...layout, css };
}

// ============================================================================
// TYPOGRAPHY EXTRACTION
// ============================================================================

export function extractTypography(style: any): { typography: FigmaTextStyle; css: Record<string, string> } {
  const css: Record<string, string> = {};
  const typography: FigmaTextStyle = {};
  
  if (style.fontFamily) {
    css.fontFamily = `'${style.fontFamily}', sans-serif`;
    typography.fontFamily = style.fontFamily;
  }
  
  if (style.fontSize) {
    css.fontSize = `${style.fontSize}px`;
    typography.fontSize = style.fontSize;
  }
  
  if (style.fontWeight) {
    css.fontWeight = String(style.fontWeight);
    typography.fontWeight = style.fontWeight;
  }
  
  if (style.lineHeightPx) {
    css.lineHeight = `${style.lineHeightPx}px`;
    typography.lineHeightPx = style.lineHeightPx;
  } else if (style.lineHeightPercent) {
    css.lineHeight = `${style.lineHeightPercent}%`;
    typography.lineHeightPercent = style.lineHeightPercent;
  }
  
  if (style.letterSpacing) {
    css.letterSpacing = `${style.letterSpacing}px`;
    typography.letterSpacing = style.letterSpacing;
  }
  
  switch (style.textAlignHorizontal) {
    case 'LEFT': css.textAlign = 'left'; break;
    case 'CENTER': css.textAlign = 'center'; break;
    case 'RIGHT': css.textAlign = 'right'; break;
    case 'JUSTIFIED': css.textAlign = 'justify'; break;
  }
  typography.textAlignHorizontal = style.textAlignHorizontal;
  
  switch (style.textDecoration) {
    case 'UNDERLINE': css.textDecoration = 'underline'; break;
    case 'STRIKETHROUGH': css.textDecoration = 'line-through'; break;
  }
  typography.textDecoration = style.textDecoration;
  
  switch (style.textCase) {
    case 'UPPER': css.textTransform = 'uppercase'; break;
    case 'LOWER': css.textTransform = 'lowercase'; break;
    case 'TITLE': css.textTransform = 'capitalize'; break;
  }
  typography.textCase = style.textCase;
  
  return { typography, css };
}

// ============================================================================
// CORNER RADIUS EXTRACTION
// ============================================================================

export function extractCornerRadius(node: any): { borderRadius?: string } {
  if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
    return { borderRadius: `${node.cornerRadius}px` };
  }
  
  const tl = node.topLeftRadius ?? 0;
  const tr = node.topRightRadius ?? 0;
  const br = node.bottomRightRadius ?? 0;
  const bl = node.bottomLeftRadius ?? 0;
  
  if (tl === tr && tr === br && br === bl) {
    if (tl > 0) return { borderRadius: `${tl}px` };
    return {};
  }
  
  return { borderRadius: `${tl}px ${tr}px ${br}px ${bl}px` };
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export function extractAllProperties(node: any, tokens: Token[]): ExtractedProperties {
  const css: Record<string, string> = {};
  const tokenMappings: ExtractedProperties['tokenMappings'] = [];
  
  // Extract fills
  const fillResult = node.fills ? extractFills(node.fills) : {};
  if (fillResult.backgroundColor) {
    css.backgroundColor = fillResult.backgroundColor;
    // Try to find matching token
    const matchingToken = findMatchingColorToken(fillResult.backgroundColor, tokens);
    if (matchingToken) {
      css.backgroundColor = `var(--${matchingToken.name})`;
      tokenMappings.push({ property: 'backgroundColor', tokenName: matchingToken.name, tokenValue: matchingToken.value });
    }
  }
  if (fillResult.backgroundGradient) {
    css.background = fillResult.backgroundGradient;
  }
  
  // Extract strokes
  const strokeResult = node.strokes ? extractStrokes(
    node.strokes,
    node.strokeWeight,
    node.strokeAlign,
    node.strokeDashes
  ) : {};
  if (strokeResult.borderColor && strokeResult.borderWidth) {
    css.border = `${strokeResult.borderWidth}px ${strokeResult.borderStyle || 'solid'} ${strokeResult.borderColor}`;
    const matchingToken = findMatchingColorToken(strokeResult.borderColor, tokens);
    if (matchingToken) {
      css.borderColor = `var(--${matchingToken.name})`;
      tokenMappings.push({ property: 'borderColor', tokenName: matchingToken.name, tokenValue: matchingToken.value });
    }
  }
  
  // Extract effects
  const effectResult = node.effects ? extractEffects(node.effects) : {};
  if (effectResult.boxShadow) css.boxShadow = effectResult.boxShadow;
  if (effectResult.backdropFilter) css.backdropFilter = effectResult.backdropFilter;
  if (effectResult.filter) css.filter = effectResult.filter;
  
  // Extract layout
  const layoutResult = extractLayout(node);
  Object.assign(css, layoutResult.css);
  
  // Extract dimensions
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    if (width) css.width = `${Math.round(width)}px`;
    if (height) css.height = `${Math.round(height)}px`;
  }
  
  // Min/Max constraints
  if (node.minWidth) css.minWidth = `${node.minWidth}px`;
  if (node.maxWidth) css.maxWidth = `${node.maxWidth}px`;
  if (node.minHeight) css.minHeight = `${node.minHeight}px`;
  if (node.maxHeight) css.maxHeight = `${node.maxHeight}px`;
  
  // Extract corner radius
  const radiusResult = extractCornerRadius(node);
  if (radiusResult.borderRadius) {
    css.borderRadius = radiusResult.borderRadius;
    // Check for radius token
    const matchingToken = findMatchingToken(radiusResult.borderRadius, tokens, 'radius');
    if (matchingToken) {
      css.borderRadius = `var(--${matchingToken.name})`;
      tokenMappings.push({ property: 'borderRadius', tokenName: matchingToken.name, tokenValue: matchingToken.value });
    }
  }
  
  // Extract typography (for text nodes)
  let typographyResult: ReturnType<typeof extractTypography> | undefined;
  if (node.style) {
    typographyResult = extractTypography(node.style);
    Object.assign(css, typographyResult.css);
    
    // Try to find font size token
    if (typographyResult.css.fontSize) {
      const matchingToken = findMatchingToken(typographyResult.css.fontSize, tokens, 'sizing');
      if (matchingToken) {
        css.fontSize = `var(--${matchingToken.name})`;
        tokenMappings.push({ property: 'fontSize', tokenName: matchingToken.name, tokenValue: matchingToken.value });
      }
    }
  }
  
  // Extract text color
  if (node.type === 'TEXT' && node.fills) {
    const visibleFills = node.fills.filter((f: FigmaFill) => f.visible !== false);
    if (visibleFills.length > 0 && visibleFills[0].color) {
      const textColor = figmaColorToRgba(visibleFills[0].color, visibleFills[0].opacity ?? 1);
      css.color = textColor;
      const matchingToken = findMatchingColorToken(textColor, tokens);
      if (matchingToken) {
        css.color = `var(--${matchingToken.name})`;
        tokenMappings.push({ property: 'color', tokenName: matchingToken.name, tokenValue: matchingToken.value });
      }
    }
  }
  
  // Extract opacity
  if (node.opacity !== undefined && node.opacity < 1) {
    css.opacity = String(node.opacity);
  }
  
  // Extract blend mode
  if (node.blendMode && node.blendMode !== 'PASS_THROUGH') {
    css.mixBlendMode = node.blendMode.toLowerCase().replace('_', '-');
  }
  
  // Extract clipping
  if (node.clipsContent) {
    css.overflow = 'hidden';
  }
  
  // Extract rotation
  if (node.rotation && node.rotation !== 0) {
    css.transform = `rotate(${node.rotation}deg)`;
  }
  
  return {
    fills: node.fills || [],
    strokes: node.strokes || [],
    effects: node.effects || [],
    layout: layoutResult,
    typography: typographyResult?.typography,
    width: node.absoluteBoundingBox?.width,
    height: node.absoluteBoundingBox?.height,
    ...radiusResult,
    ...fillResult,
    ...strokeResult,
    ...effectResult,
    opacity: node.opacity,
    css,
    tokenMappings
  };
}

// ============================================================================
// TOKEN MATCHING UTILITIES
// ============================================================================

function findMatchingColorToken(color: string, tokens: Token[]): Token | undefined {
  const colorTokens = tokens.filter(t => t.type === 'color');
  
  // Try exact match first
  for (const token of colorTokens) {
    if (token.value.toLowerCase() === color.toLowerCase()) {
      return token;
    }
  }
  
  // Try to match by converting formats
  const normalized = normalizeColor(color);
  for (const token of colorTokens) {
    if (normalizeColor(token.value) === normalized) {
      return token;
    }
  }
  
  return undefined;
}

function findMatchingToken(value: string, tokens: Token[], type: string): Token | undefined {
  const filteredTokens = tokens.filter(t => t.type === type);
  
  for (const token of filteredTokens) {
    if (token.value === value || token.value === value.replace('px', '')) {
      return token;
    }
  }
  
  return undefined;
}

function normalizeColor(color: string): string {
  // Convert to lowercase and remove spaces
  return color.toLowerCase().replace(/\s/g, '');
}

// ============================================================================
// COMPONENT CODE GENERATION
// ============================================================================

export function generateComponentCodeFromProps(
  componentName: string,
  baseProps: ExtractedProperties,
  variants: FigmaVariant[]
): { componentCode: string; cssCode: string } {
  const className = componentName.toLowerCase().replace(/\s+/g, '-');
  
  // Generate CSS
  let cssCode = `/* ${componentName} - Generated from Figma */\n\n`;
  
  // Base styles
  cssCode += `.${className} {\n`;
  for (const [prop, value] of Object.entries(baseProps.css)) {
    cssCode += `  ${camelToKebab(prop)}: ${value};\n`;
  }
  cssCode += `}\n`;
  
  // Variant styles
  for (const variant of variants) {
    const variantClass = Object.values(variant.properties).join('-').toLowerCase().replace(/\s+/g, '-');
    cssCode += `\n.${className}--${variantClass} {\n`;
    
    // Only output properties that differ from base
    for (const [prop, value] of Object.entries(variant.extractedProps.css)) {
      if (baseProps.css[prop] !== value) {
        cssCode += `  ${camelToKebab(prop)}: ${value};\n`;
      }
    }
    cssCode += `}\n`;
  }
  
  // Generate React component
  const variantProps = variants.length > 0 
    ? Object.keys(variants[0].properties).map(p => `${p}?: string;`).join('\n  ')
    : '';
  
  const variantClassLogic = variants.length > 0
    ? `const variantClass = [${Object.keys(variants[0].properties).map(p => p).join(', ')}].filter(Boolean).join('-').toLowerCase().replace(/\\s+/g, '-');`
    : '';
  
  const componentCode = `import React from 'react';
import './${className}.css';

interface ${componentName}Props {
  children?: React.ReactNode;
  className?: string;
  ${variantProps}
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  children,
  className = '',
  ${variants.length > 0 ? Object.keys(variants[0].properties).join(', ') : ''}
}) => {
  ${variantClassLogic}
  
  return (
    <div 
      className={\`${className}\${variantClass ? \` ${className}--\${variantClass}\` : ''} \${className}\`.trim()}
    >
      {children}
    </div>
  );
};

export default ${componentName};
`;

  return { componentCode, cssCode };
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// ============================================================================
// FIGMA API HELPERS
// ============================================================================

export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find file key (usually after 'design' or 'file')
    const designIndex = pathParts.indexOf('design');
    const fileIndex = pathParts.indexOf('file');
    const keyIndex = designIndex !== -1 ? designIndex + 1 : (fileIndex !== -1 ? fileIndex + 1 : -1);
    
    if (keyIndex === -1 || keyIndex >= pathParts.length) return null;
    
    const fileKey = pathParts[keyIndex];
    
    // Get node ID from query params
    const nodeId = urlObj.searchParams.get('node-id')?.replace('-', ':') || '';
    
    return { fileKey, nodeId };
  } catch {
    return null;
  }
}

