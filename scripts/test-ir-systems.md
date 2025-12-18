# IR System Testing Guide

**Estimated Time**: 1-2 days  
**Purpose**: Validate IRS/IRT/IML extraction with real Figma components

---

## Test Components Checklist

Create a test plan with these component types:

### ✅ Basic Components
- [ ] Simple button (no variants)
- [ ] Button with variants (size, color, state)
- [ ] Text input field
- [ ] Textarea

### ✅ Complex Components
- [ ] Component with multiple variants (button: size × color × state)
- [ ] Component with slots (button with icon + label)
- [ ] Component set with many variants

### ✅ Advanced Features
- [ ] Component with vector graphics (SVG paths)
- [ ] Component with text on path
- [ ] Component with complex gradients (linear, radial, angular)
- [ ] Component with blend modes
- [ ] Component with image fills

### ✅ Token Integration
- [ ] Component using Figma variables (single mode)
- [ ] Component using Figma variables (multi-mode: light/dark)
- [ ] Component with token aliases (chains)
- [ ] Component with semantic tokens

---

## Testing Process

### 1. Prepare Test Components

1. Open Figma
2. Create or select components matching the checklist above
3. For each component:
   - Note the Figma URL
   - Note the node ID
   - Document expected behavior

### 2. Test IRS Extraction

For each component:

1. **Extract Component**:
   - Go to Component Builder
   - Paste Figma URL
   - Click "Extract Component"
   - Wait for extraction to complete

2. **Verify IRS Structure**:
   - Check **Inspect** tab
   - Verify:
     - ✅ Node tree structure matches Figma
     - ✅ Layout properties extracted (auto-layout, constraints)
     - ✅ Visual properties extracted (fills, strokes, effects)
     - ✅ Typography extracted correctly
     - ✅ Variants detected (if applicable)
     - ✅ Slots detected (if applicable)

3. **Document Issues**:
   - Note any missing properties
   - Note any incorrect values
   - Take screenshots of discrepancies

### 3. Test IRT Extraction

For components with Figma variables:

1. **Verify Token Mapping**:
   - Check **Inspect** tab → Tokens section
   - Verify:
     - ✅ All Figma variables detected
     - ✅ Semantic names inferred correctly
     - ✅ Multi-mode values extracted
     - ✅ Token aliases resolved (chains)
     - ✅ Token dependency graph built

2. **Test Multi-Mode Tokens**:
   - Switch between light/dark modes in Figma
   - Verify tokens update correctly
   - Check mode-specific values

3. **Document Issues**:
   - Note any unmapped variables
   - Note any incorrect semantic names
   - Note any alias resolution failures

### 4. Test IML Extraction

For interactive components:

1. **Verify Component Classification**:
   - Check component category (button, input, etc.)
   - Verify confidence score
   - Check required primitives detected

2. **Verify ARIA Mappings**:
   - Check ARIA attributes in generated code
   - Verify role, labels, describedBy, etc.
   - Test with screen reader (optional)

3. **Verify Keyboard Mappings**:
   - Check keyboard event handlers
   - Test Tab, Enter, Escape, Arrow keys
   - Verify focus management

4. **Verify Interaction Rules**:
   - Check state transitions
   - Test hover, focus, pressed states
   - Verify event handlers

5. **Document Issues**:
   - Note incorrect classifications
   - Note missing ARIA attributes
   - Note keyboard navigation problems

### 5. Test Code Generation

1. **Verify Generated Code**:
   - Check **Code** tab
   - Verify:
     - ✅ TypeScript types generated
     - ✅ Component code compiles
     - ✅ CSS variables used correctly
     - ✅ Variants handled properly
     - ✅ Slots rendered correctly

2. **Test Preview**:
   - Check **Preview** tab
   - Verify:
     - ✅ Component renders correctly
     - ✅ Visual appearance matches Figma
     - ✅ Interactive states work
     - ✅ Responsive behavior (if applicable)

3. **Test Token Overrides**:
   - Try using `tokenOverrides` prop
   - Verify runtime token changes work
   - Test with different token values

---

## Test Results Template

For each component, document:

```markdown
## Component: [Name]

**Figma URL**: [URL]  
**Node ID**: [ID]  
**Test Date**: [Date]

### IRS Extraction
- [ ] Node tree: ✅/❌
- [ ] Layout: ✅/❌
- [ ] Visual properties: ✅/❌
- [ ] Typography: ✅/❌
- [ ] Variants: ✅/❌
- [ ] Slots: ✅/❌

**Issues Found**: [List issues]

### IRT Extraction
- [ ] Token mapping: ✅/❌
- [ ] Semantic names: ✅/❌
- [ ] Multi-mode: ✅/❌
- [ ] Aliases: ✅/❌

**Issues Found**: [List issues]

### IML Extraction
- [ ] Classification: ✅/❌
- [ ] ARIA: ✅/❌
- [ ] Keyboard: ✅/❌
- [ ] Interactions: ✅/❌

**Issues Found**: [List issues]

### Code Generation
- [ ] TypeScript: ✅/❌
- [ ] Rendering: ✅/❌
- [ ] Preview: ✅/❌

**Issues Found**: [List issues]
```

---

## Common Issues & Fixes

### Issue: Missing node properties
**Fix**: Check if node type is supported in `irsExtraction.ts`

### Issue: Token not mapped
**Fix**: Check variable naming in Figma, verify `irtExtraction.ts` logic

### Issue: Incorrect component classification
**Fix**: Review `componentIntelligence.ts` classification rules

### Issue: ARIA attributes missing
**Fix**: Check `imlExtraction.ts` ARIA mapping logic

### Issue: Preview not rendering
**Fix**: Check Sandpack console for errors, verify dependencies

---

## Success Criteria

✅ All basic components extract correctly  
✅ Complex components handle variants/slots  
✅ Vector graphics render properly  
✅ Multi-mode tokens work correctly  
✅ Component classification is accurate  
✅ ARIA attributes are correct  
✅ Generated code compiles and runs  
✅ Preview matches Figma design

---

## Next Steps After Testing

1. **Fix Issues Found**:
   - Update extraction functions
   - Improve classification logic
   - Enhance error handling

2. **Re-test Fixed Components**:
   - Verify fixes work
   - Test edge cases

3. **Document Learnings**:
   - Update extraction specs
   - Add new test cases
   - Improve documentation

---

**Note**: Keep a log of all test results for future reference and regression testing.

