# DS-OS Token System Implementation Plan (for Ongoing Cursor Project)

This document is a **practical, step-by-step implementation plan** to evolve DS-OS from “load big Figma JSON” to a **market-leader style token system** (like Google, Atlassian, Microsoft, Salesforce, Uber) inside your existing Cursor-based project.

---

## 0. Goals & Constraints

**Goals**
- Stop loading 10k+ token JSON files in the browser.
- Introduce a **Token Registry + Token Compiler**.
- Generate **global theme bundles** (CSS vars + JSON).
- Generate **per-component token bundles** (tiny JSON).
- Integrate with:
  - React + TypeScript
  - Convex
  - Vercel
  - Claude + Figma extraction

---

## 1. Target Architecture Overview

```
Figma Variables (raw export)
      ↓
Token Importer (server)
      ↓
Token Registry (DB / Convex)
      ↓
Token Compiler
      ↓
Global Theme Bundles (CSS + JSON)
      ↓
Per-Component Token Bundles
      ↓
Client Runtime (React)
```

---

## 2. Recommended Folder Structure

```
/docs/system/DSOS_Token_Implementation_Plan.md

/src/schemas/tokens.ts
/src/server/tokens/importer.ts
/src/server/tokens/registry.ts
/src/server/tokens/compiler.ts
/src/server/tokens/bundles.ts

/src/client/tokens/useThemeTokens.ts
/src/client/tokens/useComponentTokens.ts

/scripts/compile-tokens.ts
```

---

## 3. Phase 1 — Token Registry (Week 1–2)

### Create `/src/schemas/tokens.ts`
```ts
export interface TokenRecord {
  id: string;
  tenantId: string;
  name: string;
  category: 'color'|'spacing'|'typography'|'radius'|'shadow'|'other';
  value: {
    raw: string;
    modes?: Record<string,string>;
  };
  aliases?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Convex Functions
- createTokensFromFigmaDump
- listTokensByTenant
- updateTokenMetadata
- mergeTokens

---

## 4. Phase 2 — Token Importer (Week 2–3)

- Parse Figma JSON.
- Normalize names → semantic tokens.
- Extract light/dark modes.
- Store in Token Registry.
- Build optional convergence script to detect duplicates.

---

## 5. Phase 3 — Token Compiler Core (Week 3–4)

### Outputs
- tokens.light.json
- tokens.light.css
- tokens.dark.json
- tokens.dark.css

### Storage Path
```
/tenants/{tenantId}/tokens/{version}/tokens.light.css
```

---

## 6. Phase 4 — Per-Component Token Bundles (Week 4–5)

- Walk IRS for token refs.
- Generate minimal JSON for each component.
- Store under:
```
/tenants/{tenantId}/components/{componentId}/tokens.v1.json
```

---

## 7. Phase 5 — Client Runtime (Week 5–6)

### Global Theme Loader
- Inject `<link>` for theme CSS at app bootstrap.

### Component Token Hook
```ts
export function useComponentTokens(componentId: string) {}
```

---

## 8. Phase 6 — Remove Direct Figma JSON Usage (Week 6–7)

- No client fetches raw Figma exports.
- Figma data becomes backend-only input.

---

## 9. Phase 7 — Performance & Caching (Week 7–8)

- CDN for token bundles.
- HTTP cache headers.
- Gzip/brotli compression.
- Server caching for registry lookups.

---

## 10. Cursor Task Breakdown

1. token-registry-schema
2. token-importer
3. token-compiler-global
4. component-token-bundles
5. client-theme-loader
6. client-component-loader
7. remove-raw-figma-usage

---

## 11. Definition of Done

- ✅ No 10k token JSON in browser  
- ✅ Tokens live in registry  
- ✅ Theme CSS served via CDN  
- ✅ Per-component token bundles active  
- ✅ Runtime uses CSS variables  
- ✅ Component load time significantly improved  

---

This architecture is **identical to market leaders** (Google, Atlassian, Microsoft, Salesforce, Uber) and is safe for enterprise-scale DS-OS deployment.
