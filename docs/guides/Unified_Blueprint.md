
# DS-OS — Unified Blueprint (Vision + Implementation)
**A hyper-detailed, comprehensive blueprint for a production-grade Design System OS** — merging your Vision & Implementation plans into a single, actionable, engineer- and design-ready blueprint.

**Source materials referenced:** Vision & Implementation plans uploaded by you. See citations: fileciteturn0file1 fileciteturn0file0

---
## Executive summary
DS-OS transforms Figma designs into production-quality React components, documented and published with a deterministic, auditable pipeline. This blueprint defines architecture, data models, extraction logic, interaction modeling, code generation, QA, accessibility, packaging, deployment, governance, and a step-by-step rollout plan to get from POC to enterprise adoption.

Key principles:
- **Standards-first**: WCAG 2.2 AA, ARIA APG, semantic HTML, performance budgets.
- **IR-driven**: Separate concerns via IR layers (structure, tokens, interactions).
- **Primitives, not lock-in**: Prefer Radix/React Aria primitives for complex widgets; generate styling and slots rather than brittle behavior code.
- **Human-in-loop**: Add checkpoints where automation defers to experts for correctness.
- **Maturity model**: Label component readiness, enabling progressive hardening.

Goals & success metrics (extracted from your vision): visual fidelity target 99.9% (0.1% pixel diff), extraction latency <5s per component, code quality/type coverage 100%, accessibility 100% axe pass, component bundle <10KB gzipped. fileciteturn0file1

---
## 1. System architecture (top-level)

```
User / Designer -> Figma (source) 
    └─▶ Extraction Service (Figma API + Token Resolver)
          └─▶ Intermediate Representations (IRS, IRT, IML)
                └─▶ Code Generator (React, Types, Styles)
                      ├─▶ Component Artifacts (component, styles, types, stories, tests, docs)
                      └─▶ Test Runner (visual diffs, accessibility, unit/e2e)
                            └─▶ Approval UI (human-in-loop)
                                  └─▶ Packaging & Publish (npm, storybook, docs)
                                        └─▶ Deployed (apps, docs, storybook hosted)
```
Components:
- **Extractor**: resilient, rate-limit aware Figma client that outputs a canonical JSON IR.
- **IR Store**: versioned storage of IRS (structure), IRT (tokens), IML (interactions).
- **Generator**: deterministic template engine to produce files from IR + policies.
- **Test Runner**: Playwright + pixelmatch + axe + jest/rtl + snapshot manager.
- **Approval UI**: lightweight web app that shows diff and proposed mapping for designer/developer approval.
- **Publisher**: bundler & registry automation (esbuild/rollup, typed definitions, CSS outputs).

Refer to detailed phases and components in your Implementation Plan. fileciteturn0file0

---
## 2. Intermediate Representations (IR) — canonical data models

Separation of concerns is critical. Use three IRs:

### 2.1 IRS — Structure (visual & DOM mapping)
Key fields:
- `meta`: name, figmaUrl, nodeId, componentType, extractedAt, sourceFileKey
- `tree`: recursive nodes with `type`, `roleHint`, `boundingBox`, `layout`, `fills`, `strokes`, `effects`, `typography`, `children`
- `variants`: list of variant dimensions + combinations
- `slots`: named insertion points inferred via auto-layout names / component properties

Example shape:
```json
{
  "meta": {...},
  "tree": [{ "id": "...", "type":"RECTANGLE", "roleHint":"button-root", "layout": {...}, "children":[...] }],
  "variants": [...],
  "slots": [...]
}
```

### 2.2 IRT — Tokens & Theming
- Map Figma variable IDs and style IDs → canonical semantic tokens (`color.primary.500`).
- Token structure includes `modes` (light/dark/highContrast), `aliases`, `sourceFile`, `usageReferences`.
- Maintain a token dependency graph for safe refactors.

### 2.3 IML — Interaction Model Layer (NEW & CRITICAL)
- Capture behavior that cannot be inferred from static pixels: hover->variant, click->state, focus->aria, keyboard mappings, typeahead behaviors, animations, aria-live semantics, role mapping.
- IML entries are rule-based and small state machines:
```json
{
  "component": "Combobox",
  "interactions": [
    { "trigger":"focus", "action":"open", "target":"listbox" },
    { "trigger":"arrowDown", "action":"selectNext", "target":"option" }
  ],
  "a11y": { "role":"combobox", "ariaControls":"listbox-id" }
}
```
- IML is populated through heuristics + component intelligence + human confirmation.

---
## 3. Extraction: design → IR (robust & pluggable)

Design extraction must be resilient, idempotent, and rate-limit aware.

### 3.1 Figma Client best practices
- Use bulk endpoints and parallelize with exponential backoff.
- Cache file metadata and image exports for repeated runs.
- Implement per-file `changeToken` checks to skip unchanged nodes.
- Use delta extraction when possible — fetch nodes changed since `extractedAt`.

### 3.2 Extraction rules & heuristics
- **Node identification**: prefer frame/component set naming conventions. Fallback to geometry heuristics for unnamed nodes.
- **Slot detection**: named layers like `label`, `icon-left`, `content` become named slots.
- **Variant detection**: map `COMPONENT_SET` properties to `variants` and expand combinations incrementally (avoid combinatorial explosion by limiting exported combinations by policy).
- **Token resolution**: for each style/variable ID, resolve to a token or create a new semantic token with a suggested name (e.g., `color.primary.500`) and provenance metadata.
- **Fallbacks**: for any feature with no CSS parity, generate a `renderHint` field with fallback strategy (pseudo-element, background-image, svg-mask).

### 3.3 Extraction output validation
- Validate `IRS` schema with JSON Schema or TypeScript runtime checks.
- Run a token sanity check: tokens referenced but not defined should be flagged as warnings.
- Ensure `IML` is present for all interactive components; if not, mark as `C1` and queue for human review.

See your extraction types and token resolver design for the deeper spec. fileciteturn0file0

---
## 4. Component Intelligence: auto-classify & policy engine

A lightweight classifier determines component category and applies generation policies:
- Use rule-based + ML heuristics (optional) to classify (Button, Card, Input, Select, Menu, Dialog, Tab, Tooltip, Banner).
- Each category has a **policy template** (props, default ARIA, allowed variants, performance budget).
- The policy engine resolves conflicts: if a node looks like both `IconButton` and `Badge`, prefer `IconButton` if it has `roleHint: button-root` or `onClick` binding in figma prototype metadata.

Add a `componentProfile` to IR: `{"category":"button","maturity":"C2","policies":[...]}`.

---
## 5. Generation rules & templates (deterministic)

### 5.1 Template engine
- Use a deterministic template engine (Handlebars, Mustache, or Nunjucks) but **no LLM outputs in templates**. LLM can suggest code patches, but templates must be strict.
- Templates produce: `Component.tsx`, `Component.types.ts`, `Component.module.css` or Tailwind token mapping, `Component.stories.tsx`, `Component.test.tsx`, `Component.mdx` docs.

### 5.2 Styling strategy
Support multi-output styling modes:
- **CSS Modules** (default, deterministic & tree-shakable)
- **Tailwind utility classes** (optional via token-to-class mapper)
- **CSS-in-JS** (emotion/styled-components) — avoid as default (performance/SSR concerns)

Prefer generating styles that reference CSS custom properties (`--color-primary-500`) mapped from tokens for runtime theming.

### 5.3 Accessibility integration
- Default to semantic HTML where possible. If component category requires advanced behavior, wrap Radix/React Aria primitives and supply generated props/states.
- Generate `aria-*` attributes from IML a11y model.
- Include `role`, `aria-label`, `aria-controls`, `aria-expanded`, `aria-hidden`, `aria-live` as needed and map to storybook knobs for review.

### 5.4 Interaction wiring
- For simple components, map variants to props (e.g., `variant="primary" size="sm"`).
- For complex components, generate a "behavior adapter" file that wires Radix primitives with styling and exposes a stable prop API.

### 5.5 Determinism & Safe Regeneration
- Include a regeneration policy:
  - `immutable` components must not be auto-overwritten.
  - `regenerable` components are overwritten with a changelog and PR.
  - Provide `componentManifest.json` with `generatedAt`, `generatorVersion`, `sourceFigmaNodeId`, `maturityLevel`.

---
## 6. Component Maturity Model (CMM)

Use this to set expectations across teams and guide human-in-the-loop triage.

| Level | Meaning | Allowed Outputs |
|-------|---------|------------------|
| C1 | Visual extraction only | Styles + static markup, no behavior, manual QA required |
| C2 | Tokenized + variants | Props + stories + basic tests, recommended human review |
| C3 | Interaction + a11y modeled | Behavior adapter with Radix primitives, accessibility checks pass |
| C4 | Production hardened | Performance optimizations, unit/e2e tests, documented API |
| C5 | Enterprise certified | SLAs, multi-brand themes, analytics & usage instrumentation |

Components progress levels with human approvals and test passes.

---
## 7. Testing & QA — automated and manual

### 7.1 Visual testing
- Engine: Playwright for deterministic screenshots.
- Diff engine: pixelmatch with region masking and semantic diffs for text.
- Strategies:
  - Per-variant sampling: if variant combinatorics explode, sample canonical variants + a "combinator set" for high-risk components.
  - Use perceptual thresholds that adapt per component (`text-heavy` components use higher tolerance than `icon-only` components).
  - Support `ignoreAreas` (dynamic timestamps/avatars) and fuzzy matching.

### 7.2 Accessibility testing
- Axe-core in CI for automatic checks.
- Storybook a11y addon for local manual audits.
- Generated tests should run:
  - Axe run in Playwright on each story
  - Keyboard-only navigation tests
  - VoiceOver/NVDA smoke scripts (scheduling human auditors for a subset per sprint)

Aim for axe baseline pass at C3.

### 7.3 Unit & Integration tests
- Generate Jest + React Testing Library tests for props & events.
- Snapshot tests are optional; prefer visual diffs.

### 7.4 Performance & bundle checks
- Generate Lighthouse CI checks for component pages; enforce per-component budget (max 10KB gzipped for pure component code, excluding shared runtime).

---
## 8. Human-in-the-loop & Approval flow

Automate everything but require human approvals for critical decisions. Flow:

1. **Auto-generate** artifacts and run tests.
2. If visual diff > threshold OR accessibility fails OR component classified `C1/C2`, create **Approval PR** to `design-system/autogen` with a rich preview.
3. Designer or frontend owner reviews in the Approval UI (side-by-side with Figma frame + generated component + diff overlays).
4. Reviewer toggles Accept / Request Change (with reason). If Accept, merge PR; pipeline publishes packages and deploys docs/storybook.

Designers get a `suggestedTokenName` UI to rename tokens before commit.

---
## 9. Token governance & convergence

Token drift is a major long-term cost. Implement:

- **Token registry**: centralized canonical token store (JSON + semantic names).
- **Convergence rules**: on ingest, if a token is close (delta < 2% luminance) to existing token, suggest aliasing rather than creating new tokens.
- **Token migration CLI**: helps refactor components to new tokens with impact analysis.
- **Mode management**: runtime modes (light/dark/high-contrast) with CSS var maps and preflight checks.

Token metadata includes `createdBy`, `createdAt`, `sourceFigmaFile`, `usageCount`, `variants`.

---
## 10. Packaging & publishing

### 10.1 Artifact outputs
- `esm` + `cjs` bundles
- `types` declarations (TS)
- `styles` (CSS variables + compiled CSS Module)
- `stories` (storybook)
- `docs` (MDX pages)
- `tests` (generated tests)

### 10.2 Publishing pipeline
- CI builds artifacts, runs tests, and opens a release PR for manual review OR automatic publish for trivial changes based on policy.
- Support multi-registry (npm public, GH packages, private registry).

### 10.3 Versioning & API stability
- Semantic versioning with `major` bumps on public API change. The generator must diff public props; breaking changes require explicit `major` policy and human approval.

---
## 11. Observability & analytics

Track usage & health:
- Instrument components to report (opt-in) usage via web analytics: which components, which variants, frequency.
- Track visual regression flakiness rates, token churn rates, extraction errors, generator error logs.
- Build dashboards: `componentCoverage`, `automationHitRate` (how often a component is fully auto-generated), `a11yPassRate`.

---
## 12. Security, privacy & legal considerations

- Avoid embedding proprietary images from Figma into public builds without approval.
- Sanitize any prototyping URLs or embedded links to avoid remote data exfiltration.
- Respect licensing for commercial fonts; support fallback fonts if licensing prevents bundling.

---
## 13. Team & roles

Suggested core team to deliver MVP → production:
- 1 Engineering Lead (system + infra)  
- 1 Product Manager (design system adoption)  
- 2 Extraction Engineers (Figma API, IR)  
- 2 Generators / SDK Engineers (TS + Template)  
- 1 QA / Test Automation Engineer (visual + a11y)  
- 1 Design Lead (token conventions + approval)  
- 1 DevRel / Docs Engineer (Docusaurus + Storybook)  

Scale to enterprise adds platform, site reliability, analytics, and governance roles.

---
## 14. Roadmap (detailed milestones)

**Weeks 0-2 — Foundation & Infra**
- Harden Figma client with caching & rate throttling.
- Implement IRS + IRT schema + resolver.
- Small POC: generate 5 components (button, input, card, modal, dropdown) manually curated.

**Weeks 3-6 — Generator v1**
- Deterministic template engine.
- CSS Modules + token mapping.
- Playwright screenshot harness.
- Storybook auto-uploads.

**Weeks 7-10 — Interaction & Accessibility**
- Build IML extraction heuristics.
- Radix-backed adapters for complex components.
- Axe CI integration and keyboard tests.
- Approval UI (designer + dev review).

**Weeks 11-14 — QA & Scale**
- Visual diff scaling strategies.
- Token convergence engine.
- Publish pipeline & semantic versioning.
- Docs + Docusaurus generator + hosting.

**Weeks 15-20 — Enterprise polish**
- Multi-brand themes, analytics, SSO for approval UI, longer-term scaling improvements.

This merges and refines the timeline in your implementation plan. fileciteturn0file0

---
## 15. Appendix — tactical checklists & templates

### 15.1 Preflight checklist (per component)
- [ ] Extracted IRS validated
- [ ] Token references resolved (IRT)
- [ ] IML rules present or flagged
- [ ] Accessibility attributes inferred (a11y baseline)
- [ ] Storybook story generated
- [ ] Playwright visual tests defined
- [ ] Axe checks configured
- [ ] Component manifest created

### 15.2 Suggested JSON Schema pointers
- Use `ajv` to validate IRS/IRT/IML; break schemas into small parts.

### 15.3 Approval UI minimal data for review
- Figma frame image + component name
- Generated component render (iframe)
- Diff overlay slider (figma vs generated)
- Token mapping suggestions & rename input
- Regenerate button with "apply suggestions"
- Accept/Request change buttons with comments

---
## Closing notes (why this will work)
Your existing vision and plan already contain 90% of the engineering work required. This unified blueprint closes the gaps I found — principally: **interaction modeling (IML)**, **component maturity model**, **token governance**, **human-in-loop approval**, and **scalability patterns** for visual testing and extraction. The combination converts your ambition into a realistic, stepwise program that can be delivered with a small, focused team while keeping enterprise constraints in mind. fileciteturn0file1 fileciteturn0file0

---
