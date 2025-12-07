# Core Features Completion Plan

**Based on Vision & Implementation Plans**  
**Status**: Planning Phase  
**Date**: December 2024

---

## 🎯 Objective

Complete the core features of DS-OS to achieve the vision of a **production-grade Design System Operating System** that converts Figma designs into production-ready, accessible, themable React components.

---

## 📊 Current State Assessment

### ✅ What's Working
1. **Basic Component Extraction**: Claude AI-powered extraction from Figma URLs
2. **Component Preview**: Sandpack-based preview with code/inspect tabs
3. **Token Management**: JSON file upload, parsing, and basic visualization
4. **Project Management**: Full CRUD with member management
5. **Multi-Tenant Architecture**: Complete tenant isolation and RBAC
6. **Enterprise Auth**: SSO/SCIM integration

### ❌ What's Missing (Critical)
1. **IRS (Structure IR)**: Complete extraction of all visual properties, layout intent, slots, variant matrix
2. **IRT (Token IR)**: Semantic token mapping, multi-mode support, dependency graph
3. **IML (Interaction IR)**: Behavioral semantics, ARIA mappings, keyboard patterns
4. **Component Intelligence**: Automatic component classification (Button, Input, Combobox, etc.)
5. **Code Generation v2**: Radix/React Aria primitives integration, deterministic templates
6. **Token Visualization**: Multi-mode support, better color/typography previews
7. **Visual Diff Testing**: Pixel-perfect comparison with Figma designs
8. **Accessibility Testing**: axe-core integration and automated a11y checks
9. **Documentation Generation**: Storybook stories and MDX docs

---

## 🚀 Implementation Phases

### Phase 1: Enhanced Extraction Engine (IRS + IRT) ⚡ **PRIORITY**

**Goal**: Build a complete, lossless extraction system that converts Figma nodes → canonical structured data.

#### 1.1 IRS: Structure Extraction Engine
- [ ] Extract all visual properties (fills, strokes, effects, opacity, radii)
- [ ] Extract layout properties (auto-layout, constraints, spacing, alignment)
- [ ] Extract geometry (bounding boxes, absolute offsets)
- [ ] Extract typography (font family, size, weight, line height, letter spacing)
- [ ] Extract variant sets and flatten variant combinations
- [ ] Detect slots via naming conventions & heuristics
- [ ] Normalize node tree into semantic structure
- [ ] Store IRS snapshots with version history

**Output**: `IRS` interface with `meta`, `tree`, `variants`, `slots`, `layoutIntent`, `visualHints`

#### 1.2 IRT: Token Resolution Engine
- [ ] Fetch Figma variables, styles, and variable modes
- [ ] Map variable IDs → semantic token names
- [ ] Auto-propose semantic naming (e.g., `color.primary.500`)
- [ ] Detect duplicates & near-duplicates
- [ ] Generate token dependency graph
- [ ] Support multi-mode tokens (light, dark, high-contrast)
- [ ] Generate CSS custom properties

**Output**: `IRT` interface with `tokens`, `modeValues`, `tokenGraph`

**Files to Update**:
- `convex/claudeExtraction.ts` - Enhance extraction logic
- `convex/figma.ts` - Add IRS/IRT extraction helpers
- `src/types/index.ts` - Add IRS/IRT type definitions

---

### Phase 2: Interaction Modeling (IML) 🎯

**Goal**: Create a behavioral IR layer that defines how components behave, not just how they look.

#### 2.1 IML Framework
- [ ] Build component classification system (Button, Input, Dialog, Menu, Select, etc.)
- [ ] Define behavior templates per category
- [ ] Detect state variants (hover, focus, pressed, disabled)
- [ ] Infer ARIA roles from component structure + category
- [ ] Map keyboard interactions (Enter, Escape, Arrow keys)
- [ ] Integrate Radix/React Aria primitives into behavior mapping

**Output**: `IML` interface with `componentCategory`, `interactions`, `aria`, `states`

**Files to Create**:
- `convex/iml.ts` - IML extraction and classification
- `src/types/iml.ts` - IML type definitions

---

### Phase 3: Component Intelligence 🧠

**Goal**: Automatically classify components and detect required primitives.

#### 3.1 Component Classification
- [ ] Detect component type from name, structure, and variants
- [ ] Map to component categories (Button, IconButton, Input, Combobox, Dialog, etc.)
- [ ] Identify required Radix/React Aria primitives
- [ ] Suggest appropriate ARIA roles and attributes
- [ ] Detect slot patterns (label, icon, content, etc.)

**Files to Create**:
- `convex/componentIntelligence.ts` - Classification logic
- `src/types/componentIntelligence.ts` - Type definitions

---

### Phase 4: Enhanced Code Generation 🏗️

**Goal**: Generate production-ready React components using deterministic templates.

#### 4.1 Template Engine
- [ ] Implement deterministic template engine (Handlebars/Nunjucks)
- [ ] Build generator for component file, types, styles, tests, Storybook, MDX
- [ ] Add generator versioning + manifests

#### 4.2 Behavior Adapter Layer
- [ ] Create per-category adapters (Button, Dialog, Combobox, etc.)
- [ ] Map IML → Radix primitives
- [ ] Generate state management boilerplate
- [ ] Ensure a11y attributes map correctly

#### 4.3 Tokenized Styles
- [ ] Build CSS generator with CSS custom properties
- [ ] Add variant + state selectors
- [ ] Create fallback rules for strokes, gradients, masks

**Files to Create**:
- `convex/codeGenerator.ts` - Template-based code generation
- `convex/templates/` - Template files for different component types

---

### Phase 5: Token Manager Enhancements 🎨

**Goal**: Improve token visualization and management.

#### 5.1 Multi-Mode Support
- [ ] Add mode switching UI (light/dark/high-contrast)
- [ ] Display mode-specific token values
- [ ] Visualize mode differences

#### 5.2 Token Visualization
- [ ] Enhanced color swatches with contrast ratios
- [ ] Typography previews with live text samples
- [ ] Spacing visualizations with grid overlays
- [ ] Shadow previews with depth indicators

#### 5.3 Token Governance
- [ ] Token dependency graph visualization
- [ ] Duplicate detection and merging suggestions
- [ ] Naming convention validation
- [ ] Usage tracking across components

**Files to Update**:
- `src/components/TokenManager.tsx` - Add visualization enhancements
- `src/components/TokenVisualization.tsx` - New component for visualizations

---

### Phase 6: Release Manager Enhancements 🚀

**Goal**: Add automated testing and approval workflows.

#### 6.1 Visual Diff Testing
- [ ] Integrate Playwright for screenshot capture
- [ ] Sync Figma raster export for golden reference
- [ ] Implement pixelmatch diff algorithm
- [ ] Add diff overlay in UI
- [ ] Create approval pipeline

#### 6.2 Accessibility Testing
- [ ] Integrate axe-core for automated a11y checks
- [ ] Keyboard traversal tests
- [ ] Auto-verify ARIA attributes from IML
- [ ] Fail builds on violations

#### 6.3 Approval Workflow
- [ ] Create approval UI dashboard
- [ ] Show Figma design vs generated component
- [ ] Display diff overlay
- [ ] Show tokens & props
- [ ] Allow designer/developer approval

**Files to Create**:
- `convex/visualDiff.ts` - Visual diff testing logic
- `convex/accessibilityTesting.ts` - A11y testing logic
- `src/components/ApprovalWorkflow.tsx` - Approval UI

---

### Phase 7: Documentation Generation 📚

**Goal**: Auto-generate Storybook stories and MDX documentation.

#### 7.1 Storybook Generation
- [ ] Generate Storybook stories from components
- [ ] Create variant stories for all component variants
- [ ] Add controls for all props
- [ ] Include accessibility examples

#### 7.2 MDX Documentation
- [ ] Generate MDX docs with usage guidelines
- [ ] Include token sheets
- [ ] Add accessibility rules
- [ ] Include example code
- [ ] Link to Figma designs

**Files to Create**:
- `convex/storybookGenerator.ts` - Storybook story generation
- `convex/mdxGenerator.ts` - MDX documentation generation

---

## 📅 Implementation Timeline

### Week 1-2: Phase 1 (IRS + IRT)
- Enhance extraction engine
- Implement IRS structure extraction
- Implement IRT token resolution
- Update Component Builder UI

### Week 3: Phase 2 (IML)
- Build IML framework
- Implement component classification
- Add behavior templates

### Week 4: Phase 3 (Component Intelligence)
- Implement classification system
- Add primitive detection
- Integrate with code generation

### Week 5-6: Phase 4 (Code Generation v2)
- Build template engine
- Create behavior adapters
- Implement tokenized styles

### Week 7: Phase 5 (Token Manager)
- Add multi-mode support
- Enhance visualizations
- Add governance features

### Week 8: Phase 6 (Release Manager)
- Integrate visual diff testing
- Add accessibility testing
- Build approval workflow

### Week 9: Phase 7 (Documentation)
- Generate Storybook stories
- Generate MDX docs
- Integrate with release pipeline

---

## 🎯 Success Criteria

- [ ] **Visual Fidelity**: ≥ 99.9% pixel-perfect match with Figma
- [ ] **Extraction Time**: < 5s per component
- [ ] **Accessibility**: 100% axe-core pass rate
- [ ] **Code Quality**: TypeScript strict mode, full type coverage
- [ ] **Documentation**: 100% component documentation coverage
- [ ] **Token Consistency**: < 2% drift across releases

---

## 📝 Next Steps

1. **Start with Phase 1**: Enhance the extraction engine to produce proper IRS and IRT
2. **Incremental Approach**: Complete one phase before moving to the next
3. **Testing**: Test each phase thoroughly before proceeding
4. **Documentation**: Document all new features and APIs

---

## 🔗 Related Documents

- [Vision.md](./guides/Vision.md) - Overall vision and goals
- [Implementation_Plan.md](./guides/Implementation_Plan.md) - Detailed implementation plan
- [Component_Extraction_Specs.md](./guides/Component_Extraction_Specs.md) - Extraction specifications
- [Unified_Blueprint.md](./guides/Unified_Blueprint.md) - Architecture blueprint

