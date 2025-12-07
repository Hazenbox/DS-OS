import { v } from "convex/values";
import { query } from "./_generated/server";
import { getTenantContext } from "./tenantMiddleware";
import { IRS, IRT, IML } from "../src/types/ir";

/**
 * MDX Documentation Generator
 * 
 * Generates comprehensive MDX documentation for components including:
 * - Usage guidelines
 * - Token sheets
 * - Accessibility rules
 * - Code examples
 * - Figma design links
 */

export interface MDXDocumentation {
  componentId: string;
  componentName: string;
  mdx: string;
  tokens: Array<{
    name: string;
    value: string;
    type: string;
    description?: string;
  }>;
}

/**
 * Generate MDX documentation for a component
 */
export function generateMDX(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML,
  figmaUrl?: string
): string {
  let mdx = `# ${componentName}\n\n`;
  
  // Description
  mdx += `${componentName} is a React component generated from Figma design.\n\n`;
  
  if (figmaUrl) {
    mdx += `**Figma Design:** [View in Figma](${figmaUrl})\n\n`;
  }
  
  // Installation
  mdx += `## Installation\n\n`;
  mdx += `\`\`\`bash\n`;
  mdx += `npm install @your-org/design-system\n`;
  mdx += `\`\`\`\n\n`;
  
  // Basic Usage
  mdx += `## Usage\n\n`;
  mdx += `\`\`\`tsx\n`;
  mdx += `import { ${componentName} } from '@your-org/design-system';\n\n`;
  mdx += `function App() {\n`;
  mdx += `  return (\n`;
  mdx += `    <${componentName}>\n`;
  const labelSlot = irs.slots.find(s => s.name === 'label' || s.name === 'labelText');
  if (labelSlot) {
    mdx += `      ${labelSlot.name}="Button Text"\n`;
  } else {
    mdx += `      Button Text\n`;
  }
  mdx += `    </${componentName}>\n`;
  mdx += `  );\n`;
  mdx += `}\n`;
  mdx += `\`\`\`\n\n`;
  
  // Variants
  if (irs.variants.length > 0) {
    mdx += `## Variants\n\n`;
    mdx += `${componentName} supports the following variants:\n\n`;
    
    const variantGroups = new Map<string, typeof irs.variants>();
    for (const variant of irs.variants) {
      const groupKey = Object.keys(variant.properties).sort().join('-');
      if (!variantGroups.has(groupKey)) {
        variantGroups.set(groupKey, []);
      }
      variantGroups.get(groupKey)!.push(variant);
    }
    
    for (const [groupKey, variants] of variantGroups) {
      const firstVariant = variants[0];
      const variantName = Object.values(firstVariant.properties).join(' ').replace(/[^a-zA-Z0-9]/g, ' ');
      
      mdx += `### ${variantName}\n\n`;
      mdx += `\`\`\`tsx\n`;
      mdx += `<${componentName}\n`;
      for (const [key, value] of Object.entries(firstVariant.properties)) {
        mdx += `  ${key}="${value}"\n`;
      }
      mdx += `/>\n`;
      mdx += `\`\`\`\n\n`;
    }
  }
  
  // Props
  mdx += `## Props\n\n`;
  mdx += `| Prop | Type | Default | Description |\n`;
  mdx += `|------|------|---------|-------------|\n`;
  
  const variantProps = new Set<string>();
  for (const variant of irs.variants) {
    for (const key of Object.keys(variant.properties)) {
      variantProps.add(key);
    }
  }
  
  for (const prop of variantProps) {
    const values = new Set<string>();
    for (const variant of irs.variants) {
      if (variant.properties[prop]) {
        values.add(variant.properties[prop]);
      }
    }
    const type = Array.from(values).map(v => `"${v}"`).join(' | ');
    mdx += `| \`${prop}\` | \`${type}\` | - | ${prop} variant |\n`;
  }
  
  // Add slot props
  for (const slot of irs.slots) {
    mdx += `| \`${slot.name}\` | \`React.ReactNode\` | - | ${slot.name} slot content |\n`;
  }
  
  mdx += `\n`;
  
  // Tokens
  if (irt.tokens.length > 0) {
    mdx += `## Design Tokens\n\n`;
    mdx += `This component uses the following design tokens:\n\n`;
    mdx += `| Token | Value | Type |\n`;
    mdx += `|-------|-------|------|\n`;
    
    for (const token of irt.tokens.slice(0, 20)) {
      const value = token.modeValues?.['default'] || token.value || 'N/A';
      mdx += `| \`${token.name}\` | \`${value}\` | ${token.type} |\n`;
    }
    
    mdx += `\n`;
  }
  
  // Accessibility
  mdx += `## Accessibility\n\n`;
  mdx += `${componentName} follows WCAG 2.1 AA guidelines and includes:\n\n`;
  
  if (iml.aria.role) {
    mdx += `- **ARIA Role:** \`${iml.aria.role}\`\n`;
  }
  if (iml.aria.ariaLabel) {
    mdx += `- **ARIA Label:** \`${iml.aria.ariaLabel}\`\n`;
  }
  if (iml.aria.ariaLabelledBy) {
    mdx += `- **ARIA Labelled By:** \`${iml.aria.ariaLabelledBy}\`\n`;
  }
  
  if (iml.interactions.length > 0) {
    mdx += `\n### Keyboard Navigation\n\n`;
    mdx += `| Key | Action |\n`;
    mdx += `|-----|--------|\n`;
    for (const interaction of iml.interactions) {
      if (interaction.keyboard) {
        for (const [key, action] of Object.entries(interaction.keyboard)) {
          mdx += `| \`${key}\` | ${action} |\n`;
        }
      }
    }
    mdx += `\n`;
  }
  
  // States
  if (iml.states.length > 0) {
    mdx += `## States\n\n`;
    mdx += `${componentName} supports the following states:\n\n`;
    for (const state of iml.states) {
      mdx += `- **${state.name}**: ${state.description || 'Default state'}\n`;
    }
    mdx += `\n`;
  }
  
  // Examples
  mdx += `## Examples\n\n`;
  
  // Default example
  mdx += `### Default\n\n`;
  mdx += `\`\`\`tsx\n`;
  mdx += `<${componentName}>\n`;
  if (labelSlot) {
    mdx += `  ${labelSlot.name}="Click me"\n`;
  } else {
    mdx += `  Click me\n`;
  }
  mdx += `</${componentName}>\n`;
  mdx += `\`\`\`\n\n`;
  
  // Disabled example
  if (iml.states.some(s => s.name === 'disabled')) {
    mdx += `### Disabled\n\n`;
    mdx += `\`\`\`tsx\n`;
    mdx += `<${componentName} disabled>\n`;
    if (labelSlot) {
      mdx += `  ${labelSlot.name}="Disabled"\n`;
    } else {
      mdx += `  Disabled\n`;
    }
    mdx += `</${componentName}>\n`;
    mdx += `\`\`\`\n\n`;
  }
  
  // Best Practices
  mdx += `## Best Practices\n\n`;
  mdx += `- Always provide accessible labels for screen readers\n`;
  if (iml.componentCategory === 'button') {
    mdx += `- Use semantic HTML when possible\n`;
    mdx += `- Ensure keyboard navigation works correctly\n`;
  }
  mdx += `- Test with screen readers (VoiceOver, NVDA, JAWS)\n`;
  mdx += `- Verify color contrast meets WCAG AA standards\n`;
  mdx += `\n`;
  
  // Related Components
  mdx += `## Related Components\n\n`;
  mdx += `- Similar components or related design system elements\n`;
  mdx += `\n`;
  
  return mdx;
}

/**
 * Query to get MDX documentation for a component
 */
export const getComponentMDX = query({
  args: {
    componentId: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<MDXDocumentation | null> => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Get component
    const component = await ctx.db.get(args.componentId);
    if (!component) {
      return null;
    }
    
    // Verify component belongs to tenant
    if (component.tenantId !== args.tenantId) {
      throw new Error("Component does not belong to tenant");
    }
    
    // TODO: Get IRS, IRT, IML from component metadata
    // For now, return placeholder
    const irs: IRS = {
      meta: {
        componentName: component.name,
        extractedAt: component._creationTime,
        figmaNodeId: (component as any).figmaNodeId || '',
      },
      tree: [],
      variants: [],
      slots: [],
      layoutIntent: {
        display: 'flex',
        direction: 'row',
      },
      visualHints: {
        requiresPseudo: false,
        requiresMask: false,
        requiresFilterWorkaround: false,
        unsupportedBlendMode: false,
      },
    };
    
    const irt: IRT = {
      tokens: [],
      modeValues: {},
      tokenGraph: {},
    };
    
    const iml: IML = {
      componentCategory: 'generic',
      interactions: [],
      aria: {},
      states: [{ name: 'default', description: 'Default state' }],
    };
    
    const mdx = generateMDX(
      component.name,
      irs,
      irt,
      iml,
      (component as any).figmaUrl
    );
    
    return {
      componentId: component._id,
      componentName: component.name,
      mdx,
      tokens: [],
    };
  },
});

