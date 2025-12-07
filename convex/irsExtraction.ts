"use node";

import { IRS, IRSNode, IRSMetadata, VariantMatrix, SlotDefinition, IRSLayoutIntent, IRSCSSHints, IRSState } from "../src/types/ir";

// ============================================================================
// IRS EXTRACTION HELPERS
// ============================================================================

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: any[];
  strokes?: any[];
  effects?: any[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  constraints?: { vertical: string; horizontal: string };
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  opacity?: number;
  blendMode?: string;
  style?: any;
  characters?: string;
  boundVariables?: Record<string, any>;
  componentPropertyDefinitions?: Record<string, any>;
  variantProperties?: Record<string, string>;
}

/**
 * Extract IRS (Structure IR) from a Figma node
 */
export function extractIRS(
  node: FigmaNode,
  figmaUrl: string,
  fileKey: string
): IRS {
  const meta: IRSMetadata = {
    name: node.name,
    figmaUrl,
    nodeId: node.id,
    type: node.type,
    extractedAt: Date.now(),
    sourceFileKey: fileKey,
    componentType: node.type === 'COMPONENT_SET' ? 'component-set' : 
                   node.type === 'COMPONENT' ? 'component' : 'frame',
  };

  const tree = extractNodeTree(node);
  const variants = extractVariantMatrix(node);
  const slots = extractSlots(node);
  const layoutIntent = extractLayoutIntent(node);
  const visualHints = extractCSSHints(node);
  const stateMapping = extractStateMapping(node, variants);

  return {
    meta,
    tree,
    variants,
    slots,
    layoutIntent,
    visualHints,
    stateMapping,
  };
}

/**
 * Recursively extract node tree
 */
function extractNodeTree(node: FigmaNode, parentZIndex: number = 0): IRSNode[] {
  const irsNode: IRSNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    roleHint: inferRoleHint(node),
    boundingBox: node.absoluteBoundingBox ? {
      x: node.absoluteBoundingBox.x,
      y: node.absoluteBoundingBox.y,
      width: node.absoluteBoundingBox.width,
      height: node.absoluteBoundingBox.height,
    } : undefined,
    layout: extractLayout(node),
    fills: extractFills(node.fills || []),
    strokes: extractStrokes(node.strokes || []),
    effects: extractEffects(node.effects || []),
    typography: node.type === 'TEXT' && node.style ? extractTypography(node.style) : undefined,
    constraints: node.constraints ? {
      vertical: node.constraints.vertical.toLowerCase() as any,
      horizontal: node.constraints.horizontal.toLowerCase() as any,
    } : undefined,
    blendMode: node.blendMode || undefined,
    opacity: node.opacity,
    blendMode: node.blendMode,
    cornerRadius: node.cornerRadius,
    rectangleCornerRadii: node.rectangleCornerRadii,
    slotName: inferSlotName(node),
    zIndex: parentZIndex,
  };

  // Recursively process children
  if (node.children && node.children.length > 0) {
    irsNode.children = node.children.flatMap((child, index) => 
      extractNodeTree(child, parentZIndex + index)
    );
  }

  return [irsNode];
}

/**
 * Infer semantic role hint from node name and structure
 */
function inferRoleHint(node: FigmaNode): string | undefined {
  const name = node.name.toLowerCase();
  
  // Button patterns
  if (name.includes('button') || name.includes('btn')) {
    return 'button-root';
  }
  
  // Icon patterns
  if (name.includes('icon')) {
    if (name.includes('left')) return 'icon-left';
    if (name.includes('right')) return 'icon-right';
    return 'icon';
  }
  
  // Label patterns
  if (name.includes('label') || name.includes('text')) {
    return 'label';
  }
  
  // Dialog/Modal patterns
  if (name.includes('dialog') || name.includes('modal') || name.includes('overlay')) {
    return 'dialog-overlay';
  }
  
  // Input patterns
  if (name.includes('input') || name.includes('field')) {
    return 'input-root';
  }
  
  return undefined;
}

/**
 * Extract layout properties
 */
function extractLayout(node: FigmaNode): IRSNode['layout'] | undefined {
  if (!node.layoutMode) return undefined;

  return {
    display: 'flex',
    flexDirection: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    justifyContent: mapAlignment(node.primaryAxisAlignItems, true) as 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly',
    alignItems: mapAlignment(node.counterAxisAlignItems, false) as 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline',
    gap: node.itemSpacing,
    padding: node.paddingLeft !== undefined ? {
      top: node.paddingTop || 0,
      right: node.paddingRight || 0,
      bottom: node.paddingBottom || 0,
      left: node.paddingLeft || 0,
    } : undefined,
    flexWrap: undefined, // Figma doesn't expose this directly
  };
}

function mapAlignment(alignment?: string, isJustifyContent = false): 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch' | 'baseline' {
  if (isJustifyContent) {
    const map: Record<string, 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'> = {
      'MIN': 'flex-start',
      'CENTER': 'center',
      'MAX': 'flex-end',
      'SPACE_BETWEEN': 'space-between',
      'SPACE_AROUND': 'space-around',
    };
    return map[alignment || 'MIN'] || 'flex-start';
  } else {
    // For alignItems, only return valid values
    const map: Record<string, 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'> = {
      'MIN': 'flex-start',
      'CENTER': 'center',
      'MAX': 'flex-end',
      'STRETCH': 'stretch',
    };
    return map[alignment || 'MIN'] || 'flex-start';
  }
}

/**
 * Extract fills
 */
function extractFills(fills: any[]): IRSNode['fills'] {
  if (!fills || fills.length === 0) return undefined;
  
  return fills.map(fill => {
    if (fill.type === 'SOLID') {
      return {
        type: 'solid',
        color: {
          r: fill.color.r,
          g: fill.color.g,
          b: fill.color.b,
          a: fill.opacity ?? fill.color.a ?? 1,
        },
        opacity: fill.opacity ?? fill.color.a ?? 1,
      };
    }
    
    if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_ANGULAR' || fill.type === 'GRADIENT_DIAMOND') {
      const gradientFill: any = {
        type: 'gradient',
        gradientType: fill.type.replace('GRADIENT_', '').toLowerCase() as any,
        gradientStops: fill.gradientStops?.map((stop: any) => ({
          color: {
            r: stop.color.r,
            g: stop.color.g,
            b: stop.color.b,
            a: stop.color.a ?? 1,
          },
          position: stop.position,
        })),
        opacity: fill.opacity ?? 1,
      };
      
      // Extract gradient transform for complex gradients
      if (fill.gradientTransform) {
        gradientFill.gradientTransform = fill.gradientTransform;
      }
      
      // Handle nested gradients (if fill has a parent gradient)
      if ((fill as any).parentGradient) {
        gradientFill.parentGradient = (fill as any).parentGradient;
      }
      
      return gradientFill;
    }
    
    if (fill.type === 'IMAGE') {
      const imageFill: any = {
        type: 'image',
        imageUrl: fill.imageRef || fill.imageHash,
        opacity: fill.opacity ?? 1,
      };
      
      // Extract image transform for image fills with transforms
      if ((fill as any).imageTransform) {
        imageFill.imageTransform = (fill as any).imageTransform;
      }
      
      // Extract image scaling/fitting
      if ((fill as any).scaleMode) {
        imageFill.scaleMode = (fill as any).scaleMode; // FILL, FIT, TILE, STRETCH
      }
      
      // Extract image crop if available
      if ((fill as any).imageCrop) {
        imageFill.imageCrop = (fill as any).imageCrop;
      }
      
      return imageFill;
    }
    
    return { type: 'none' };
  });
}

/**
 * Extract strokes
 */
function extractStrokes(strokes: any[]): IRSNode['strokes'] {
  if (!strokes || strokes.length === 0) return undefined;
  
  return strokes.map(stroke => {
    if (stroke.type === 'SOLID') {
      return {
        type: 'solid',
        color: {
          r: stroke.color.r,
          g: stroke.color.g,
          b: stroke.color.b,
          a: stroke.opacity ?? stroke.color.a ?? 1,
        },
        width: stroke.strokeWeight || 1,
        position: stroke.strokeAlign?.toLowerCase() as any,
      };
    }
    
    return {
      type: 'none',
      width: stroke.strokeWeight || 1,
    };
  });
}

/**
 * Extract effects (shadows, blurs)
 */
function extractEffects(effects: any[]): IRSNode['effects'] {
  if (!effects || effects.length === 0) return undefined;
  
  return effects.map(effect => {
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      return {
        type: effect.type === 'DROP_SHADOW' ? 'drop-shadow' : 'inner-shadow',
        color: {
          r: effect.color.r,
          g: effect.color.g,
          b: effect.color.b,
          a: effect.color.a ?? 1,
        },
        offset: {
          x: effect.offset?.x || 0,
          y: effect.offset?.y || 0,
        },
        radius: effect.radius || 0,
        spread: effect.spread || 0,
        visible: effect.visible !== false,
      };
    }
    
    if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
      return {
        type: effect.type === 'LAYER_BLUR' ? 'layer-blur' : 'background-blur',
        radius: effect.radius || 0,
        visible: effect.visible !== false,
      };
    }
    
    return {
      type: 'drop-shadow',
      radius: 0,
      visible: false,
    };
  });
}

/**
 * Extract typography
 */
function extractTypography(style: any): IRSNode['typography'] {
  // Convert letterSpacing to number (in pixels)
  let letterSpacingNum = 0;
  if (style.letterSpacing) {
    letterSpacingNum = typeof style.letterSpacing === 'number' ? style.letterSpacing : parseFloat(String(style.letterSpacing).replace('px', '')) || 0;
  }
  
  return {
    fontFamily: style.fontFamily || 'Inter',
    fontSize: style.fontSize || 16,
    fontWeight: style.fontWeight || 400,
    lineHeight: style.lineHeightPx ? `${style.lineHeightPx}px` : style.lineHeightPercentFontSize ? `${style.lineHeightPercentFontSize}%` : 'normal',
    letterSpacing: letterSpacingNum,
    textAlign: style.textAlignHorizontal?.toLowerCase() as any,
    textDecoration: style.textDecoration ? style.textDecoration.toLowerCase() as any : 'none',
    textTransform: style.textCase?.toLowerCase() as any,
  };
}

/**
 * Extract variant matrix
 */
function extractVariantMatrix(node: FigmaNode): VariantMatrix[] {
  const variants: VariantMatrix[] = [];
  
  if (node.type === 'COMPONENT_SET' && node.children) {
    for (const child of node.children) {
      if (child.variantProperties) {
        variants.push({
          name: child.name,
          properties: child.variantProperties,
          nodeId: child.id,
        });
      }
    }
  } else if (node.variantProperties) {
    // Single component with variant properties
    variants.push({
      name: node.name,
      properties: node.variantProperties,
      nodeId: node.id,
    });
  }
  
  return variants;
}

/**
 * Extract slots (named insertion points)
 */
function extractSlots(node: FigmaNode): SlotDefinition[] {
  const slots: SlotDefinition[] = [];
  const slotNames = ['label', 'icon', 'content', 'action', 'prefix', 'suffix', 'helperText', 'errorText'];
  const seenSlotNames = new Set<string>();
  
  function findSlots(n: FigmaNode, parentName: string = '') {
    const name = n.name.toLowerCase();
    
    for (const slotName of slotNames) {
      if (name.includes(slotName)) {
        // Make slot name unique if we've seen it before
        let uniqueSlotName = slotName;
        let counter = 1;
        while (seenSlotNames.has(uniqueSlotName)) {
          // Try to extract position from node name (left, right, top, bottom, start, end)
          const positionMatch = name.match(/(left|right|top|bottom|start|end|before|after)/);
          if (positionMatch && counter === 1) {
            uniqueSlotName = `${slotName}${positionMatch[1].charAt(0).toUpperCase() + positionMatch[1].slice(1)}`;
          } else {
            uniqueSlotName = `${slotName}${counter}`;
          }
          counter++;
        }
        
        seenSlotNames.add(uniqueSlotName);
        slots.push({
          name: uniqueSlotName,
          nodeId: n.id,
          type: slotName.includes('icon') ? 'icon' : 
                slotName.includes('text') ? 'text' : 
                slotName.includes('action') ? 'action' : 'content',
          required: name.includes('required') || name.includes('*'),
        });
        // Break after first match to avoid adding same node multiple times
        break;
      }
    }
    
    if (n.children) {
      n.children.forEach(child => findSlots(child, name));
    }
  }
  
  findSlots(node);
  
  return slots;
}

/**
 * Infer slot name from node
 */
function inferSlotName(node: FigmaNode): string | undefined {
  const name = node.name.toLowerCase();
  const slotNames = ['label', 'icon', 'content', 'action', 'prefix', 'suffix', 'helperText', 'errorText'];
  
  for (const slotName of slotNames) {
    if (name.includes(slotName)) {
      return slotName;
    }
  }
  
  return undefined;
}

/**
 * Extract layout intent (HUG/FILL/FIXED mapping)
 */
function extractLayoutIntent(node: FigmaNode): IRSLayoutIntent {
  return {
    horizontal: node.primaryAxisSizingMode === 'FIXED' ? 'fixed' :
                node.primaryAxisSizingMode === 'FILL' ? 'fluid' : 'intrinsic',
    vertical: node.counterAxisSizingMode === 'FIXED' ? 'fixed' :
              node.counterAxisSizingMode === 'FILL' ? 'fluid' : 'intrinsic',
  };
}

/**
 * Extract CSS hints (workarounds for unsupported features)
 */
function extractCSSHints(node: FigmaNode): IRSCSSHints {
  const hasGradient = !!(node.fills?.some(f => f.type?.includes('GRADIENT')));
  const hasBlendMode = !!(node.blendMode && node.blendMode !== 'NORMAL');
  const hasComplexStroke = !!(node.strokes?.some(s => s.strokeAlign === 'INSIDE' || s.strokeAlign === 'CENTER'));
  
  return {
    requiresPseudo: hasComplexStroke || false,
    requiresMask: (hasGradient && node.type === 'TEXT') || false,
    requiresFilterWorkaround: hasBlendMode || false,
    unsupportedBlendMode: hasBlendMode || undefined,
    strokeMappingStrategy: hasComplexStroke ? 'pseudo' : 'outline',
  };
}

/**
 * Extract state mapping (variant → semantic state)
 */
function extractStateMapping(node: FigmaNode, variants: VariantMatrix[]): IRSState[] {
  const states: IRSState[] = [];
  
  for (const variant of variants) {
    const variantName = variant.name.toLowerCase();
    let semanticState: IRSState['semanticState'] = 'custom';
    
    if (variantName.includes('default') || variantName.includes('normal')) {
      semanticState = 'default';
    } else if (variantName.includes('hover')) {
      semanticState = 'hover';
    } else if (variantName.includes('pressed') || variantName.includes('active')) {
      semanticState = 'pressed';
    } else if (variantName.includes('focus') || variantName.includes('focused')) {
      semanticState = 'focus';
    } else if (variantName.includes('disabled') || variantName.includes('disable')) {
      semanticState = 'disabled';
    }
    
    states.push({
      figmaVariant: variant.name,
      semanticState,
    });
  }
  
  return states;
}

