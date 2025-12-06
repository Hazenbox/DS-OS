# DS-OS Implementation Plan

## 🚀 Immediate Next Steps (Priority Order)

### Phase 1: Perfect Extraction (2 weeks)

#### 1.1 Enhanced Figma API Integration

**Current State:** Basic property extraction with Claude generating code
**Target State:** Comprehensive extraction with structured intermediate representation

```typescript
// File: convex/extraction/figmaExtractor.ts

interface ExtractionResult {
  // Component metadata
  meta: {
    name: string;
    figmaUrl: string;
    nodeId: string;
    type: 'COMPONENT' | 'COMPONENT_SET' | 'FRAME';
    extractedAt: string;
  };
  
  // Visual properties (100% coverage)
  visual: {
    fills: Fill[];
    strokes: Stroke[];
    effects: Effect[];
    cornerRadius: CornerRadius;
    opacity: number;
    blendMode: string;
  };
  
  // Layout properties
  layout: {
    type: 'AUTO_LAYOUT' | 'ABSOLUTE' | 'FIXED';
    direction: 'HORIZONTAL' | 'VERTICAL';
    gap: number;
    padding: Padding;
    alignment: Alignment;
    sizing: Sizing;
  };
  
  // Typography (for text layers)
  typography?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: LineHeight;
    letterSpacing: number;
    textAlign: TextAlign;
    textDecoration: TextDecoration;
    textTransform: TextTransform;
  };
  
  // Component variants
  variants: Variant[];
  
  // Design tokens used
  tokens: TokenReference[];
  
  // Child elements (recursive)
  children: ExtractionResult[];
}
```

**Tasks:**
- [ ] Create `ExtractionResult` type definitions
- [ ] Implement comprehensive Figma REST API client
- [ ] Handle all fill types (solid, gradients, images)
- [ ] Handle all stroke configurations (inside, center, outside, dashed)
- [ ] Extract all effect types (shadows, blurs)
- [ ] Parse auto-layout properties completely
- [ ] Resolve Figma variables to token references
- [ ] Handle component variants and properties

#### 1.2 Token Resolution System

```typescript
// File: convex/extraction/tokenResolver.ts

interface TokenResolver {
  // Resolve Figma variable ID to token
  resolveVariable(variableId: string): Token;
  
  // Resolve Figma style ID to token
  resolveStyle(styleId: string): Token;
  
  // Generate CSS custom property name
  toCssVariable(token: Token): string;
  
  // Handle token modes (light/dark)
  resolveModeValue(token: Token, mode: string): string;
}

// Example output
const tokenMapping = {
  'VariableID:123': {
    name: 'color.primary.500',
    cssVar: '--color-primary-500',
    values: {
      'light': '#6366f1',
      'dark': '#818cf8',
    },
  },
};
```

**Tasks:**
- [ ] Fetch Figma variables via API
- [ ] Map variable IDs to semantic names
- [ ] Generate CSS custom property names
- [ ] Handle variable modes (themes)
- [ ] Create token dependency graph

---

### Phase 2: Production Code Generation (2 weeks)

#### 2.1 Code Generator Architecture

```typescript
// File: src/services/codeGenerator/index.ts

interface CodeGenerator {
  // Generate from extraction result
  generate(extraction: ExtractionResult): GeneratedComponent;
}

interface GeneratedComponent {
  // Main component
  component: {
    filename: string;
    code: string;
  };
  
  // Styles
  styles: {
    filename: string;
    code: string;
    format: 'css-modules' | 'tailwind' | 'styled-components';
  };
  
  // Types
  types: {
    filename: string;
    code: string;
  };
  
  // Story
  story: {
    filename: string;
    code: string;
  };
  
  // Tests
  tests: {
    filename: string;
    code: string;
  };
}
```

#### 2.2 React Component Template

```typescript
// Template for generated components
const componentTemplate = `
import React, { forwardRef } from 'react';
import type { {{ComponentName}}Props } from './{{ComponentName}}.types';
import styles from './{{ComponentName}}.module.css';
import { clsx } from 'clsx';

{{#if hasVariants}}
const variantStyles = {
  {{#each variants}}
  '{{name}}': styles['variant-{{name}}'],
  {{/each}}
};
{{/if}}

export const {{ComponentName}} = forwardRef<{{ElementType}}, {{ComponentName}}Props>(
  (
    {
      {{#each props}}
      {{name}}{{#if default}} = {{default}}{{/if}},
      {{/each}}
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <{{element}}
        ref={ref}
        className={clsx(
          styles.root,
          {{#if hasVariants}}
          variant && variantStyles[variant],
          {{/if}}
          className
        )}
        {{#each ariaProps}}
        {{name}}={{value}}
        {{/each}}
        {...props}
      >
        {{#each slots}}
        {{#if this.conditional}}
        {{{this.name}} && <span className={styles.{{this.name}}}>{{{this.name}}}</span>}
        {{else}}
        <span className={styles.{{this.name}}}>{{{this.content}}}</span>
        {{/if}}
        {{/each}}
        {children}
      </{{element}}>
    );
  }
);

{{ComponentName}}.displayName = '{{ComponentName}}';
`;
```

#### 2.3 CSS Generation

```typescript
// CSS generator with full property support
class CSSGenerator {
  generateStyles(extraction: ExtractionResult): string {
    const rules: string[] = [];
    
    // Root styles
    rules.push(this.generateRootStyles(extraction));
    
    // Variant styles
    for (const variant of extraction.variants) {
      rules.push(this.generateVariantStyles(variant));
    }
    
    // State styles (hover, focus, active, disabled)
    rules.push(this.generateStateStyles(extraction));
    
    // Responsive styles
    rules.push(this.generateResponsiveStyles(extraction));
    
    return rules.join('\n\n');
  }
  
  private generateRootStyles(extraction: ExtractionResult): string {
    const properties: string[] = [];
    
    // Layout
    if (extraction.layout.type === 'AUTO_LAYOUT') {
      properties.push('display: flex');
      properties.push(`flex-direction: ${this.mapDirection(extraction.layout.direction)}`);
      properties.push(`gap: ${extraction.layout.gap}px`);
      properties.push(this.generatePadding(extraction.layout.padding));
      properties.push(this.generateAlignment(extraction.layout.alignment));
    }
    
    // Visual
    properties.push(this.generateFills(extraction.visual.fills));
    properties.push(this.generateStrokes(extraction.visual.strokes));
    properties.push(this.generateEffects(extraction.visual.effects));
    properties.push(this.generateCornerRadius(extraction.visual.cornerRadius));
    
    // Typography
    if (extraction.typography) {
      properties.push(this.generateTypography(extraction.typography));
    }
    
    return `.root {\n  ${properties.filter(Boolean).join(';\n  ')};\n}`;
  }
}
```

**Tasks:**
- [ ] Create component template engine
- [ ] Implement CSS generator with all properties
- [ ] Generate TypeScript types from variants
- [ ] Add accessibility attributes automatically
- [ ] Support multiple styling approaches (CSS Modules, Tailwind)

---

### Phase 3: Quality Assurance (2 weeks)

#### 3.1 Visual Regression Testing

```typescript
// File: src/services/visualTesting/index.ts

interface VisualTestRunner {
  // Capture component screenshot
  capture(component: GeneratedComponent): Promise<Screenshot>;
  
  // Export Figma node as image
  exportFigma(nodeId: string): Promise<Screenshot>;
  
  // Compare screenshots
  compare(actual: Screenshot, expected: Screenshot): ComparisonResult;
  
  // Generate report
  report(results: ComparisonResult[]): TestReport;
}

interface ComparisonResult {
  match: boolean;
  diffPercentage: number;
  diffImage?: Buffer;
  details: {
    colorDiff: number;
    layoutDiff: number;
    typographyDiff: number;
  };
}
```

#### 3.2 Accessibility Testing

```typescript
// Automatic accessibility checks
interface AccessibilityChecker {
  // Run axe-core on component
  audit(component: GeneratedComponent): AccessibilityReport;
  
  // Check specific rules
  rules: {
    colorContrast: boolean;
    keyboardNavigation: boolean;
    ariaLabels: boolean;
    focusIndicators: boolean;
    semanticStructure: boolean;
  };
}
```

**Tasks:**
- [ ] Set up Playwright for screenshot capture
- [ ] Integrate with Figma Image Export API
- [ ] Implement pixel-diff comparison
- [ ] Add axe-core for accessibility
- [ ] Create quality dashboard in UI

---

### Phase 4: Storybook Integration (1 week)

#### 4.1 Story Generator

```typescript
// Auto-generate Storybook stories
class StoryGenerator {
  generate(extraction: ExtractionResult): string {
    return `
import type { Meta, StoryObj } from '@storybook/react';
import { ${extraction.meta.name} } from './${extraction.meta.name}';

const meta: Meta<typeof ${extraction.meta.name}> = {
  title: 'Components/${this.getCategory(extraction)}/${extraction.meta.name}',
  component: ${extraction.meta.name},
  tags: ['autodocs'],
  parameters: {
    design: {
      type: 'figma',
      url: '${extraction.meta.figmaUrl}',
    },
    layout: 'centered',
  },
  argTypes: {
    ${this.generateArgTypes(extraction.variants)}
  },
};

export default meta;
type Story = StoryObj<typeof ${extraction.meta.name}>;

${this.generateStories(extraction.variants)}
`;
  }
}
```

#### 4.2 Storybook Configuration

```typescript
// .storybook/main.ts
const config: StorybookConfig = {
  stories: ['../src/components/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-designs',
    '@chromatic-com/storybook',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};
```

**Tasks:**
- [ ] Create story template generator
- [ ] Generate argTypes from variants
- [ ] Add Figma design link plugin
- [ ] Configure Chromatic for visual review
- [ ] Set up story organization

---

### Phase 5: Documentation (1 week)

#### 5.1 Docusaurus Generator

```typescript
// Generate MDX documentation
class DocsGenerator {
  generate(extraction: ExtractionResult, story: string): string {
    return `
---
title: ${extraction.meta.name}
description: ${this.generateDescription(extraction)}
---

import { ${extraction.meta.name} } from '@design-system/components';
import { Canvas, Controls } from '@storybook/blocks';

# ${extraction.meta.name}

${this.generateDescription(extraction)}

## Usage

\`\`\`tsx
import { ${extraction.meta.name} } from '@design-system/components';

<${extraction.meta.name} ${this.generateDefaultProps(extraction)}>
  Label
</${extraction.meta.name}>
\`\`\`

## Props

<Controls />

## Variants

${this.generateVariantDocs(extraction.variants)}

## Accessibility

${this.generateA11yDocs(extraction)}

## Design Tokens

${this.generateTokenDocs(extraction.tokens)}
`;
  }
}
```

#### 5.2 Docusaurus Customization

```typescript
// docusaurus.config.ts customization options
interface DocsCustomization {
  // Theme
  theme: {
    primaryColor: string; // From design tokens
    fontFamily: string;   // From design tokens
  };
  
  // Sidebar
  sidebar: {
    categories: string[]; // Auto from component categories
    collapsed: boolean;
  };
  
  // Features
  features: {
    codePlayground: boolean;   // Live code editing
    figmaEmbed: boolean;       // Embed Figma frames
    tokenViewer: boolean;      // Token documentation
    changelog: boolean;        // Version history
  };
  
  // Custom domain
  deployment: {
    domain: string;
    basePath: string;
  };
}
```

**Tasks:**
- [ ] Create MDX template generator
- [ ] Set up Docusaurus project
- [ ] Implement token documentation
- [ ] Add live playground
- [ ] Configure custom theming

---

### Phase 6: NPM Publishing (1 week)

#### 6.1 Package Builder

```typescript
// Build publishable package
class PackageBuilder {
  async build(components: GeneratedComponent[]): Promise<Package> {
    // 1. Bundle components
    const bundles = await this.bundle(components);
    
    // 2. Generate type definitions
    const types = await this.generateTypes(components);
    
    // 3. Create package.json
    const packageJson = this.createPackageJson(components);
    
    // 4. Build CSS bundle
    const styles = await this.bundleStyles(components);
    
    return {
      esm: bundles.esm,
      cjs: bundles.cjs,
      types,
      styles,
      packageJson,
    };
  }
}
```

#### 6.2 Package.json Template

```json
{
  "name": "@{{org}}/{{package-name}}",
  "version": "{{version}}",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/types/index.d.ts",
  "sideEffects": ["*.css"],
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./styles": "./dist/styles/index.css"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

**Tasks:**
- [ ] Set up Rollup/esbuild bundler
- [ ] Generate TypeScript declarations
- [ ] Create package.json generator
- [ ] Implement publish workflow
- [ ] Support GitHub Packages & npm

---

## 📊 Implementation Timeline

```
Week 1-2: Phase 1 - Extraction
├── Enhanced Figma API
├── Token Resolution
└── Intermediate Representation

Week 3-4: Phase 2 - Code Generation
├── Component Templates
├── CSS Generation
└── Type Generation

Week 5-6: Phase 3 - Quality
├── Visual Testing
├── Accessibility
└── Performance

Week 7: Phase 4 - Storybook
├── Story Generation
├── Chromatic Setup
└── Addon Configuration

Week 8: Phase 5 - Documentation
├── Docusaurus Setup
├── MDX Generation
└── Token Docs

Week 9: Phase 6 - Publishing
├── Package Builder
├── NPM Setup
└── CI/CD Pipeline

Week 10+: Phase 7 - Polish
├── Custom Domains
├── Team Features
└── Analytics
```

---

## 🔑 Key Files to Create/Modify

### New Files

```
convex/
├── extraction/
│   ├── figmaExtractor.ts    # Enhanced Figma API client
│   ├── tokenResolver.ts     # Variable → Token mapping
│   └── types.ts             # Extraction type definitions

src/
├── services/
│   ├── codeGenerator/
│   │   ├── index.ts         # Main generator
│   │   ├── templates/       # Code templates
│   │   ├── cssGenerator.ts  # CSS generation
│   │   └── typeGenerator.ts # TypeScript types
│   ├── visualTesting/
│   │   ├── index.ts         # Screenshot comparison
│   │   └── reporter.ts      # Test reports
│   └── publishing/
│       ├── storybook.ts     # Story generation
│       ├── docusaurus.ts    # Docs generation
│       └── npm.ts           # Package publishing

templates/
├── component.hbs            # Component template
├── story.hbs                # Storybook template
├── docs.mdx.hbs             # Documentation template
└── test.hbs                 # Test template
```

### Modified Files

```
src/components/ComponentBuilder.tsx  # UI updates
convex/claudeExtraction.ts          # Enhanced extraction
convex/schema.ts                    # New tables
```

---

## ✅ Success Criteria

| Milestone | Success Metric |
|-----------|----------------|
| Extraction | All Figma properties captured |
| Code Gen | Clean, readable, typed code |
| Visual Match | < 0.1% pixel difference |
| Accessibility | 100% axe-core pass |
| Storybook | All variants documented |
| Docs | Complete API reference |
| Publishing | One-click deploy |

---

## 🎯 Immediate Action Items

1. **Today**: Review and approve this plan
2. **Week 1**: Start Phase 1 - Enhanced Extraction
3. **Daily**: Track progress against milestones
4. **Weekly**: Demo progress and gather feedback

