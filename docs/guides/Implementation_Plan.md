
# DS-OS Implementation Plan (Updated & Unified with Blueprint)

This document is the **updated and enhanced Implementation Plan** for DS‑OS, rewritten to align with the unified blueprint, improved architecture, and enterprise-grade workflow.

It replaces the previous version with a more scalable, deterministic, and intelligent system that integrates:

- Multi‑layer IR (IRS + IRT + IML)
- Component Intelligence Classification
- Human‑in‑the‑loop pipeline
- Radix-backed behavior generation
- Token governance engine
- New maturity model (C1 → C5)
- Scalable visual + a11y testing strategy

---

# 📍 Implementation Overview

The DS‑OS implementation is divided into **6 major phases**, each containing multiple technical milestones.  
Each phase is designed to be **incremental**, allowing teams to gain value early while steadily progressing toward full automation.

```
Phase 1 — Extraction Engine (IRS + IRT)
Phase 2 — Interaction Modeling (IML)
Phase 3 — Code Generation v2 (Behavior + Styling)
Phase 4 — QA & Approvals (Visual Diff + A11y + Human Review)
Phase 5 — Documentation & Knowledge System (Storybook + MDX)
Phase 6 — Packaging & Enterprise Distribution
```

---

# 🧱 Phase 1 — Extraction Engine (IRS + IRT)

## 🎯 Objective  
Build a **complete, lossless, scalable extraction system** that converts Figma nodes → canonical structured data.

This is the foundation of DS‑OS.

---

## 1.1 IRS: Structure Extraction Engine

### Requirements
Extract **all relevant UI properties**, including:

- Visual: fills, strokes, effects, opacity, radii
- Layout: auto‑layout, constraints, spacing, alignment
- Geometry: bounding boxes, absolute offsets
- Text: typography, line height, letter spacing
- Variants: full component set analysis
- Children: recursive node tree

### Output Format
A strict TypeScript schema:

```ts
interface IRS {
  meta: { name; figmaUrl; nodeId; type; extractedAt };
  tree: IRSNode[];
  variants: VariantMatrix[];
  slots: SlotDefinition[];
}
```

### Tasks
- [ ] Build an advanced Figma REST client with caching and retry logic  
- [ ] Implement full node property extraction  
- [ ] Normalize node tree into semantic structure  
- [ ] Detect slots via naming conventions & heuristics  
- [ ] Resolve variant sets and flatten variant combinations  
- [ ] Validate with JSON Schema  
- [ ] Store IRS snapshots with version history  

---

## 1.2 IRT: Token Resolution Engine

### Requirements
- Map **Figma variables → semantic tokens**  
- Handle **multimode tokens** (light, dark, high‑contrast)  
- Generate **token dependency graph**  
- Support token aliasing and deduplication rules  

### Output Format

```ts
interface IRT {
  tokens: SemanticToken[];
  modeValues: Record<string, string>;
  tokenGraph: DependencyGraph;
}
```

### Tasks
- [ ] Fetch variables, styles, and variable modes  
- [ ] Map variable IDs → token names  
- [ ] Auto‑propose semantic naming  
- [ ] Detect duplicates & near‑duplicates  
- [ ] Generate `--css-vars`  
- [ ] Implement token convergence logic  

---

# 🔮 Phase 2 — Interaction Modeling (IML)

## 🎯 Objective  
Create a **behavioral IR layer** that defines how components behave, not just how they look.

This enables:
- Accessibility correctness  
- Keyboard interactions  
- ARIA roles & attributes  
- Stateful variants  
- Complex widget patterns  

---

## 2.1 IML Framework Design

Define the interaction model:

```ts
interface IML {
  componentCategory: 'button' | 'dialog' | 'combobox' | ...;
  interactions: InteractionRule[];
  aria: A11yMappings;
  states: StateDefinition[];
}
```

### Tasks
- [ ] Build a classification system for component type detection  
- [ ] Define behavior templates per category (Button, Input, Dialog, Menu, Select, Tooltip, etc.)  
- [ ] Integrate Radix/React Aria primitives into behavior mapping  
- [ ] Detect state variants (hover, focus, pressed, disabled)  
- [ ] Infer ARIA roles from component structure + category  

---

# 🏗 Phase 3 — Code Generation v2 (Component Factory)

## 🎯 Objective  
Generate **production-ready React components** using deterministic templates and IR layers.

---

## 3.1 Template Engine Architecture

### Requirements
- Deterministic templates (Handlebars or Nunjucks)
- Strict typing (TS)
- Behavior adapters (Radix/React Aria)
- Style layers (CSS modules + token vars)
- Automatic prop inference from variants + slots

### Tasks
- [ ] Implement template engine with partials  
- [ ] Build generator for:
  - Component file  
  - Types file  
  - Styles file  
  - Test file  
  - Storybook file  
  - MDX documentation  
- [ ] Add generator versioning + manifests  

---

## 3.2 Behavior Adapter Layer

Instead of generating complex interaction code, wrap high‑quality primitives:

```tsx
import * as Radix from '@radix-ui/react-dialog';
```

### Tasks
- [ ] Create per‑category adapters  
- [ ] Map IML → Radix primitives  
- [ ] Generate state management boilerplate  
- [ ] Ensure a11y attributes map correctly  

---

## 3.3 Tokenized Styles

Styles reference CSS custom properties derived from IRT:

```css
.root {
  background: var(--color-primary-500);
  padding: var(--spacing-3);
}
```

Tasks:
- [ ] Build CSS generator  
- [ ] Add variant + state selectors  
- [ ] Create fallback rules for strokes, gradients, masks  

---

# 🔎 Phase 4 — Testing & Approvals (Automated + Human)

## 🎯 Objective  
Ensure generated components meet **visual fidelity**, **accessibility**, and **performance** expectations before publication.

---

## 4.1 Visual Regression System

### Requirements
- Playwright screenshots  
- Pixelmatch diff  
- Variant-aware testing  
- Sampling strategy to avoid explosion  

Tasks:
- [ ] Implement screenshot capture engine  
- [ ] Sync Figma raster export for golden reference  
- [ ] Add diff overlay in UI  
- [ ] Create approval pipeline  

---

## 4.2 Accessibility Automation

Use axe-core + keyboard navigation simulation:

Tasks:
- [ ] Axe-core integration  
- [ ] Keyboard traversal tests  
- [ ] Auto‑verify ARIA attributes from IML  
- [ ] Fail builds on violations  

---

## 4.3 Human‑in‑Loop Approval System

A lightweight dashboard showing:

- Figma design  
- Generated component  
- Diff overlay  
- Tokens & props  
- Suggested fixes  

Tasks:
- [ ] Build Approval UI  
- [ ] Add comment + approval workflow  
- [ ] Manage regeneration cycles  

---

# 📚 Phase 5 — Documentation & Storybook

## 🎯 Objective  
Automatically create **complete, production-quality documentation**.

---

## 5.1 Storybook Generator

Tasks:
- [ ] Generate stories for each variant  
- [ ] Add controls from prop definitions  
- [ ] Embed Figma links  
- [ ] Support autodocs  

---

## 5.2 MDX Documentation Generator

Each component gets:

- Usage examples  
- Props table  
- Accessibility guidelines  
- Design tokens  
- Implementation notes  

Tasks:
- [ ] Build MDX template  
- [ ] Add auto-generated token sections  
- [ ] Add live code playground (optional)  

---

# 📦 Phase 6 — Packaging, Versioning & Distribution

## 🎯 Objective  
Publish clean, typed, tree‑shakable component packages.

---

## 6.1 Packaging System

Use Rollup or ESBuild to output:

- ESM bundle  
- CJS bundle  
- Types  
- Styles  
- Token maps  

Tasks:
- [ ] Implement package builder  
- [ ] Generate package manifest per component  
- [ ] Manage multi-package monorepo structure  

---

## 6.2 Versioning & Release Automation

Rules:
- Patches: style/token changes  
- Minor: new props or variants  
- Major: breaking changes to API  

Tasks:
- [ ] Semantic release config  
- [ ] GitHub Actions workflow  
- [ ] NPM/GH registry support  

---

# 🗂 Additional Systems

## Token Governance
- Detect token drift  
- Merge duplicates  
- Auto‑suggest semantic names  
- Track token usage  

## Analytics
Track:
- Component usage  
- Token adoption  
- Failure rates  
- Regenerations  

---

# 📅 Rollout Timeline

### Weeks 1–4
IRS + IRT extraction engine  
Classification system  
Initial code generator

### Weeks 5–8
IML behavior modeling  
Radix integration  
Styles + tokens

### Weeks 9–12
Visual testing infra  
Approval UI  
Accessibility automation

### Weeks 13–16
Storybook + Documentation  
CI/CD + package publishing  
Governance/analytics

---

# 🏁 Definition of Done (DoD)

A component is "**enterprise-complete**" when:

- [ ] IRS + IRT + IML fully extracted  
- [ ] Code generation successful  
- [ ] Visual diff < 0.1%  
- [ ] Axe-core passes  
- [ ] Storybook entry generated  
- [ ] MDX docs generated  
- [ ] Component approved by human reviewer  
- [ ] Published to registry  
- [ ] Added to analytics dashboard  

This new Implementation Plan transforms the system from a generator into a **design system operating pipeline** that is scalable, maintainable, and intelligent.

