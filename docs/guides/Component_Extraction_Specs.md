
# DS-OS Upgraded Extraction Specification — Version 2  
### (Aligned with Unified Blueprint Architecture)

This document defines the **complete, upgraded, production-grade extraction specification** required for DS-OS.  
It supersedes your original “100% extraction” document and incorporates IRS + IRT + IML + CI layers.  
It fully aligns with the architecture decisions we finalized.

---

# 🧩 0. Purpose of This Specification

The goal of the extraction system is to produce **structured, semantic, behavioral, and design-token-ready representations** of Figma components.

Extraction produces three IR layers:

| IR Layer | Purpose |
|---------|---------|
| **IRS — Structure** | Visual + structural definition of the component |
| **IRT — Tokens** | Token-bound values, semantic mapping, multi-mode support |
| **IML — Interactions** | Behavioral semantics, ARIA, states, keyboard rules |

And one derived layer:

| CI Layer | Purpose |
|----------|---------|
| **Component Intelligence** | Detect component category + required primitives |

These combined IRs power deterministic code generation, documentation, testing, and publishing.

---

# 🧱 1. IRS — STRUCTURE EXTRACTION SPEC (Upgraded)

Your v1 extraction achieved full coverage of all raw visual properties.  
This IRS spec extends that to cover the **semantics, layout intent, slots, and state mapping** necessary for code generation.

---

## 1.1 IRS Data Model

```ts
interface IRS {
  meta: IRSMetadata;
  tree: IRSNode[];
  variants: VariantMatrix[];
  slots: SlotDefinition[];
  layoutIntent: LayoutIntent;
  visualHints: CSSHints;
}
```

---

## 1.2 New Additions to IRS

### 1.2.1 roleHint (Semantic Tagging)

Based on name + structure:

- `Button`, `Btn`, `Primary` → root node → `button-root`
- Icon + text → `label` + `icon-left`
- Centered overlay → `dialog-overlay`

This increases classification precision.

---

### 1.2.2 Slot Extraction

Slots represent replaceable user content:

- label  
- icon  
- supportingText  
- helperText  
- prefix / suffix  
- action  

Slots derived from:

- Layer names  
- Node patterns  
- Auto-layout direction  

---

### 1.2.3 State Mapping (Variant → Semantic State)

Figma variants may imply states:

| Variant Name | State |
|--------------|--------|
| Default | default |
| Hover | hover |
| Pressed | pressed |
| Focus | focus |
| Disabled | disabled |

IRS stores:

```ts
interface IRSState {
  figmaVariant: string;
  semanticState: "default" | "hover" | "pressed" | "focus" | "disabled" | "custom";
}
```

---

### 1.2.4 Responsive Layout Intent

Maps Figma HUG/FILL/FIXED → semantic layout intentions:

```ts
layoutIntent: {
  horizontal: "intrinsic" | "fluid" | "fixed",
  vertical: "intrinsic" | "fluid" | "fixed"
}
```

This enables responsive-capable code generation.

---

### 1.2.5 CSS Hints (Workarounds for Unsupported Features)

Some Figma properties do not map 1:1 to CSS.

IRS stores hints:

```ts
interface CSSHints {
  requiresPseudo: boolean;
  requiresMask: boolean;
  requiresFilterWorkaround: boolean;
  unsupportedBlendMode?: boolean;
  strokeMappingStrategy: "outline" | "box-shadow" | "pseudo";
}
```

---

### 1.2.6 Mixed Text Span Extraction

Support for rich text inside a single Figma text node:

```ts
interface IRSTextSpan {
  text: string;
  style: Typography;
}
```

---

### 1.2.7 Stacking Context & z-index Reconstruction

Extract:

- isolation layers  
- modal layers  
- overlay position  

---

# 🎨 2. IRT — TOKEN EXTRACTION SPEC (Updated)

Your v1 already extracts bound variables.  
Upgraded IRT spec adds:

---

## 2.1 Semantic Token Inference

If a variable is close to a known design token, infer semantic name:

```
#0d99ff → color.brand.primary
```

Threshold: ΔE < 2.0.

---

## 2.2 Token Aliasing

Detect duplicates:

```
brand.500 ~ neutral.500 → alias suggestion
```

---

## 2.3 Multi-mode Tokens

Capture all modes:

```json
{
  "light": "#ffffff",
  "dark": "#1a1a1a",
  "highContrast": "#000000"
}
```

---

## 2.4 Token Usage Tracing

```ts
tokenUsage: Record<tokenName, IRSNode[]>
```

Supports token governance.

---

# 🎮 3. IML — INTERACTION MODEL SPEC  

This is the **critical missing layer** in most design-to-code systems.

---

## 3.1 IML Data Structure

```ts
interface IML {
  componentCategory: ComponentCategory;
  states: ComponentStateModel[];
  aria: ARIAMapping;
  keyboard: KeyboardMapping;
  interactions: InteractionRule[];
}
```

---

## 3.2 Component State Model

Derived from IRS state mapping:

```json
{
  "state": "hover",
  "trigger": ":hover",
  "changes": { "background": "#0088f0" }
}
```

---

## 3.3 ARIA Mapping

Determine ARIA roles based on category:

| Component | ARIA Role |
|-----------|-----------|
| Button | button |
| Input | textbox |
| Dialog | dialog |
| Tooltip | tooltip |
| Select | combobox + listbox |
| Tabs | tablist + tab + tabpanel |

---

## 3.4 Keyboard Mapping

Defines keyboard behavior:

```
ArrowDown → navigate to next option  
ArrowUp → navigate to previous option  
Enter → activate  
Esc → close  
```

---

## 3.5 Interaction Rules

```ts
interface InteractionRule {
  trigger: string;
  action: string;
  target: string;
}
```

Examples:

```
hover → show → tooltip  
click → toggle → checkbox  
focus → open → menu  
```

---

# 🧠 4. CI — COMPONENT INTELLIGENCE SPEC

Uses IRS + IRT + IML to classify components.

---

## 4.1 Categories

```
button
iconButton
input
textarea
checkbox
radio
switch
menu
select
combobox
dialog
popover
tooltip
card
listItem
badge
tab
toast
```

---

## 4.2 Component Profile

```ts
interface ComponentProfile {
  category: ComponentCategory;
  maturity: "C1" | "C2" | "C3" | "C4" | "C5";
  requiredPrimitives?: string[];
}
```

---

# 🔍 5. Upgraded Extraction Pipeline

```
Figma Node
  → Raw Visual Extraction (current v1 system)
  → IRS Normalization
  → Variant/State Extraction
  → IRT Mapping (tokens)
  → CI Classification
  → IML Derivation (behavior)
  → Final IR Bundle (IRS + IRT + IML + Profile)
```

---

# 📦 6. Final Extraction Output

Each component produces:

```
IRS.json
IRT.json
IML.json
component-profile.json
```

These feed directly into:

- code generation  
- documentation generation  
- accessibility generation  
- testing pipelines  

---

# 🏁 Summary of Improvements

| Area | v1 Extraction | v2 Upgraded Spec |
|------|----------------|------------------|
| Visual properties | 100% (excellent) | Same |
| Structure | raw values | semantic slots, layout intent, states |
| Tokens | resolved | semantic inference, aliasing, modes, usage |
| Interactions | none | full IML (states, ARIA, keyboard) |
| Classification | none | component intelligence layer |
| Accessibility | none | ARIA + state modeling |
| Fallback logic | partial | full CSSHints model |
| Text spans | missing | supported |

---

If you'd like, I can now generate:

### ✅ The full TypeScript schema for IRS + IRT + IML + CI  
### ✅ A complete extraction-engine implementation checklist  
### ✅ A test suite for extraction validation  

Just tell me:  
**“Generate the IR TypeScript schemas.”**

