import { v } from "convex/values";
import { action, query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================================
// FIGMA API TYPES
// ============================================================================

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  blendMode?: string;
}

interface FigmaFill {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "IMAGE";
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientStops?: Array<{ color: FigmaColor; position: number }>;
  gradientTransform?: number[][];
  blendMode?: string;
}

interface FigmaStroke {
  type: "SOLID" | "GRADIENT_LINEAR";
  color?: FigmaColor;
  opacity?: number;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  effects?: FigmaEffect[];
  strokeWeight?: number;
  strokeAlign?: string;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  layoutAlign?: string;
  layoutGrow?: number;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  constraints?: { vertical: string; horizontal: string };
  opacity?: number;
  blendMode?: string;
  characters?: string;
  style?: any;
  componentPropertyDefinitions?: Record<string, any>;
  variantProperties?: Record<string, string>;
}

// ============================================================================
// EXTRACTED PROPERTIES INTERFACE
// ============================================================================

export interface ExtractedProperties {
  name: string;
  type: string;
  dimensions: { width: number; height: number };
  fills: Array<{
    type: string;
    color?: string;
    gradient?: string;
    opacity?: number;
  }>;
  strokes: Array<{
    color: string;
    width: number;
    align?: string;
  }>;
  effects: Array<{
    type: string;
    css: string;
  }>;
  layout: {
    mode: string;
    direction?: string;
    padding: { top: number; right: number; bottom: number; left: number };
    gap: number;
    alignItems?: string;
    justifyContent?: string;
  };
  cornerRadius: number | number[];
  opacity: number;
  typography?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: string;
    textDecoration?: string;
  };
  variants: Array<{
    name: string;
    properties: Record<string, string>;
  }>;
  componentProperties: Record<string, {
    type: string;
    options?: string[];
    defaultValue?: string;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function rgbaToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  
  if (color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  }
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function gradientToCss(fill: FigmaFill): string {
  if (!fill.gradientStops) return '';
  
  const stops = fill.gradientStops
    .map(stop => `${rgbaToHex(stop.color)} ${Math.round(stop.position * 100)}%`)
    .join(', ');
  
  if (fill.type === 'GRADIENT_LINEAR') {
    // Calculate angle from transform matrix if available
    let angle = 180; // Default to top-to-bottom
    if (fill.gradientTransform) {
      const [[a, b]] = fill.gradientTransform;
      angle = Math.round(Math.atan2(b, a) * (180 / Math.PI) + 90);
    }
    return `linear-gradient(${angle}deg, ${stops})`;
  }
  
  if (fill.type === 'GRADIENT_RADIAL') {
    return `radial-gradient(circle, ${stops})`;
  }
  
  if (fill.type === 'GRADIENT_ANGULAR') {
    return `conic-gradient(${stops})`;
  }
  
  return '';
}

function effectToCss(effect: FigmaEffect): string {
  if (!effect.visible) return '';
  
  switch (effect.type) {
    case 'DROP_SHADOW': {
      const x = effect.offset?.x ?? 0;
      const y = effect.offset?.y ?? 0;
      const blur = effect.radius ?? 0;
      const spread = effect.spread ?? 0;
      const color = effect.color ? rgbaToHex(effect.color) : 'rgba(0,0,0,0.25)';
      return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
    }
    case 'INNER_SHADOW': {
      const x = effect.offset?.x ?? 0;
      const y = effect.offset?.y ?? 0;
      const blur = effect.radius ?? 0;
      const spread = effect.spread ?? 0;
      const color = effect.color ? rgbaToHex(effect.color) : 'rgba(0,0,0,0.25)';
      return `inset ${x}px ${y}px ${blur}px ${spread}px ${color}`;
    }
    case 'LAYER_BLUR':
      return `blur(${effect.radius}px)`;
    case 'BACKGROUND_BLUR':
      return `backdrop-blur(${effect.radius}px)`;
    default:
      return '';
  }
}

function extractProperties(node: FigmaNode): ExtractedProperties {
  const props: ExtractedProperties = {
    name: node.name,
    type: node.type,
    dimensions: {
      width: node.absoluteBoundingBox?.width ?? 0,
      height: node.absoluteBoundingBox?.height ?? 0,
    },
    fills: [],
    strokes: [],
    effects: [],
    layout: {
      mode: node.layoutMode || 'NONE',
      direction: node.layoutMode === 'HORIZONTAL' ? 'row' : node.layoutMode === 'VERTICAL' ? 'column' : undefined,
      padding: {
        top: node.paddingTop ?? 0,
        right: node.paddingRight ?? 0,
        bottom: node.paddingBottom ?? 0,
        left: node.paddingLeft ?? 0,
      },
      gap: node.itemSpacing ?? 0,
      alignItems: node.counterAxisAlignItems?.toLowerCase(),
      justifyContent: node.primaryAxisAlignItems?.toLowerCase(),
    },
    cornerRadius: node.rectangleCornerRadii || node.cornerRadius || 0,
    opacity: node.opacity ?? 1,
    variants: [],
    componentProperties: {},
  };

  // Extract fills
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.visible === false) continue;
      
      if (fill.type === 'SOLID' && fill.color) {
        props.fills.push({
          type: 'solid',
          color: rgbaToHex(fill.color),
          opacity: fill.opacity,
        });
      } else if (fill.type.startsWith('GRADIENT_')) {
        props.fills.push({
          type: 'gradient',
          gradient: gradientToCss(fill),
          opacity: fill.opacity,
        });
      }
    }
  }

  // Extract strokes
  if (node.strokes) {
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.color) {
        props.strokes.push({
          color: rgbaToHex(stroke.color),
          width: node.strokeWeight ?? 1,
          align: node.strokeAlign,
        });
      }
    }
  }

  // Extract effects
  if (node.effects) {
    const shadows: string[] = [];
    const filters: string[] = [];
    const backdropFilters: string[] = [];
    
    for (const effect of node.effects) {
      if (!effect.visible) continue;
      
      const css = effectToCss(effect);
      if (!css) continue;
      
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        shadows.push(css);
      } else if (effect.type === 'LAYER_BLUR') {
        filters.push(css);
      } else if (effect.type === 'BACKGROUND_BLUR') {
        backdropFilters.push(css);
      }
    }
    
    if (shadows.length > 0) {
      props.effects.push({ type: 'boxShadow', css: shadows.join(', ') });
    }
    if (filters.length > 0) {
      props.effects.push({ type: 'filter', css: filters.join(' ') });
    }
    if (backdropFilters.length > 0) {
      props.effects.push({ type: 'backdropFilter', css: backdropFilters.join(' ') });
    }
  }

  // Extract typography if text node
  if (node.type === 'TEXT' && node.style) {
    props.typography = {
      fontFamily: node.style.fontFamily,
      fontSize: node.style.fontSize,
      fontWeight: node.style.fontWeight,
      lineHeight: node.style.lineHeightPx,
      letterSpacing: node.style.letterSpacing,
      textAlign: node.style.textAlignHorizontal?.toLowerCase(),
      textDecoration: node.style.textDecoration?.toLowerCase(),
    };
  }

  // Extract component properties
  if (node.componentPropertyDefinitions) {
    for (const [name, def] of Object.entries(node.componentPropertyDefinitions)) {
      const propDef = def as any;
      props.componentProperties[name] = {
        type: propDef.type,
        options: propDef.variantOptions,
        defaultValue: propDef.defaultValue,
      };
    }
  }

  return props;
}

// ============================================================================
// CONVEX ACTIONS
// ============================================================================

// Fetch a node from Figma API
export const fetchFigmaNode = action({
  args: {
    fileKey: v.string(),
    nodeId: v.string(),
    figmaPat: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; data?: ExtractedProperties; error?: string }> => {
    const { fileKey, nodeId, figmaPat } = args;
    
    if (!figmaPat) {
      return { success: false, error: 'Figma Personal Access Token is required' };
    }
    
    try {
      // Fetch from Figma API
      const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
      
      const response = await fetch(url, {
        headers: {
          'X-Figma-Token': figmaPat,
        },
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          return { success: false, error: 'Invalid Figma token or no access to this file' };
        }
        if (response.status === 404) {
          return { success: false, error: 'Node not found. Check the file key and node ID.' };
        }
        return { success: false, error: `Figma API error: ${response.status}` };
      }
      
      const data = await response.json();
      
      // Get the node from response
      const nodeKey = Object.keys(data.nodes)[0];
      const nodeData = data.nodes[nodeKey];
      
      if (!nodeData || !nodeData.document) {
        return { success: false, error: 'Node not found in response' };
      }
      
      const node = nodeData.document as FigmaNode;
      
      // Extract all properties
      const extracted = extractProperties(node);
      
      // If it's a component set, extract variants
      if (node.type === 'COMPONENT_SET' && node.children) {
        extracted.variants = node.children.map(child => ({
          name: child.name,
          properties: child.variantProperties || {},
        }));
      }
      
      return { success: true, data: extracted };
    } catch (error) {
      console.error('Figma API error:', error);
      return { success: false, error: 'Failed to fetch from Figma API' };
    }
  },
});

// Generate React component code from extracted properties
export const generateComponentCode = action({
  args: {
    properties: v.any(),
    componentName: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const props = args.properties as ExtractedProperties;
    const name = args.componentName;
    
    // Generate CSS from properties
    const generateStyles = () => {
      const styles: string[] = [];
      
      // Base styles
      if (props.layout.mode !== 'NONE') {
        styles.push('display: flex');
        styles.push(`flex-direction: ${props.layout.direction}`);
        if (props.layout.gap > 0) {
          styles.push(`gap: ${props.layout.gap}px`);
        }
        if (props.layout.alignItems) {
          styles.push(`align-items: ${props.layout.alignItems}`);
        }
        if (props.layout.justifyContent) {
          styles.push(`justify-content: ${props.layout.justifyContent}`);
        }
      }
      
      // Padding
      const { padding } = props.layout;
      if (padding.top || padding.right || padding.bottom || padding.left) {
        styles.push(`padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`);
      }
      
      // Corner radius
      if (typeof props.cornerRadius === 'number' && props.cornerRadius > 0) {
        styles.push(`border-radius: ${props.cornerRadius}px`);
      } else if (Array.isArray(props.cornerRadius)) {
        styles.push(`border-radius: ${props.cornerRadius.join('px ')}px`);
      }
      
      // Background
      if (props.fills.length > 0) {
        const fill = props.fills[0];
        if (fill.type === 'solid' && fill.color) {
          styles.push(`background-color: ${fill.color}`);
        } else if (fill.type === 'gradient' && fill.gradient) {
          styles.push(`background: ${fill.gradient}`);
        }
      }
      
      // Border
      if (props.strokes.length > 0) {
        const stroke = props.strokes[0];
        styles.push(`border: ${stroke.width}px solid ${stroke.color}`);
      }
      
      // Effects
      for (const effect of props.effects) {
        if (effect.type === 'boxShadow') {
          styles.push(`box-shadow: ${effect.css}`);
        } else if (effect.type === 'filter') {
          styles.push(`filter: ${effect.css}`);
        } else if (effect.type === 'backdropFilter') {
          styles.push(`backdrop-filter: ${effect.css}`);
        }
      }
      
      // Opacity
      if (props.opacity < 1) {
        styles.push(`opacity: ${props.opacity}`);
      }
      
      return styles;
    };

    // Generate variant types
    const variantNames = props.variants.length > 0
      ? [...new Set(props.variants.flatMap(v => Object.keys(v.properties)))]
      : [];
    
    const variantTypes = variantNames.map(name => {
      const values = [...new Set(props.variants.map(v => v.properties[name]).filter(Boolean))];
      return `${name.toLowerCase()}?: ${values.map(v => `'${v.toLowerCase()}'`).join(' | ')}`;
    });

    const baseStyles = generateStyles();
    
    // Generate component code
    const code = `import React from 'react';

interface ${name}Props {
  children?: React.ReactNode;
  ${variantTypes.length > 0 ? variantTypes.join(';\n  ') + ';' : ''}
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * ${name} Component
 * 
 * Auto-generated from Figma with full property extraction.
 * Includes: ${props.fills.length} fills, ${props.strokes.length} strokes, ${props.effects.length} effects
 * Layout: ${props.layout.mode} (${props.layout.direction || 'none'})
 * ${props.variants.length > 0 ? `Variants: ${props.variants.length}` : ''}
 */
export const ${name}: React.FC<${name}Props> = ({
  children,
  ${variantTypes.length > 0 ? variantNames.map(n => `${n.toLowerCase()},`).join('\n  ') : ''}
  className = '',
  style,
  onClick,
  disabled = false,
}) => {
  const baseStyles: React.CSSProperties = {
    ${baseStyles.map(s => {
      const [prop, ...valueParts] = s.split(':');
      const value = valueParts.join(':').trim();
      const camelProp = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      // Handle numeric values
      if (/^\d+px$/.test(value)) {
        return `${camelProp}: ${parseInt(value)}`;
      }
      return `${camelProp}: '${value}'`;
    }).join(',\n    ')},
  };

  ${props.variants.length > 0 ? `
  // Variant styles
  const variantStyles: Record<string, React.CSSProperties> = {
    ${props.variants.slice(0, 5).map(v => {
      const variantKey = Object.values(v.properties).join('-').toLowerCase();
      return `'${variantKey}': {
      // Styles for ${v.name}
    }`;
    }).join(',\n    ')}
  };` : ''}

  return (
    <${props.type === 'TEXT' ? 'span' : 'div'}
      className={\`\${className}\`}
      style={{
        ...baseStyles,
        ...style,
        cursor: onClick ? 'pointer' : undefined,
        opacity: disabled ? 0.5 : undefined,
        pointerEvents: disabled ? 'none' : undefined,
      }}
      onClick={disabled ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children${props.type === 'TEXT' && props.typography ? ` || '${props.name}'` : ''}}
    </${props.type === 'TEXT' ? 'span' : 'div'}>
  );
};

export default ${name};
`;

    return code;
  },
});

// Store Figma PAT securely - scoped to user
export const setFigmaPat = mutation({
  args: { 
    userId: v.string(),
    pat: v.string() 
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => 
        q.eq("userId", args.userId).eq("key", "figma_pat")
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.pat });
    } else {
      await ctx.db.insert("settings", {
        userId: args.userId,
        key: "figma_pat",
        value: args.pat,
      });
    }
    
    return { success: true };
  },
});

// Get Figma PAT status (masked) - scoped to user
export const getFigmaPatStatus = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    if (!userId) {
      return { configured: false, masked: null };
    }
    
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => 
        q.eq("userId", userId).eq("key", "figma_pat")
      )
      .first();
    
    if (!setting || !setting.value) {
      return { configured: false, masked: null };
    }
    
    // Return masked version
    const pat = setting.value;
    const masked = pat.substring(0, 8) + '...' + pat.substring(pat.length - 4);
    
    return { configured: true, masked };
  },
});

// Get raw PAT for API calls - scoped to user
export const getFigmaPat = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    if (!userId) {
      return null;
    }
    
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => 
        q.eq("userId", userId).eq("key", "figma_pat")
      )
      .first();
    
    return setting?.value || null;
  },
});

