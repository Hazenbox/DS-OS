"use node";

import { ComponentIntelligence, ComponentCategory, ARIAMapping } from "../src/types/ir";
import { IRS } from "../src/types/ir";

// ============================================================================
// COMPONENT INTELLIGENCE - Classification System
// ============================================================================

/**
 * Classify component based on IRS structure
 */
export function classifyComponent(irs: IRS): ComponentIntelligence {
  const name = irs.meta.name.toLowerCase();
  const structure = analyzeStructure(irs);
  
  // Classification based on name
  const nameBasedCategory = classifyByName(name);
  
  // Classification based on structure
  const structureBasedCategory = classifyByStructure(structure, irs);
  
  // Combine classifications
  const category = nameBasedCategory !== 'unknown' ? nameBasedCategory : structureBasedCategory;
  const confidence = nameBasedCategory !== 'unknown' ? 0.9 : 0.7;
  const detectedFrom = nameBasedCategory !== 'unknown' ? 'name' : 'structure';
  
  // Get required primitives
  const requiredPrimitives = getRequiredPrimitives(category);
  
  // Get suggested ARIA
  const suggestedARIA = getSuggestedARIA(category, structure);
  
  // Get slot patterns
  const slotPatterns = irs.slots.map(s => s.name);
  
  return {
    category,
    confidence,
    detectedFrom,
    requiredPrimitives,
    suggestedARIA,
    slotPatterns,
  };
}

/**
 * Classify component by name patterns
 */
function classifyByName(name: string): ComponentCategory {
  // Button patterns
  if (name.includes('button') || name.includes('btn')) {
    if (name.includes('icon')) return 'iconButton';
    return 'button';
  }
  
  // Input patterns
  if (name.includes('input') || name.includes('textfield') || name.includes('text-field')) {
    return 'input';
  }
  
  // Textarea patterns
  if (name.includes('textarea') || name.includes('text-area') || name.includes('multiline')) {
    return 'textarea';
  }
  
  // Combobox patterns
  if (name.includes('combobox') || name.includes('combo-box') || name.includes('autocomplete')) {
    return 'combobox';
  }
  
  // Select patterns
  if (name.includes('select') || name.includes('dropdown')) {
    return 'select';
  }
  
  // Dialog/Modal patterns
  if (name.includes('dialog') || name.includes('modal')) {
    return 'dialog';
  }
  
  // Popover patterns
  if (name.includes('popover') || name.includes('pop-up')) {
    return 'popover';
  }
  
  // Tooltip patterns
  if (name.includes('tooltip')) {
    return 'tooltip';
  }
  
  // Menu patterns
  if (name.includes('menu') && !name.includes('dropdown')) {
    return 'menu';
  }
  
  // Checkbox patterns
  if (name.includes('checkbox') || name.includes('check-box')) {
    return 'checkbox';
  }
  
  // Radio patterns
  if (name.includes('radio') && !name.includes('group')) {
    return 'radio';
  }
  
  // Switch patterns
  if (name.includes('switch') || name.includes('toggle')) {
    return 'switch';
  }
  
  // Slider patterns
  if (name.includes('slider') || name.includes('range')) {
    return 'slider';
  }
  
  // Card patterns
  if (name.includes('card')) {
    return 'card';
  }
  
  // Badge patterns
  if (name.includes('badge') || name.includes('tag')) {
    return 'badge';
  }
  
  // Avatar patterns
  if (name.includes('avatar') || name.includes('profile-picture')) {
    return 'avatar';
  }
  
  // Link patterns
  if (name.includes('link') || name.includes('anchor')) {
    return 'link';
  }
  
  return 'unknown';
}

/**
 * Analyze component structure
 */
interface StructureAnalysis {
  hasText: boolean;
  hasIcon: boolean;
  hasInput: boolean;
  hasList: boolean;
  hasOverlay: boolean;
  hasCheckbox: boolean;
  hasRadio: boolean;
  hasSlider: boolean;
  interactionCount: number;
  depth: number;
}

function analyzeStructure(irs: IRS): StructureAnalysis {
  const analysis: StructureAnalysis = {
    hasText: false,
    hasIcon: false,
    hasInput: false,
    hasList: false,
    hasOverlay: false,
    hasCheckbox: false,
    hasRadio: false,
    hasSlider: false,
    interactionCount: 0,
    depth: 0,
  };
  
  function analyzeNode(node: any, depth: number = 0): void {
    analysis.depth = Math.max(analysis.depth, depth);
    
    const name = node.name?.toLowerCase() || '';
    const type = node.type || '';
    
    // Check for text
    if (type === 'TEXT' || name.includes('text') || name.includes('label')) {
      analysis.hasText = true;
    }
    
    // Check for icon
    if (name.includes('icon') || type === 'VECTOR' || type === 'BOOLEAN_OPERATION') {
      analysis.hasIcon = true;
    }
    
    // Check for input
    if (name.includes('input') || name.includes('field')) {
      analysis.hasInput = true;
    }
    
    // Check for list
    if (name.includes('list') || name.includes('item') || name.includes('option')) {
      analysis.hasList = true;
    }
    
    // Check for overlay
    if (name.includes('overlay') || name.includes('backdrop') || name.includes('modal')) {
      analysis.hasOverlay = true;
    }
    
    // Check for checkbox
    if (name.includes('checkbox') || name.includes('check')) {
      analysis.hasCheckbox = true;
    }
    
    // Check for radio
    if (name.includes('radio')) {
      analysis.hasRadio = true;
    }
    
    // Check for slider
    if (name.includes('slider') || name.includes('track') || name.includes('thumb')) {
      analysis.hasSlider = true;
    }
    
    // Count interactions (variants, states)
    if (node.variantProperties || node.componentPropertyDefinitions) {
      analysis.interactionCount++;
    }
    
    // Recursively analyze children
    if (node.children) {
      node.children.forEach((child: any) => analyzeNode(child, depth + 1));
    }
  }
  
  // Analyze all nodes in tree
  irs.tree.forEach(node => analyzeNode(node, 0));
  
  return analysis;
}

/**
 * Classify component by structure analysis
 */
function classifyByStructure(structure: StructureAnalysis, irs: IRS): ComponentCategory {
  // Button-like: has text or icon, clickable, no input
  if (structure.hasText || structure.hasIcon) {
    if (!structure.hasInput && !structure.hasList && irs.slots.length <= 2) {
      return 'button';
    }
  }
  
  // Input-like: has input field
  if (structure.hasInput) {
    if (structure.hasList) {
      return 'combobox';
    }
    return 'input';
  }
  
  // Dialog-like: has overlay, modal structure
  if (structure.hasOverlay && structure.depth > 2) {
    return 'dialog';
  }
  
  // Menu-like: has list, no input
  if (structure.hasList && !structure.hasInput) {
    return 'menu';
  }
  
  // Checkbox-like
  if (structure.hasCheckbox) {
    return 'checkbox';
  }
  
  // Radio-like
  if (structure.hasRadio) {
    return 'radio';
  }
  
  // Slider-like
  if (structure.hasSlider) {
    return 'slider';
  }
  
  // Card-like: container with content
  if (structure.depth > 1 && !structure.hasInput && !structure.hasList) {
    return 'card';
  }
  
  return 'unknown';
}

/**
 * Get required Radix/React Aria primitives for component category
 */
function getRequiredPrimitives(category: ComponentCategory): string[] {
  const primitives: Record<ComponentCategory, string[]> = {
    button: [],
    iconButton: [],
    input: [],
    textarea: [],
    combobox: ['@radix-ui/react-combobox'],
    select: ['@radix-ui/react-select'],
    dialog: ['@radix-ui/react-dialog'],
    modal: ['@radix-ui/react-dialog'],
    popover: ['@radix-ui/react-popover'],
    tooltip: ['@radix-ui/react-tooltip'],
    menu: ['@radix-ui/react-menu'],
    dropdown: ['@radix-ui/react-dropdown-menu'],
    checkbox: ['@radix-ui/react-checkbox'],
    radio: ['@radix-ui/react-radio-group'],
    switch: ['@radix-ui/react-switch'],
    slider: ['@radix-ui/react-slider'],
    card: [],
    badge: [],
    avatar: ['@radix-ui/react-avatar'],
    link: [],
    text: [],
    container: [],
    unknown: [],
  };
  
  return primitives[category] || [];
}

/**
 * Get suggested ARIA attributes for component category
 */
function getSuggestedARIA(category: ComponentCategory, structure: StructureAnalysis): ARIAMapping {
  const baseARIA: Record<ComponentCategory, ARIAMapping> = {
    button: {
      role: 'button',
      ariaLabel: structure.hasText ? undefined : 'Button',
    },
    iconButton: {
      role: 'button',
      ariaLabel: 'Icon button',
    },
    input: {
      role: 'textbox',
      ariaLabel: 'Input field',
    },
    textarea: {
      role: 'textbox',
      ariaLabel: 'Text area',
      ariaMultiline: true,
    },
    combobox: {
      role: 'combobox',
      ariaExpanded: false,
      ariaControls: 'listbox-id',
      ariaAutocomplete: 'list',
    },
    select: {
      role: 'combobox',
      ariaExpanded: false,
      ariaControls: 'listbox-id',
    },
    dialog: {
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: 'dialog-title',
    },
    modal: {
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: 'dialog-title',
    },
    popover: {
      role: 'dialog',
      ariaModal: false,
    },
    tooltip: {
      role: 'tooltip',
    },
    menu: {
      role: 'menu',
      ariaLabel: 'Menu',
    },
    dropdown: {
      role: 'menu',
      ariaLabel: 'Dropdown menu',
    },
    checkbox: {
      role: 'checkbox',
    },
    radio: {
      role: 'radio',
    },
    switch: {
      role: 'switch',
    },
    slider: {
      role: 'slider',
      ariaValueMin: 0,
      ariaValueMax: 100,
      ariaValueNow: 0,
    },
    card: {
      role: 'article',
    },
    badge: {
      role: 'status',
    },
    avatar: {
      role: 'img',
      ariaLabel: 'Avatar',
    },
    link: {
      role: 'link',
    },
    text: {},
    container: {},
    unknown: {},
  };
  
  return baseARIA[category] || {};
}

