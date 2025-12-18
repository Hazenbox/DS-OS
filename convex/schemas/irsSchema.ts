import { z } from "zod";
import { IRS, IRSMetadata, IRSNode, VariantMatrix, SlotDefinition, IRSLayoutIntent, IRSCSSHints, IRSState } from "../../src/types/ir";

// ============================================================================
// IRS SCHEMA VALIDATION
// ============================================================================

const irsBoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const irsLayoutSchema = z.object({
  display: z.enum(['flex', 'grid', 'block', 'inline', 'none']),
  flexDirection: z.enum(['row', 'column', 'row-reverse', 'column-reverse']).optional(),
  justifyContent: z.enum(['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly']).optional(),
  alignItems: z.enum(['flex-start', 'flex-end', 'center', 'stretch', 'baseline']).optional(),
  gap: z.number().optional(),
  padding: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }).optional(),
  margin: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }).optional(),
  flexWrap: z.enum(['nowrap', 'wrap', 'wrap-reverse']).optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
});

const irsFillSchema = z.object({
  type: z.enum(['solid', 'gradient', 'image', 'none']),
  color: z.object({
    r: z.number(),
    g: z.number(),
    b: z.number(),
    a: z.number(),
  }).optional(),
  gradientStops: z.array(z.object({
    color: z.object({
      r: z.number(),
      g: z.number(),
      b: z.number(),
      a: z.number(),
    }),
    position: z.number(),
  })).optional(),
  gradientType: z.enum(['linear', 'radial', 'angular', 'diamond']).optional(),
  imageUrl: z.string().optional(),
  blendMode: z.string().optional(),
  opacity: z.number().optional(),
});

const irsStrokeSchema = z.object({
  type: z.enum(['solid', 'gradient', 'none']),
  color: z.object({
    r: z.number(),
    g: z.number(),
    b: z.number(),
    a: z.number(),
  }).optional(),
  width: z.number(),
  position: z.enum(['inside', 'center', 'outside']).optional(),
  align: z.enum(['center', 'inside', 'outside']).optional(),
});

const irsEffectSchema = z.object({
  type: z.enum(['drop-shadow', 'inner-shadow', 'layer-blur', 'background-blur']),
  color: z.object({
    r: z.number(),
    g: z.number(),
    b: z.number(),
    a: z.number(),
  }).optional(),
  offset: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  radius: z.number(),
  spread: z.number().optional(),
  visible: z.boolean().optional(),
});

const irsTypographySchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
  fontWeight: z.union([z.number(), z.string()]),
  lineHeight: z.union([z.number(), z.string()]),
  letterSpacing: z.number(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
});

const irsTextSpanSchema = z.object({
  text: z.string(),
  style: irsTypographySchema,
});

const irsConstraintsSchema = z.object({
  vertical: z.enum(['top', 'center', 'bottom', 'scale', 'min', 'max']),
  horizontal: z.enum(['left', 'center', 'right', 'scale', 'min', 'max']),
});

// Recursive schema for IRSNode (children can contain more IRSNodes)
const irsNodeSchema: z.ZodType<IRSNode> = z.lazy(() => z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  roleHint: z.string().optional(),
  boundingBox: irsBoundingBoxSchema.optional(),
  layout: irsLayoutSchema.optional(),
  fills: z.array(irsFillSchema).optional(),
  strokes: z.array(irsStrokeSchema).optional(),
  effects: z.array(irsEffectSchema).optional(),
  typography: irsTypographySchema.optional(),
  textSpans: z.array(irsTextSpanSchema).optional(),
  constraints: irsConstraintsSchema.optional(),
  opacity: z.number().optional(),
  blendMode: z.string().optional(),
  cornerRadius: z.number().optional(),
  rectangleCornerRadii: z.array(z.number()).optional(),
  children: z.array(irsNodeSchema).optional(),
  slotName: z.string().optional(),
  zIndex: z.number().optional(),
  vectorPaths: z.array(z.object({
    data: z.string(),
    windingRule: z.string().optional(),
  })).optional(),
  textPath: z.object({
    data: z.string(),
  }).optional(),
  characters: z.string().optional(),
}));

const irsMetadataSchema = z.object({
  name: z.string(),
  figmaUrl: z.string(),
  nodeId: z.string(),
  type: z.string(),
  extractedAt: z.number(),
  sourceFileKey: z.string().optional(),
  componentType: z.string().optional(),
});

const variantMatrixSchema = z.object({
  name: z.string(),
  properties: z.record(z.string(), z.string()),
  nodeId: z.string().optional(),
});

const slotDefinitionSchema = z.object({
  name: z.string(),
  nodeId: z.string(),
  type: z.enum(['text', 'icon', 'content', 'action', 'prefix', 'suffix', 'label', 'helperText']),
  required: z.boolean(),
  defaultValue: z.string().optional(),
});

const irsLayoutIntentSchema = z.object({
  horizontal: z.enum(['intrinsic', 'fluid', 'fixed']),
  vertical: z.enum(['intrinsic', 'fluid', 'fixed']),
});

const irsCSSHintsSchema = z.object({
  requiresPseudo: z.boolean(),
  requiresMask: z.boolean(),
  requiresFilterWorkaround: z.boolean(),
  unsupportedBlendMode: z.boolean().optional(),
  strokeMappingStrategy: z.enum(['outline', 'box-shadow', 'pseudo']),
});

const irsStateSchema = z.object({
  figmaVariant: z.string(),
  semanticState: z.enum(['default', 'hover', 'pressed', 'focus', 'disabled', 'custom']),
});

const irsSchema = z.object({
  meta: irsMetadataSchema,
  tree: z.array(irsNodeSchema),
  variants: z.array(variantMatrixSchema),
  slots: z.array(slotDefinitionSchema),
  layoutIntent: irsLayoutIntentSchema,
  visualHints: irsCSSHintsSchema,
  stateMapping: z.array(irsStateSchema).optional(),
});

/**
 * Validate IRS object against schema
 * @throws {z.ZodError} if validation fails
 */
export function validateIRS(irs: unknown): IRS {
  try {
    return irsSchema.parse(irs) as IRS;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = (error as z.ZodError).issues.map((err: z.ZodIssue) => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      throw new Error(`IRS validation failed: ${errorDetails}`);
    }
    throw error;
  }
}

