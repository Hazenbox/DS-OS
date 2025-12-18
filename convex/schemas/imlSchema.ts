import { z } from "zod";
import { IML, ComponentCategory, ComponentState, ARIAMapping, KeyboardMapping, InteractionRule } from "../../src/types/ir";

// ============================================================================
// IML SCHEMA VALIDATION
// ============================================================================

const componentCategorySchema = z.enum([
  'button',
  'iconButton',
  'input',
  'textarea',
  'combobox',
  'select',
  'dialog',
  'modal',
  'popover',
  'tooltip',
  'menu',
  'dropdown',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'card',
  'badge',
  'avatar',
  'link',
  'text',
  'container',
  'unknown',
]);

const componentStateSchema = z.object({
  name: z.string(),
  trigger: z.string(),
  changes: z.record(z.string(), z.any()),
  ariaAttributes: z.record(z.string(), z.string()).optional(),
});

const ariaMappingSchema = z.object({
  role: z.string().optional(),
  ariaLabel: z.string().optional(),
  ariaLabelledBy: z.string().optional(),
  ariaDescribedBy: z.string().optional(),
  ariaControls: z.string().optional(),
  ariaExpanded: z.boolean().optional(),
  ariaSelected: z.boolean().optional(),
  ariaDisabled: z.boolean().optional(),
  ariaRequired: z.boolean().optional(),
  ariaInvalid: z.boolean().optional(),
  ariaLive: z.enum(['off', 'polite', 'assertive']).optional(),
  ariaAtomic: z.boolean().optional(),
  ariaBusy: z.boolean().optional(),
  ariaModal: z.boolean().optional(),
  ariaMultiline: z.boolean().optional(),
  ariaAutocomplete: z.enum(['none', 'inline', 'list', 'both']).optional(),
  ariaValueMin: z.number().optional(),
  ariaValueMax: z.number().optional(),
  ariaValueNow: z.number().optional(),
  customAttributes: z.record(z.string(), z.string()).optional(),
});

const keyboardMappingSchema = z.object({
  key: z.string(),
  action: z.string(),
  target: z.string().optional(),
  preventDefault: z.boolean().optional(),
  stopPropagation: z.boolean().optional(),
});

const interactionRuleSchema = z.object({
  trigger: z.string(),
  action: z.string(),
  target: z.string().optional(),
  condition: z.string().optional(),
});

const imlSchema = z.object({
  componentCategory: componentCategorySchema,
  states: z.array(componentStateSchema),
  aria: ariaMappingSchema,
  keyboard: z.array(keyboardMappingSchema),
  interactions: z.array(interactionRuleSchema),
  requiredPrimitives: z.array(z.string()).optional(),
});

/**
 * Validate IML object against schema
 * @throws {z.ZodError} if validation fails
 */
export function validateIML(iml: unknown): IML {
  try {
    return imlSchema.parse(iml) as IML;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = (error as z.ZodError).issues.map((err: z.ZodIssue) => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      throw new Error(`IML validation failed: ${errorDetails}`);
    }
    throw error;
  }
}

