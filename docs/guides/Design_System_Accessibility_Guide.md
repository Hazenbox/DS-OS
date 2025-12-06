# Accessibility Architecture Guide for Your Design System

## 1. Philosophy & Principles

### WCAG 2.2 AA as the Baseline
Your design system must conform to WCAG 2.2 AA, which defines *what* accessible outcomes look like.

### Semantic HTML First
Use native HTML elements where possible for the strongest built‑in accessibility.

### ARIA APG for Complex Widgets
When native HTML cannot achieve required behaviors, follow WAI‑ARIA Authoring Practices patterns.

### Accessibility Primitives
Use Radix UI (or custom primitives) for high‑quality keyboard, focus, and ARIA behaviors.

---

## 2. Component Build Hierarchy

```
WCAG 2.2 (Policy Layer)
        ↓
ARIA APG (Behavior Standards)
        ↓
Semantic HTML (Preferred for simplicity)
        ↓
Accessibility Primitives (Radix/React Aria)
        ↓
Design System Components (Your DS)
```

---

## 3. Component Strategy

### Use Semantic HTML For:
- Buttons  
- Inputs, textareas  
- Checkboxes, radios  
- Links & navigational elements  
- Headings, lists, sections  

### Use Radix UI (or equivalent) For:
- Dialogs & modals  
- Dropdown menus  
- Comboboxes  
- Popovers, hovercards  
- Select menus  
- Tabs with roving focus  
- Tooltips  
- Toast notifications  

---

## 4. WCAG Mapping Template

Each component should document:

- **Success Criteria Covered**
  - 1.3.1 Info and Relationships  
  - 1.4.3 Contrast Minimum  
  - 2.1.1 Keyboard  
  - 2.4.7 Focus Visible  
  - 4.1.2 Name, Role, Value  

- **Keyboard Support**
  - Tab / Shift+Tab navigation  
  - Arrow keys for composite widgets  
  - Esc for dismissals  

- **Screen Reader Behavior**
  - Announcements  
  - ARIA roles/states  
  - Live regions (if needed)  

---

## 5. Tokens & Theming for Accessibility

### Required Token Categories
- Color tokens with WCAG AA contrast baked in  
- Focus ring tokens  
- Motion tokens (supports `prefers-reduced-motion`)  
- Typography scale  
- Spacing tokens for touch targets (min 44px)  

### Recommended Practices
- Provide dark‑mode contrast tokens  
- Use Tailwind presets or CSS variables for contrast consistency  

---

## 6. Anatomy of a Component Documentation Page

### Example: Dialog

**Sections:**
1. Purpose  
2. Anatomy (header, body, footer)  
3. Variants  
4. Behavior rules  
5. Keyboard interactions  
6. ARIA attributes  
7. WCAG mapping  
8. Code example  
9. Do & Don’t patterns  

---

## 7. Testing Strategy

### Automated Testing
- Axe Core CI checks  
- eslint-plugin-jsx-a11y  
- Storybook Accessibility Addon  

### Manual Testing
- Keyboard‑only testing  
- Screen readers: NVDA, JAWS, VoiceOver  
- Zoom to 200% & 400%  
- Reduced motion testing  

---

## 8. File & Folder Structure

```
design-system/
  ├── components/
  │     ├── button/
  │     │     ├── button.tsx
  │     │     └── docs.md
  │     ├── dialog/
  │     │     ├── dialog.tsx
  │     │     └── docs.md
  │     └── ...
  ├── primitives/
  │     ├── radix/
  │     └── custom/
  ├── tokens/
  │     ├── color.json
  │     ├── spacing.json
  │     └── motion.json
  └── accessibility/
        ├── guidelines.md
        ├── wcag-mapping-template.md
        └── testing-checklist.md
```

---

## 9. Implementation Checklist

- [ ] Use semantic HTML first  
- [ ] Apply ARIA roles only when needed  
- [ ] Provide visible focus states  
- [ ] Ensure color contrast AA+  
- [ ] Implement full keyboard support  
- [ ] Provide meaningful announcements  
- [ ] Document all behaviors  
- [ ] Test with assistive tools  
- [ ] Run axe CI checks  

---

## 10. Conclusion

This guide outlines the complete accessibility framework for building a world‑class design system using:

- WCAG 2.2 AA (policy)  
- ARIA APG (behavior)  
- Semantic HTML (foundation)  
- Radix UI or custom primitives (implementation)  
- Automated + manual testing (quality gate)  

Use this as the living foundation for your design system architecture.
