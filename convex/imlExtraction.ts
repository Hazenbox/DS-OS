"use node";

import { IML, ComponentState, ARIAMapping, KeyboardMapping, InteractionRule } from "../src/types/ir";
import { IRS } from "../src/types/ir";
import { ComponentIntelligence } from "../src/types/ir";

// ============================================================================
// IML EXTRACTION - Interaction Model Layer
// ============================================================================

/**
 * Extract IML (Interaction Model IR) from IRS and component intelligence
 */
export function extractIML(
  irs: IRS,
  componentIntelligence: ComponentIntelligence
): IML {
  const states = extractStates(irs, componentIntelligence);
  const aria = extractARIA(irs, componentIntelligence);
  const keyboard = extractKeyboardMappings(componentIntelligence.category);
  const interactions = extractInteractionRules(irs, componentIntelligence);
  
  return {
    componentCategory: componentIntelligence.category,
    states,
    aria,
    keyboard,
    interactions,
    requiredPrimitives: componentIntelligence.requiredPrimitives,
  };
}

/**
 * Extract component states from IRS
 */
function extractStates(irs: IRS, intelligence: ComponentIntelligence): ComponentState[] {
  const states: ComponentState[] = [];
  
  // Extract states from variant mapping
  if (irs.stateMapping) {
    for (const stateMapping of irs.stateMapping) {
      const state: ComponentState = {
        name: stateMapping.semanticState,
        trigger: getStateTrigger(stateMapping.semanticState),
        changes: {}, // Will be populated from variant differences
        ariaAttributes: getStateARIA(stateMapping.semanticState, intelligence.category),
      };
      
      states.push(state);
    }
  }
  
  // Add default state if no states found
  if (states.length === 0) {
    states.push({
      name: 'default',
      trigger: '',
      changes: {},
      ariaAttributes: {},
    });
  }
  
  return states;
}

/**
 * Get CSS trigger for state
 */
function getStateTrigger(semanticState: string): string {
  const triggers: Record<string, string> = {
    default: '',
    hover: ':hover',
    pressed: ':active',
    focus: ':focus',
    disabled: ':disabled',
    custom: '',
  };
  
  return triggers[semanticState] || '';
}

/**
 * Get ARIA attributes for state
 */
function getStateARIA(state: string, category: string): Record<string, string> | undefined {
  if (state === 'disabled') {
    return { 'aria-disabled': 'true' };
  }
  
  if (state === 'focus' && (category === 'combobox' || category === 'select')) {
    return { 'aria-expanded': 'true' };
  }
  
  return undefined;
}

/**
 * Extract ARIA mappings from IRS and component intelligence
 */
function extractARIA(irs: IRS, intelligence: ComponentIntelligence): ARIAMapping {
  const baseARIA = intelligence.suggestedARIA;
  
  // Enhance with slot-based ARIA
  const slots = irs.slots;
  
  // Add labelledBy if label slot exists
  const labelSlot = slots.find(s => s.name === 'label' || s.name === 'labelText');
  if (labelSlot) {
    baseARIA.ariaLabelledBy = `${labelSlot.name}-id`;
  }
  
  // Add describedBy if helper text exists
  const helperSlot = slots.find(s => s.name === 'helperText' || s.name === 'description');
  if (helperSlot) {
    baseARIA.ariaDescribedBy = `${helperSlot.name}-id`;
  }
  
  // Add controls if listbox exists
  const listSlot = slots.find(s => s.name === 'list' || s.name === 'options');
  if (listSlot && (intelligence.category === 'combobox' || intelligence.category === 'select')) {
    baseARIA.ariaControls = `${listSlot.name}-id`;
  }
  
  return baseARIA;
}

/**
 * Extract keyboard mappings based on component category
 */
function extractKeyboardMappings(category: ComponentCategory): KeyboardMapping[] {
  const mappings: KeyboardMapping[] = [];
  
  switch (category) {
    case 'button':
    case 'iconButton':
      mappings.push(
        { key: 'Enter', action: 'activate', preventDefault: true },
        { key: 'Space', action: 'activate', preventDefault: true }
      );
      break;
      
    case 'combobox':
    case 'select':
      mappings.push(
        { key: 'Enter', action: 'open', target: 'listbox', preventDefault: true },
        { key: 'Escape', action: 'close', target: 'listbox', preventDefault: true },
        { key: 'ArrowDown', action: 'selectNext', target: 'option', preventDefault: true },
        { key: 'ArrowUp', action: 'selectPrevious', target: 'option', preventDefault: true },
        { key: 'Home', action: 'selectFirst', target: 'option', preventDefault: true },
        { key: 'End', action: 'selectLast', target: 'option', preventDefault: true }
      );
      break;
      
    case 'dialog':
    case 'modal':
      mappings.push(
        { key: 'Escape', action: 'close', target: 'dialog', preventDefault: true },
        { key: 'Tab', action: 'trapFocus', target: 'dialog', preventDefault: false }
      );
      break;
      
    case 'menu':
    case 'dropdown':
      mappings.push(
        { key: 'Escape', action: 'close', target: 'menu', preventDefault: true },
        { key: 'ArrowDown', action: 'selectNext', target: 'menuitem', preventDefault: true },
        { key: 'ArrowUp', action: 'selectPrevious', target: 'menuitem', preventDefault: true },
        { key: 'Enter', action: 'activate', target: 'menuitem', preventDefault: true },
        { key: 'Space', action: 'activate', target: 'menuitem', preventDefault: true }
      );
      break;
      
    case 'checkbox':
    case 'switch':
      mappings.push(
        { key: 'Enter', action: 'toggle', preventDefault: true },
        { key: 'Space', action: 'toggle', preventDefault: true }
      );
      break;
      
    case 'radio':
      mappings.push(
        { key: 'ArrowDown', action: 'selectNext', target: 'radio', preventDefault: true },
        { key: 'ArrowUp', action: 'selectPrevious', target: 'radio', preventDefault: true },
        { key: 'ArrowLeft', action: 'selectPrevious', target: 'radio', preventDefault: true },
        { key: 'ArrowRight', action: 'selectNext', target: 'radio', preventDefault: true }
      );
      break;
      
    case 'slider':
      mappings.push(
        { key: 'ArrowLeft', action: 'decrease', target: 'slider', preventDefault: true },
        { key: 'ArrowRight', action: 'increase', target: 'slider', preventDefault: true },
        { key: 'Home', action: 'min', target: 'slider', preventDefault: true },
        { key: 'End', action: 'max', target: 'slider', preventDefault: true }
      );
      break;
  }
  
  return mappings;
}

/**
 * Extract interaction rules from IRS and component intelligence
 */
function extractInteractionRules(irs: IRS, intelligence: ComponentIntelligence): InteractionRule[] {
  const rules: InteractionRule[] = [];
  
  // Click interactions
  if (intelligence.category === 'button' || intelligence.category === 'iconButton') {
    rules.push({
      trigger: 'onClick',
      action: 'activate',
      target: 'button',
    });
  }
  
  // Focus interactions
  if (intelligence.category === 'combobox' || intelligence.category === 'select' || intelligence.category === 'menu') {
    rules.push({
      trigger: 'onFocus',
      action: 'open',
      target: 'listbox',
    });
  }
  
  // Blur interactions
  if (intelligence.category === 'combobox' || intelligence.category === 'select') {
    rules.push({
      trigger: 'onBlur',
      action: 'close',
      target: 'listbox',
      condition: '!isMouseInside',
    });
  }
  
  // State transitions
  if (irs.stateMapping) {
    for (const stateMapping of irs.stateMapping) {
      if (stateMapping.semanticState === 'hover') {
        rules.push({
          trigger: 'onMouseEnter',
          action: 'setState',
          target: 'hover',
        });
        rules.push({
          trigger: 'onMouseLeave',
          action: 'setState',
          target: 'default',
        });
      }
      
      if (stateMapping.semanticState === 'pressed') {
        rules.push({
          trigger: 'onMouseDown',
          action: 'setState',
          target: 'pressed',
        });
        rules.push({
          trigger: 'onMouseUp',
          action: 'setState',
          target: 'default',
        });
      }
      
      if (stateMapping.semanticState === 'focus') {
        rules.push({
          trigger: 'onFocus',
          action: 'setState',
          target: 'focus',
        });
        rules.push({
          trigger: 'onBlur',
          action: 'setState',
          target: 'default',
        });
      }
    }
  }
  
  return rules;
}

import { ComponentCategory } from "../src/types/ir";

