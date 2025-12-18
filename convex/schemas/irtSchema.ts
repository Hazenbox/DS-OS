import { z } from "zod";
import { IRT, SemanticToken, TokenDependencyGraph, TokenDependency } from "../../src/types/ir";

// ============================================================================
// IRT SCHEMA VALIDATION
// ============================================================================

const semanticTokenSchema = z.object({
  name: z.string(),
  semanticName: z.string().optional(),
  value: z.union([z.string(), z.number()]),
  type: z.enum(['color', 'spacing', 'typography', 'sizing', 'radius', 'shadow', 'opacity', 'other']),
  modes: z.record(z.string(), z.union([z.string(), z.number()])),
  sourceVariableId: z.string().optional(),
  sourceStyleId: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  description: z.string().optional(),
  usageReferences: z.array(z.string()).optional(),
});

const tokenDependencySchema = z.object({
  from: z.string(),
  to: z.string(),
  relationship: z.enum(['alias', 'reference', 'derived']),
});

const tokenDependencyGraphSchema = z.object({
  nodes: z.array(semanticTokenSchema),
  edges: z.array(tokenDependencySchema),
});

const irtSchema = z.object({
  tokens: z.array(semanticTokenSchema),
  modeValues: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number()]))),
  tokenGraph: tokenDependencyGraphSchema,
  tokenUsage: z.record(z.string(), z.array(z.string())),
});

/**
 * Validate IRT object against schema
 * @throws {z.ZodError} if validation fails
 */
export function validateIRT(irt: unknown): IRT {
  try {
    return irtSchema.parse(irt) as IRT;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = (error as z.ZodError).issues.map((err: z.ZodIssue) => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      throw new Error(`IRT validation failed: ${errorDetails}`);
    }
    throw error;
  }
}

