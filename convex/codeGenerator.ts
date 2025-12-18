"use node";

import { IRS, IRT, IML } from "../src/types/ir";
import { gradientToCSS, handleNestedGradient } from "./gradientUtils";
import { generateBlendModeCSS, requiresIsolation } from "./blendModeUtils";
import { renderIRSTree } from "./nodeRenderer";
import { normalizeTokenName } from "./tokenCompiler";

// ============================================================================
// CODE GENERATOR - Deterministic Template Engine
// ============================================================================

interface GeneratedCode {
  component: string;
  types: string;
  styles: string;
  storybook?: string;
  test?: string;
}

/**
 * Generate production-ready React component code from IR layers
 */
export function generateComponentCode(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML
): GeneratedCode {
  // Generate TypeScript types
  const types = generateTypes(componentName, irs, iml);
  
  // Generate component code
  const component = generateComponent(componentName, irs, irt, iml);
  
  // Generate styles
  const styles = generateStyles(componentName, irs, irt, iml);
  
  // Generate Storybook story
  const storybook = generateStorybook(componentName, irs, iml);
  
  return {
    component,
    types,
    styles,
    storybook,
  };
}

/**
 * Generate TypeScript types from variants and slots
 */
function generateTypes(componentName: string, irs: IRS, iml: IML): string {
  const typeName = `${componentName}Props`;
  const interfaceName = `${componentName}Props`;
  
  // Extract variant properties
  const variantProps: Record<string, string[]> = {};
  for (const variant of irs.variants) {
    for (const [key, value] of Object.entries(variant.properties)) {
      if (!variantProps[key]) {
        variantProps[key] = [];
      }
      if (!variantProps[key].includes(value)) {
        variantProps[key].push(value);
      }
    }
  }
  
  // Build props interface
  let props = `export interface ${interfaceName} {\n`;
  
  // Add variant props
  for (const [propName, values] of Object.entries(variantProps)) {
    const typeName = propName.charAt(0).toUpperCase() + propName.slice(1);
    const unionType = values.map(v => `"${v}"`).join(' | ');
    props += `  ${propName}?: ${unionType};\n`;
  }
  
  // Add slot props
  for (const slot of irs.slots) {
    if (slot.type === 'text' || slot.type === 'content') {
      props += `  ${slot.name}?: React.ReactNode;\n`;
    } else if (slot.type === 'icon') {
      props += `  ${slot.name}?: React.ReactNode;\n`;
    }
  }
  
  // Add token override props
  props += `  tokenOverrides?: Record<string, string | number>; // Runtime token overrides\n`;
  
  // Add common props
  props += `  className?: string;\n`;
  props += `  children?: React.ReactNode;\n`;
  
  // Add ARIA props if needed
  if (iml.aria.ariaLabel) {
    props += `  "aria-label"?: string;\n`;
  }
  if (iml.aria.ariaLabelledBy) {
    props += `  "aria-labelledby"?: string;\n`;
  }
  if (iml.aria.ariaDescribedBy) {
    props += `  "aria-describedby"?: string;\n`;
  }
  
  // Add event handlers based on interactions
  for (const interaction of iml.interactions) {
    if (interaction.trigger === 'onClick') {
      props += `  onClick?: (event: React.MouseEvent<HTMLElement>) => void;\n`;
    } else if (interaction.trigger === 'onFocus') {
      props += `  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;\n`;
    } else if (interaction.trigger === 'onBlur') {
      props += `  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;\n`;
    }
  }
  
  props += `}\n`;
  
  return props;
}

/**
 * Generate React component code
 */
function generateComponent(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML
): string {
  const hasPrimitives = iml.requiredPrimitives && iml.requiredPrimitives.length > 0;
  
  // Generate types inline (for simplicity)
  const types = generateTypes(componentName, irs, iml);
  
  // Generate imports
  let imports = `import React from 'react';\n`;
  imports += `import './${componentName}.styles.css';\n`;
  
  if (hasPrimitives && iml.requiredPrimitives) {
    for (const primitive of iml.requiredPrimitives) {
      const packageName = primitive.replace('@radix-ui/', '');
      const componentName = packageName.split('-').map((w, i) => 
        i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
      ).join('');
      imports += `import * as ${componentName} from '${primitive}';\n`;
    }
  }
  
  // Generate component
  let component = `${imports}\n\n`;
  component += `${types}\n\n`;
  component += `export const ${componentName}: React.FC<${componentName}Props> = ({\n`;
  
  // Add props destructuring
  const variantProps = extractVariantProps(irs);
  const slotProps = irs.slots.map(s => s.name);
  // Deduplicate props to avoid "Argument name clash" errors
  const allPropsSet = new Set([...variantProps, ...slotProps, 'tokenOverrides', 'className', 'children', 'onClick', 'onFocus', 'onBlur']);
  const allProps = Array.from(allPropsSet);
  component += `  ${allProps.join(',\n  ')},\n`;
  component += `}) => {\n`;
  
  // Generate token override CSS variables
  component += `  // Apply token overrides as CSS variables\n`;
  component += `  const overrideStyles = tokenOverrides ? {\n`;
  component += `    ...Object.entries(tokenOverrides).reduce((acc, [key, value]) => {\n`;
  component += `      const cssVarName = key.startsWith('--') ? key : \`--\${key.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}\`;\n`;
  component += `      acc[cssVarName] = typeof value === 'number' ? \`\${value}px\` : String(value);\n`;
  component += `      return acc;\n`;
  component += `    }, {} as Record<string, string>)\n`;
  component += `  } : {};\n\n`;
  
  // Generate state management if needed
  if (iml.states.length > 1) {
    component += `  const [state, setState] = React.useState<'default' | 'hover' | 'pressed' | 'focus' | 'disabled'>('default');\n\n`;
  }
  
  // Generate ARIA attributes
  const ariaAttrs = generateARIAAttributes(iml, irs);
  
  // Generate className
  let className = `\`${componentName.toLowerCase()}`;
  for (const prop of variantProps) {
    className += ` \${${prop} ? \`${componentName.toLowerCase()}--\${${prop}}\` : ''}`;
  }
  if (iml.states.length > 1) {
    className += ` \${state !== 'default' ? \`${componentName.toLowerCase()}--\${state}\` : ''}`;
  }
  className += ` \${className || ''}\``;
  
  component += `  const componentClassName = ${className};\n\n`;
  
  // Build token map from IRT for use in rendering (shared across all component types)
  const sharedTokenMap: Record<string, string> = {};
  if (irt && irt.tokens && irt.tokens.length > 0) {
    console.log(`[CODE GEN] Building token map from ${irt.tokens.length} tokens`);
    for (const token of irt.tokens) {
      const cssVar = `var(--${normalizeTokenName(token.name)})`;
      if (!sharedTokenMap[token.type]) {
        sharedTokenMap[token.type] = cssVar;
      }
      sharedTokenMap[normalizeTokenName(token.name)] = cssVar;
      if (token.type === 'color') {
        sharedTokenMap['fill'] = cssVar;
        sharedTokenMap['background'] = cssVar;
      } else if (token.type === 'spacing') {
        sharedTokenMap['gap'] = cssVar;
        sharedTokenMap['padding'] = cssVar;
      } else if (token.type === 'sizing') {
        sharedTokenMap['width'] = cssVar;
        sharedTokenMap['height'] = cssVar;
      }
    }
    console.log(`[CODE GEN] Token map built with ${Object.keys(sharedTokenMap).length} entries`);
  }
  
  // Generate component body based on category
  if (iml.componentCategory === 'button' || iml.componentCategory === 'iconButton') {
    component += generateButtonComponent(componentName, irs, irt, iml, ariaAttrs, sharedTokenMap);
  } else if (iml.componentCategory === 'input') {
    component += generateInputComponent(componentName, irs, irt, iml, ariaAttrs, sharedTokenMap);
  } else if (iml.componentCategory === 'combobox' || iml.componentCategory === 'select') {
    component += generateComboboxComponent(componentName, irs, irt, iml, ariaAttrs, sharedTokenMap);
  } else if (iml.componentCategory === 'dialog' || iml.componentCategory === 'modal') {
    component += generateDialogComponent(componentName, irs, irt, iml, ariaAttrs, sharedTokenMap);
  } else {
    component += generateGenericComponent(componentName, irs, irt, iml, ariaAttrs, sharedTokenMap);
  }
  
  component += `};\n`;
  
  return component;
}

/**
 * Generate button component
 */
function generateButtonComponent(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML,
  ariaAttrs: string,
  tokenMap?: Record<string, string>
): string {
  let code = `  return (\n`;
  code += `    <button\n`;
  code += `      className={componentClassName}\n`;
  code += `      style={overrideStyles}\n`;
  code += `      ${ariaAttrs}\n`;
  
  // Add event handlers
  for (const interaction of iml.interactions) {
    if (interaction.trigger === 'onClick') {
      code += `      onClick={(e) => {\n`;
      code += `        onClick?.(e);\n`;
      if (iml.states.length > 1) {
        code += `        setState('pressed');\n`;
        code += `        setTimeout(() => setState('default'), 150);\n`;
      }
      code += `      }}\n`;
    } else if (interaction.trigger === 'onMouseEnter') {
      code += `      onMouseEnter={() => setState('hover')}\n`;
    } else if (interaction.trigger === 'onMouseLeave') {
      code += `      onMouseLeave={() => setState('default')}\n`;
    } else if (interaction.trigger === 'onFocus') {
      code += `      onFocus={(e) => {\n`;
      code += `        onFocus?.(e);\n`;
      code += `        setState('focus');\n`;
      code += `      }}\n`;
    } else if (interaction.trigger === 'onBlur') {
      code += `      onBlur={(e) => {\n`;
      code += `        onBlur?.(e);\n`;
      code += `        setState('default');\n`;
      code += `      }}\n`;
    }
  }
  
  // Add keyboard handlers
  for (const keyboard of iml.keyboard) {
    if (keyboard.key === 'Enter' || keyboard.key === 'Space') {
      code += `      onKeyDown={(e) => {\n`;
      code += `        if (e.key === '${keyboard.key}' || e.key === ' ') {\n`;
      code += `          e.preventDefault();\n`;
      code += `          onClick?.(e as any);\n`;
      code += `        }\n`;
      code += `      }}\n`;
    }
  }
  
  // Add slots
  const labelSlot = irs.slots.find(s => s.name === 'label' || s.name === 'labelText');
  const iconSlot = irs.slots.find(s => s.name === 'icon');
  
  console.log(`[CODE GEN] Button component - slots: label=${!!labelSlot}, icon=${!!iconSlot}`);
  console.log(`[CODE GEN] Button component - IRS tree: ${irs.tree?.length || 0} nodes`);
  if (irs.tree && irs.tree.length > 0) {
    console.log(`[CODE GEN] Button component - root node children: ${irs.tree[0].children?.length || 0}`);
  }
  
  code += `    >\n`;
  
  // Build token map from IRT for use in rendering (if not provided)
  const buttonTokenMap: Record<string, string> = tokenMap || {};
  if (irt && irt.tokens && irt.tokens.length > 0 && !tokenMap) {
    for (const token of irt.tokens) {
      const cssVar = `var(--${normalizeTokenName(token.name)})`;
      if (!buttonTokenMap[token.type]) {
        buttonTokenMap[token.type] = cssVar;
      }
      buttonTokenMap[normalizeTokenName(token.name)] = cssVar;
      if (token.type === 'color') {
        buttonTokenMap['fill'] = cssVar;
        buttonTokenMap['background'] = cssVar;
      } else if (token.type === 'spacing') {
        buttonTokenMap['gap'] = cssVar;
        buttonTokenMap['padding'] = cssVar;
      } else if (token.type === 'sizing') {
        buttonTokenMap['width'] = cssVar;
        buttonTokenMap['height'] = cssVar;
      }
    }
  }
  
  // Priority: IRS tree children > Slots > children prop
  if (irs.tree && irs.tree.length > 0 && irs.tree[0].children && irs.tree[0].children.length > 0) {
    console.log(`[CODE GEN] Button: Rendering IRS tree children (${irs.tree[0].children.length} nodes)`);
    code += renderIRSTree(irs.tree[0].children, componentName, 6, buttonTokenMap);
  } else if (iconSlot && iml.componentCategory === 'iconButton') {
    console.log(`[CODE GEN] Button: Using icon slot`);
    code += `      {${iconSlot.name} || children}\n`;
  } else {
    console.log(`[CODE GEN] Button: Using slots/children fallback`);
    if (iconSlot) {
      code += `      {${iconSlot.name} && <span className="${componentName.toLowerCase()}__icon">{${iconSlot.name}}</span>}\n`;
    }
    if (labelSlot) {
      code += `      {${labelSlot.name} || children}\n`;
    } else {
      code += `      {children}\n`;
    }
  }
  
  code += `    </button>\n`;
  code += `  );\n`;
  
  return code;
}

/**
 * Generate input component
 */
function generateInputComponent(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML,
  ariaAttrs: string,
  tokenMap?: Record<string, string>
): string {
  let code = `  return (\n`;
  code += `    <div className={\`${componentName.toLowerCase()}__wrapper\`}>\n`;
  
  const labelSlot = irs.slots.find(s => s.name === 'label' || s.name === 'labelText');
  if (labelSlot) {
    code += `      {${labelSlot.name} && <label className="${componentName.toLowerCase()}__label">{${labelSlot.name}}</label>}\n`;
  }
  
  code += `      <input\n`;
  code += `        className={componentClassName}\n`;
  code += `        style={overrideStyles}\n`;
  code += `        ${ariaAttrs}\n`;
  
  for (const interaction of iml.interactions) {
    if (interaction.trigger === 'onFocus') {
      code += `        onFocus={(e) => {\n`;
      code += `          onFocus?.(e);\n`;
      code += `          setState('focus');\n`;
      code += `        }}\n`;
    } else if (interaction.trigger === 'onBlur') {
      code += `        onBlur={(e) => {\n`;
      code += `          onBlur?.(e);\n`;
      code += `          setState('default');\n`;
      code += `        }}\n`;
    }
  }
  
  code += `      />\n`;
  
  const helperSlot = irs.slots.find(s => s.name === 'helperText' || s.name === 'description');
  if (helperSlot) {
    code += `      {${helperSlot.name} && <span className="${componentName.toLowerCase()}__helper">{${helperSlot.name}}</span>}\n`;
  }
  
  code += `    </div>\n`;
  code += `  );\n`;
  
  return code;
}

/**
 * Generate combobox component (using Radix)
 */
function generateComboboxComponent(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML,
  ariaAttrs: string,
  tokenMap?: Record<string, string>
): string {
  let code = `  const [open, setOpen] = React.useState(false);\n`;
  code += `  const [value, setValue] = React.useState<string>('');\n\n`;
  code += `  return (\n`;
  code += `    <Combobox.Root open={open} onOpenChange={setOpen}>\n`;
  code += `      <Combobox.Trigger className={componentClassName} style={overrideStyles} ${ariaAttrs}>\n`;
  code += `        {value || 'Select...'}\n`;
  code += `      </Combobox.Trigger>\n`;
  code += `      <Combobox.Content className="${componentName.toLowerCase()}__content">\n`;
  code += `        {/* Options will be generated from variants */}\n`;
  code += `      </Combobox.Content>\n`;
  code += `    </Combobox.Root>\n`;
  code += `  );\n`;
  
  return code;
}

/**
 * Generate dialog component (using Radix)
 */
function generateDialogComponent(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML,
  ariaAttrs: string,
  tokenMap?: Record<string, string>
): string {
  let code = `  const [open, setOpen] = React.useState(false);\n\n`;
  code += `  return (\n`;
  code += `    <Dialog.Root open={open} onOpenChange={setOpen}>\n`;
  code += `      <Dialog.Trigger className={componentClassName} style={overrideStyles}>\n`;
  code += `        {children}\n`;
  code += `      </Dialog.Trigger>\n`;
  code += `      <Dialog.Portal>\n`;
  code += `        <Dialog.Overlay className="${componentName.toLowerCase()}__overlay" />\n`;
  code += `        <Dialog.Content className="${componentName.toLowerCase()}__content" ${ariaAttrs}>\n`;
  code += `          {children}\n`;
  code += `        </Dialog.Content>\n`;
  code += `      </Dialog.Portal>\n`;
  code += `    </Dialog.Root>\n`;
  code += `  );\n`;
  
  return code;
}

/**
 * Generate generic component
 */
function generateGenericComponent(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML,
  ariaAttrs: string,
  tokenMap?: Record<string, string>
): string {
  console.log(`[CODE GEN] Generating generic component: ${componentName}`);
  console.log(`[CODE GEN] IRS tree length: ${irs.tree?.length || 0}`);
  console.log(`[CODE GEN] Component type: ${irs.meta.componentType}`);
  console.log(`[CODE GEN] Variants count: ${irs.variants.length}`);
  
  // Get root node and its children
  const rootNode = irs.tree && irs.tree.length > 0 ? irs.tree[0] : null;
  const hasChildren = rootNode?.children && rootNode.children.length > 0;
  
  console.log(`[CODE GEN] Root node:`, rootNode ? { name: rootNode.name, type: rootNode.type, children: rootNode.children?.length || 0 } : 'null');
  console.log(`[CODE GEN] Has children: ${hasChildren}`);
  console.log(`[CODE GEN] Is component set: ${irs.meta.componentType === 'component-set'}`);
  
  let code = `  return (\n`;
  code += `    <div\n`;
  code += `      className={componentClassName}\n`;
  code += `      style={overrideStyles}\n`;
  code += `      ${ariaAttrs}\n`;
  code += `    >\n`;
  
  // Build token map from IRT for use in rendering (if not provided)
  const genericTokenMap: Record<string, string> = tokenMap || {};
  if (irt && irt.tokens && irt.tokens.length > 0 && !tokenMap) {
    console.log(`[CODE GEN] Building token map from ${irt.tokens.length} tokens`);
    for (const token of irt.tokens) {
      const cssVar = `var(--${normalizeTokenName(token.name)})`;
      if (!genericTokenMap[token.type]) {
        genericTokenMap[token.type] = cssVar;
      }
      genericTokenMap[normalizeTokenName(token.name)] = cssVar;
      if (token.type === 'color') {
        genericTokenMap['fill'] = cssVar;
        genericTokenMap['background'] = cssVar;
      } else if (token.type === 'spacing') {
        genericTokenMap['gap'] = cssVar;
        genericTokenMap['padding'] = cssVar;
      } else if (token.type === 'sizing') {
        genericTokenMap['width'] = cssVar;
        genericTokenMap['height'] = cssVar;
      }
    }
    console.log(`[CODE GEN] Token map built with ${Object.keys(genericTokenMap).length} entries`);
  } else if (!tokenMap) {
    console.log(`[CODE GEN] No tokens available in IRT, using hardcoded values`);
  }
  
  // Handle component sets - render only the first variant child
  // Component sets have multiple variant children, but we should only render one
  if (irs.meta.componentType === 'component-set' && rootNode && rootNode.children && rootNode.children.length > 0) {
    console.log(`[CODE GEN] Component set detected with ${rootNode.children.length} variant children`);
    console.log(`[CODE GEN] Rendering first variant child (${rootNode.children[0].name})`);
    // Render only the first variant child
    const renderedTree = renderIRSTree([rootNode.children[0]], componentName, 6, genericTokenMap);
    code += renderedTree;
  } else if (rootNode && rootNode.children && rootNode.children.length > 0) {
    // Regular component - render all children
    console.log(`[CODE GEN] Rendering ${rootNode.children.length} children of root node`);
    const renderedTree = renderIRSTree(rootNode.children, componentName, 6, genericTokenMap);
    console.log(`[CODE GEN] Rendered IRS tree (${renderedTree.length} chars):`, renderedTree.substring(0, 500));
    code += renderedTree;
  } else if (irs.tree && irs.tree.length > 0) {
    // Fallback: render the entire tree (shouldn't happen, but just in case)
    console.log(`[CODE GEN] Fallback: Rendering entire IRS tree`);
    const renderedTree = renderIRSTree(irs.tree, componentName, 6, genericTokenMap);
    code += renderedTree;
  } else {
    console.log(`[CODE GEN] No IRS tree or children, using children prop fallback`);
    code += `      {children}\n`;
  }
  
  code += `    </div>\n`;
  code += `  );\n`;
  
  console.log(`[CODE GEN] Generated component code (${code.length} chars)`);
  console.log(`[CODE GEN] Full component code:`, code);
  return code;
}

/**
 * Generate ARIA attributes string
 */
function generateARIAAttributes(iml: IML, irs: IRS): string {
  const attrs: string[] = [];
  
  if (iml.aria.role) {
    attrs.push(`role="${iml.aria.role}"`);
  }
  if (iml.aria.ariaLabel) {
    attrs.push(`aria-label={ariaLabel || "${iml.aria.ariaLabel}"}`);
  }
  if (iml.aria.ariaLabelledBy) {
    attrs.push(`aria-labelledby={ariaLabelledBy || "${iml.aria.ariaLabelledBy}"}`);
  }
  if (iml.aria.ariaDescribedBy) {
    attrs.push(`aria-describedby={ariaDescribedBy || "${iml.aria.ariaDescribedBy}"}`);
  }
  if (iml.aria.ariaControls) {
    attrs.push(`aria-controls={ariaControls || "${iml.aria.ariaControls}"}`);
  }
  if (iml.aria.ariaExpanded !== undefined) {
    attrs.push(`aria-expanded={${iml.aria.ariaExpanded}}`);
  }
  if (iml.aria.ariaDisabled !== undefined) {
    attrs.push(`aria-disabled={${iml.aria.ariaDisabled}}`);
  }
  
  return attrs.join(' ');
}

/**
 * Extract variant property names
 */
function extractVariantProps(irs: IRS): string[] {
  const props: string[] = [];
  const seen = new Set<string>();
  
  for (const variant of irs.variants) {
    for (const key of Object.keys(variant.properties)) {
      if (!seen.has(key)) {
        seen.add(key);
        props.push(key);
      }
    }
  }
  
  return props;
}

/**
 * Generate CSS styles with token variables
 */
function generateStyles(
  componentName: string,
  irs: IRS,
  irt: IRT,
  iml: IML
): string {
  let css = `/* ${componentName} Component Styles */\n\n`;
  css += `.${componentName.toLowerCase()} {\n`;
  
  // Add base styles from IRS
  if (irs.tree.length > 0) {
    const rootNode = irs.tree[0];
    
    // Handle blend mode isolation if needed
    if (rootNode.blendMode && requiresIsolation(rootNode.blendMode)) {
      css += `  isolation: isolate;\n`;
    }
    
    // Handle fills (including complex gradients, nested gradients, and images)
    if (rootNode.fills && rootNode.fills.length > 0) {
      const visibleFills = rootNode.fills.filter((f: any) => f.visible !== false);
      
      if (visibleFills.length === 1) {
        const fill = visibleFills[0];
        if (fill.type === 'solid' && fill.color) {
          const color = `rgba(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)}, ${fill.color.a})`;
          css += `  background-color: ${color};\n`;
        } else if (fill.type === 'gradient') {
          // Use gradient utility for complex gradients with transforms
          const gradientCSS = gradientToCSS(fill, (fill as any).gradientTransform, {
            width: rootNode.boundingBox?.width || 100,
            height: rootNode.boundingBox?.height || 100,
          });
          css += `  background: ${gradientCSS};\n`;
        } else if (fill.type === 'image') {
          // Handle image fills with transforms
          let imageCSS = `  background-image: url("${fill.imageUrl}");\n`;
          
          if ((fill as any).scaleMode) {
            const scaleMode = (fill as any).scaleMode;
            if (scaleMode === 'FILL') {
              imageCSS += `  background-size: cover;\n`;
            } else if (scaleMode === 'FIT') {
              imageCSS += `  background-size: contain;\n`;
            } else if (scaleMode === 'TILE') {
              imageCSS += `  background-repeat: repeat;\n`;
            } else if (scaleMode === 'STRETCH') {
              imageCSS += `  background-size: 100% 100%;\n`;
            }
          }
          
          if ((fill as any).imageTransform) {
            // Note: CSS background transforms are limited, may need SVG mask workaround
            css += `  /* Image transform detected - may require SVG workaround for full fidelity */\n`;
          }
          
          css += imageCSS;
        }
      } else if (visibleFills.length > 1) {
        // Multiple fills = layered backgrounds
        const backgroundLayers = visibleFills.map((fill: any) => {
          if (fill.type === 'solid' && fill.color) {
            return `rgba(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)}, ${fill.color.a})`;
          } else if (fill.type === 'gradient') {
            return gradientToCSS(fill, (fill as any).gradientTransform, {
              width: rootNode.boundingBox?.width || 100,
              height: rootNode.boundingBox?.height || 100,
            });
          } else if (fill.type === 'image') {
            return `url("${fill.imageUrl}")`;
          }
          return 'transparent';
        }).filter(Boolean);
        
        css += `  background: ${backgroundLayers.join(', ')};\n`;
      }
    }
    
    // Handle blend mode
    if (rootNode.blendMode && rootNode.blendMode !== 'NORMAL') {
      css += `  ${generateBlendModeCSS(rootNode.blendMode)}`;
    }
    
    if (rootNode.cornerRadius !== undefined) {
      css += `  border-radius: ${rootNode.cornerRadius}px;\n`;
    }
    if (rootNode.layout) {
      if (rootNode.layout.display) {
        css += `  display: ${rootNode.layout.display};\n`;
      }
      if (rootNode.layout.flexDirection) {
        css += `  flex-direction: ${rootNode.layout.flexDirection};\n`;
      }
      if (rootNode.layout.justifyContent) {
        css += `  justify-content: ${rootNode.layout.justifyContent};\n`;
      }
      if (rootNode.layout.alignItems) {
        css += `  align-items: ${rootNode.layout.alignItems};\n`;
      }
      if (rootNode.layout.gap !== undefined) {
        css += `  gap: ${rootNode.layout.gap}px;\n`;
      }
      if (rootNode.layout.padding) {
        css += `  padding: ${rootNode.layout.padding.top}px ${rootNode.layout.padding.right}px ${rootNode.layout.padding.bottom}px ${rootNode.layout.padding.left}px;\n`;
      }
    }
  }
  
  css += `}\n\n`;
  
  // Add variant styles
  for (const variant of irs.variants.slice(0, 10)) {
    const variantClass = Object.values(variant.properties).join('-').toLowerCase().replace(/\s+/g, '-');
    css += `.${componentName.toLowerCase()}--${variantClass} {\n`;
    css += `  /* Variant styles */\n`;
    css += `}\n\n`;
  }
  
  // Add state styles
  for (const state of iml.states) {
    if (state.name !== 'default') {
      css += `.${componentName.toLowerCase()}--${state.name} {\n`;
      css += `  /* ${state.name} state styles */\n`;
      css += `}\n\n`;
    }
  }
  
  // Add hover state
  if (iml.states.some(s => s.name === 'hover')) {
    css += `.${componentName.toLowerCase()}:hover {\n`;
    css += `  /* Hover styles */\n`;
    css += `}\n\n`;
  }
  
  // Add focus state
  if (iml.states.some(s => s.name === 'focus')) {
    css += `.${componentName.toLowerCase()}:focus {\n`;
    css += `  /* Focus styles */\n`;
    css += `}\n\n`;
  }
  
  // Add disabled state
  if (iml.states.some(s => s.name === 'disabled')) {
    css += `.${componentName.toLowerCase()}:disabled {\n`;
    css += `  opacity: 0.5;\n`;
    css += `  cursor: not-allowed;\n`;
    css += `}\n\n`;
  }
  
  return css;
}

/**
 * Generate enhanced Storybook story with all variants, controls, and accessibility examples
 */
function generateStorybook(
  componentName: string,
  irs: IRS,
  iml: IML
): string {
  let story = `import type { Meta, StoryObj } from '@storybook/react';\n`;
  story += `import { ${componentName} } from './${componentName}';\n\n`;
  story += `const meta: Meta<typeof ${componentName}> = {\n`;
  story += `  title: 'Components/${componentName}',\n`;
  story += `  component: ${componentName},\n`;
  story += `  tags: ['autodocs', 'accessibility'],\n`;
  
  // Add parameters for accessibility
  story += `  parameters: {\n`;
  story += `    docs: {\n`;
  story += `      description: {\n`;
  story += `        component: '${componentName} component generated from Figma design.',\n`;
  story += `      },\n`;
  story += `    },\n`;
  story += `    a11y: {\n`;
  story += `      config: {\n`;
  story += `        rules: [\n`;
  
  // Add accessibility rules based on IML
  if (iml.aria.ariaLabel) {
    story += `          { id: 'aria-label', enabled: true },\n`;
  }
  if (iml.aria.ariaLabelledBy) {
    story += `          { id: 'aria-labelledby', enabled: true },\n`;
  }
  if (iml.componentCategory === 'button' || iml.componentCategory === 'iconButton') {
    story += `          { id: 'button-name', enabled: true },\n`;
  }
  
  story += `        ],\n`;
  story += `      },\n`;
  story += `    },\n`;
  story += `  },\n`;
  
  // Add argTypes for all variant props
  const variantProps = extractVariantProps(irs);
  if (variantProps.length > 0) {
    story += `  argTypes: {\n`;
    for (const prop of variantProps) {
      const values = new Set<string>();
      for (const variant of irs.variants) {
        if (variant.properties[prop]) {
          values.add(variant.properties[prop]);
        }
      }
      const unionType = Array.from(values).map(v => `"${v}"`).join(' | ');
      story += `    ${prop}: {\n`;
      story += `      control: 'select',\n`;
      story += `      options: [${Array.from(values).map(v => `"${v}"`).join(', ')}],\n`;
      story += `      description: '${prop} variant',\n`;
      story += `    },\n`;
    }
    story += `  },\n`;
  }
  
  story += `};\n\n`;
  story += `export default meta;\n`;
  story += `type Story = StoryObj<typeof ${componentName}>;\n\n`;
  
  // Default story
  story += `export const Default: Story = {\n`;
  story += `  args: {\n`;
  const labelSlot = irs.slots.find(s => s.name === 'label' || s.name === 'labelText');
  if (labelSlot) {
    story += `    ${labelSlot.name}: '${componentName}',\n`;
  } else {
    story += `    children: '${componentName}',\n`;
  }
  story += `  },\n`;
  story += `  parameters: {\n`;
  story += `    docs: {\n`;
  story += `      description: {\n`;
  story += `        story: 'Default ${componentName} component.',\n`;
  story += `      },\n`;
  story += `    },\n`;
  story += `  },\n`;
  story += `};\n\n`;
  
  // Variant stories - generate for all variants
  const variantGroups = new Map<string, typeof irs.variants>();
  for (const variant of irs.variants) {
    const groupKey = Object.keys(variant.properties).sort().join('-');
    if (!variantGroups.has(groupKey)) {
      variantGroups.set(groupKey, []);
    }
    variantGroups.get(groupKey)!.push(variant);
  }
  
  let variantCount = 0;
  for (const [groupKey, variants] of variantGroups) {
    if (variantCount >= 10) break; // Limit to 10 variant stories
    
    const firstVariant = variants[0];
    const variantName = Object.values(firstVariant.properties)
      .join(' ')
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/\s+/g, '')
      .substring(0, 30) || `Variant${variantCount + 1}`;
    
    story += `export const ${variantName}: Story = {\n`;
    story += `  args: {\n`;
    for (const [key, value] of Object.entries(firstVariant.properties)) {
      story += `    ${key}: '${value}',\n`;
    }
    if (labelSlot) {
      story += `    ${labelSlot.name}: '${componentName} ${variantName}',\n`;
    }
    story += `  },\n`;
    story += `  parameters: {\n`;
    story += `    docs: {\n`;
    story += `      description: {\n`;
    story += `        story: '${componentName} with ${Object.entries(firstVariant.properties).map(([k, v]) => `${k}="${v}"`).join(', ')}.',\n`;
    story += `      },\n`;
    story += `    },\n`;
    story += `  },\n`;
    story += `};\n\n`;
    
    variantCount++;
  }
  
  // Add accessibility example story
  if (iml.aria.ariaLabel || iml.aria.ariaLabelledBy) {
    story += `export const AccessibilityExample: Story = {\n`;
    story += `  args: {\n`;
    if (labelSlot) {
      story += `    ${labelSlot.name}: 'Accessible ${componentName}',\n`;
    } else {
      story += `    children: 'Accessible ${componentName}',\n`;
    }
    if (iml.aria.ariaLabel) {
      story += `    'aria-label': '${iml.aria.ariaLabel}',\n`;
    }
    story += `  },\n`;
    story += `  parameters: {\n`;
    story += `    docs: {\n`;
    story += `      description: {\n`;
    story += `        story: '${componentName} with proper accessibility attributes.',\n`;
    story += `      },\n`;
    story += `    },\n`;
    story += `  },\n`;
    story += `};\n\n`;
  }
  
  // Add state stories (hover, focus, disabled, etc.)
  for (const state of iml.states) {
    if (state.name === 'default') continue;
    
    const stateName = state.name.charAt(0).toUpperCase() + state.name.slice(1);
    story += `export const ${stateName}: Story = {\n`;
    story += `  args: {\n`;
    if (labelSlot) {
      story += `    ${labelSlot.name}: '${componentName} (${state.name})',\n`;
    } else {
      story += `    children: '${componentName} (${state.name})',\n`;
    }
    if (state.name === 'disabled') {
      story += `    disabled: true,\n`;
    }
    story += `  },\n`;
    story += `  parameters: {\n`;
    story += `    docs: {\n`;
    story += `      description: {\n`;
    story += `        story: '${componentName} in ${state.name} state.',\n`;
    story += `      },\n`;
    story += `    },\n`;
    story += `  },\n`;
    story += `};\n\n`;
  }
  
  return story;
}

