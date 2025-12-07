// ============================================================================
// INTERMEDIATE REPRESENTATIONS (IR) TYPE DEFINITIONS
// Based on Component_Extraction_Specs.md and Unified_Blueprint.md
// ============================================================================

// ============================================================================
// IRS — STRUCTURE IR
// ============================================================================

export interface IRSMetadata {
  name: string;
  figmaUrl: string;
  nodeId: string;
  type: string;
  extractedAt: number;
  sourceFileKey?: string;
  componentType?: string;
}

export interface IRSBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IRSLayout {
  display: 'flex' | 'grid' | 'block' | 'inline' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  gap?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  margin?: { top: number; right: number; bottom: number; left: number };
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
}

export interface IRSFill {
  type: 'solid' | 'gradient' | 'image' | 'none';
  color?: { r: number; g: number; b: number; a: number };
  gradientStops?: Array<{ color: { r: number; g: number; b: number; a: number }; position: number }>;
  gradientType?: 'linear' | 'radial' | 'angular' | 'diamond';
  imageUrl?: string;
  blendMode?: string;
  opacity?: number;
}

export interface IRSStroke {
  type: 'solid' | 'gradient' | 'none';
  color?: { r: number; g: number; b: number; a: number };
  width: number;
  position?: 'inside' | 'center' | 'outside';
  align?: 'center' | 'inside' | 'outside';
}

export interface IRSEffect {
  type: 'drop-shadow' | 'inner-shadow' | 'layer-blur' | 'background-blur';
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  visible?: boolean;
}

export interface IRSTypography {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  lineHeight: number | string;
  letterSpacing: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface IRSTextSpan {
  text: string;
  style: IRSTypography;
}

export interface IRSConstraints {
  vertical: 'top' | 'center' | 'bottom' | 'scale' | 'min' | 'max';
  horizontal: 'left' | 'center' | 'right' | 'scale' | 'min' | 'max';
}

export interface IRSLayoutIntent {
  horizontal: 'intrinsic' | 'fluid' | 'fixed';
  vertical: 'intrinsic' | 'fluid' | 'fixed';
}

export interface IRSCSSHints {
  requiresPseudo: boolean;
  requiresMask: boolean;
  requiresFilterWorkaround: boolean;
  unsupportedBlendMode?: boolean;
  strokeMappingStrategy: 'outline' | 'box-shadow' | 'pseudo';
}

export interface IRSState {
  figmaVariant: string;
  semanticState: 'default' | 'hover' | 'pressed' | 'focus' | 'disabled' | 'custom';
}

export interface IRSNode {
  id: string;
  name: string;
  type: string;
  roleHint?: string; // Semantic tagging (e.g., 'button-root', 'label', 'icon-left')
  boundingBox?: IRSBoundingBox;
  layout?: IRSLayout;
  fills?: IRSFill[];
  strokes?: IRSStroke[];
  effects?: IRSEffect[];
  typography?: IRSTypography;
  textSpans?: IRSTextSpan[]; // For mixed text spans
  constraints?: IRSConstraints;
  opacity?: number;
  blendMode?: string;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  children?: IRSNode[];
  slotName?: string; // If this node is a slot (e.g., 'label', 'icon', 'content')
  zIndex?: number;
}

export interface VariantProperty {
  name: string;
  value: string;
  type: 'boolean' | 'text' | 'instance-swap' | 'variant';
}

export interface VariantMatrix {
  name: string;
  properties: Record<string, string>;
  nodeId?: string;
}

export interface SlotDefinition {
  name: string;
  nodeId: string;
  type: 'text' | 'icon' | 'content' | 'action' | 'prefix' | 'suffix' | 'label' | 'helperText';
  required: boolean;
  defaultValue?: string;
}

export interface IRS {
  meta: IRSMetadata;
  tree: IRSNode[];
  variants: VariantMatrix[];
  slots: SlotDefinition[];
  layoutIntent: IRSLayoutIntent;
  visualHints: IRSCSSHints;
  stateMapping?: IRSState[];
}

// ============================================================================
// IRT — TOKEN IR
// ============================================================================

export interface SemanticToken {
  name: string; // e.g., 'color.primary.500'
  semanticName?: string; // Auto-inferred semantic name
  value: string | number;
  type: 'color' | 'spacing' | 'typography' | 'sizing' | 'radius' | 'shadow' | 'opacity' | 'other';
  modes: Record<string, string | number>; // e.g., { light: '#ffffff', dark: '#1a1a1a' }
  sourceVariableId?: string; // Figma variable ID
  sourceStyleId?: string; // Figma style ID
  aliases?: string[]; // Other tokens that alias this one
  description?: string;
  usageReferences?: string[]; // Component/node IDs that use this token
}

export interface TokenDependency {
  from: string; // Token name
  to: string; // Token name it depends on
  relationship: 'alias' | 'reference' | 'derived';
}

export interface TokenDependencyGraph {
  nodes: SemanticToken[];
  edges: TokenDependency[];
}

export interface IRT {
  tokens: SemanticToken[];
  modeValues: Record<string, Record<string, string | number>>; // mode -> tokenName -> value
  tokenGraph: TokenDependencyGraph;
  tokenUsage: Record<string, string[]>; // tokenName -> [nodeIds]
}

// ============================================================================
// IML — INTERACTION MODEL IR
// ============================================================================

export type ComponentCategory = 
  | 'button' 
  | 'iconButton' 
  | 'input' 
  | 'textarea' 
  | 'combobox' 
  | 'select' 
  | 'dialog' 
  | 'modal' 
  | 'popover' 
  | 'tooltip' 
  | 'menu' 
  | 'dropdown' 
  | 'checkbox' 
  | 'radio' 
  | 'switch' 
  | 'slider' 
  | 'card' 
  | 'badge' 
  | 'avatar' 
  | 'link' 
  | 'text' 
  | 'container' 
  | 'unknown';

export interface ComponentState {
  name: string; // e.g., 'hover', 'focus', 'pressed', 'disabled'
  trigger: string; // CSS selector or event (e.g., ':hover', 'onClick')
  changes: Record<string, any>; // Property changes for this state
  ariaAttributes?: Record<string, string>; // ARIA attributes for this state
}

export interface ARIAMapping {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaSelected?: boolean;
  ariaDisabled?: boolean;
  ariaRequired?: boolean;
  ariaInvalid?: boolean;
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaAtomic?: boolean;
  ariaBusy?: boolean;
  ariaModal?: boolean;
  ariaMultiline?: boolean;
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both';
  ariaValueMin?: number;
  ariaValueMax?: number;
  ariaValueNow?: number;
  customAttributes?: Record<string, string>;
}

export interface KeyboardMapping {
  key: string; // e.g., 'Enter', 'Escape', 'ArrowDown'
  action: string; // e.g., 'submit', 'close', 'selectNext'
  target?: string; // Target element or state
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface InteractionRule {
  trigger: string; // Event or state change
  action: string; // What happens
  target?: string; // Target element or component
  condition?: string; // Optional condition
}

export interface IML {
  componentCategory: ComponentCategory;
  states: ComponentState[];
  aria: ARIAMapping;
  keyboard: KeyboardMapping[];
  interactions: InteractionRule[];
  requiredPrimitives?: string[]; // e.g., ['@radix-ui/react-dialog']
}

// ============================================================================
// COMPONENT INTELLIGENCE
// ============================================================================

export interface ComponentIntelligence {
  category: ComponentCategory;
  confidence: number; // 0-1
  detectedFrom: 'name' | 'structure' | 'variants' | 'combination';
  requiredPrimitives: string[];
  suggestedARIA: ARIAMapping;
  slotPatterns: string[]; // Detected slot names
}

