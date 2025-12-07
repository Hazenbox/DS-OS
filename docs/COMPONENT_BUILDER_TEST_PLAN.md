# Component Builder Test Plan - 100% UI Matching Verification

**Goal**: Test and verify the component builder's ability to generate 100% matching UI from Figma components.

---

## 🎯 Test Objectives

1. **Verify Extraction Completeness**: All Figma properties are captured
2. **Verify Code Generation**: Generated code matches design visually
3. **Identify Gaps**: Find any missing properties or rendering issues
4. **Measure Fidelity**: Use visual diff to measure actual percentage

---

## 📋 Pre-Test Checklist

### Prerequisites
- [ ] Figma Personal Access Token configured
- [ ] Claude API Key configured (optional, for fallback)
- [ ] Project created in DS-OS
- [ ] Token files uploaded (optional, for token matching)
- [ ] Test Figma component URL ready

### Test Component Requirements

**Recommended Test Components** (in order of complexity):

1. **Simple Button** (Start here)
   - Single fill color
   - Basic typography
   - Corner radius
   - One variant (e.g., primary/secondary)

2. **Complex Button**
   - Multiple variants (size, state, style)
   - Gradients
   - Shadows
   - Icons

3. **Input Field**
   - States (default, focus, error, disabled)
   - Placeholder text
   - Icons (left/right)
   - Validation states

4. **Card Component**
   - Multiple children
   - Auto-layout
   - Images
   - Typography hierarchy

5. **Complex Component**
   - Nested structures
   - Vector graphics
   - Gradients
   - Blend modes
   - Multiple effects

---

## 🧪 Test Procedure

### Step 1: Extract Component

1. **Go to Builder tab** in DS-OS
2. **Paste Figma component URL**
   - Format: `https://www.figma.com/file/{fileKey}/...?node-id={nodeId}`
   - Or: `https://www.figma.com/design/{fileKey}/...?node-id={nodeId}`
3. **Click "Extract & Build"**
4. **Wait for extraction** (10-30 seconds)

### Step 2: Verify Extraction

**Check Console Logs** (Convex Dashboard → Logs):
- ✅ IRS extraction: Should show node count, variants, slots
- ✅ IRT extraction: Should show token matches
- ✅ IML extraction: Should show component classification
- ✅ Code generation: Should show "Generated code using deterministic templates"

**Check Extracted Data**:
- ✅ Component name extracted correctly
- ✅ Variants detected
- ✅ Properties extracted
- ✅ No extraction errors

### Step 3: Review Generated Code

**Inspect Tab** → Check:

1. **TypeScript Types**:
   - [ ] Props interface matches component properties
   - [ ] Variant types are correct
   - [ ] Optional props marked correctly

2. **React Component**:
   - [ ] Component structure matches Figma hierarchy
   - [ ] All children rendered
   - [ ] Props passed correctly
   - [ ] Event handlers present (if interactive)

3. **CSS Styles**:
   - [ ] All fills converted to CSS
   - [ ] Gradients match Figma
   - [ ] Strokes converted
   - [ ] Effects (shadows, blur) converted
   - [ ] Typography matches
   - [ ] Layout (auto-layout) converted
   - [ ] Spacing/padding matches

### Step 4: Visual Comparison

**Preview Tab** → Compare with Figma:

1. **Layout**:
   - [ ] Dimensions match
   - [ ] Spacing matches
   - [ ] Alignment matches
   - [ ] Padding matches

2. **Visual Properties**:
   - [ ] Colors match
   - [ ] Gradients match
   - [ ] Strokes match
   - [ ] Corner radius matches
   - [ ] Shadows match
   - [ ] Opacity matches

3. **Typography**:
   - [ ] Font family matches
   - [ ] Font size matches
   - [ ] Font weight matches
   - [ ] Line height matches
   - [ ] Letter spacing matches
   - [ ] Text alignment matches

4. **Variants**:
   - [ ] All variants render correctly
   - [ ] Variant switching works
   - [ ] Variant styles match Figma

### Step 5: Run Visual Diff Test

1. **Create a release** with the component
2. **Click "Run Tests"**
3. **Wait for visual diff** to complete
4. **Check diff percentage**:
   - ✅ < 1% = Excellent (99%+ fidelity)
   - ⚠️ 1-5% = Good (95-99% fidelity)
   - ❌ > 5% = Needs improvement

### Step 6: Identify Issues

**If diff > 1%, check**:

1. **Missing Properties**:
   - Check Convex logs for extraction warnings
   - Compare extracted IRS with Figma
   - Check if any properties are null/undefined

2. **CSS Generation Issues**:
   - Check if gradients are correct
   - Verify blend modes (may need workarounds)
   - Check if effects are applied correctly

3. **Rendering Differences**:
   - Font rendering (expected, browser vs Figma)
   - Sub-pixel positioning (expected)
   - Anti-aliasing (expected)

---

## 📊 Test Results Template

### Component: [Component Name]
**Figma URL**: [URL]
**Test Date**: [Date]

#### Extraction Results
- **IRS Nodes**: [count]
- **Variants**: [count]
- **Slots**: [count]
- **Token Matches**: [count]
- **Component Type**: [button/input/etc]

#### Visual Diff Results
- **Diff Percentage**: [X]%
- **Status**: ✅ Pass / ⚠️ Warning / ❌ Fail
- **Issues Found**: [List]

#### Property Coverage
- **Fills**: ✅ / ⚠️ / ❌
- **Strokes**: ✅ / ⚠️ / ❌
- **Effects**: ✅ / ⚠️ / ❌
- **Typography**: ✅ / ⚠️ / ❌
- **Layout**: ✅ / ⚠️ / ❌
- **Variants**: ✅ / ⚠️ / ❌

#### Notes
[Any observations, issues, or improvements needed]

---

## 🔍 What to Look For

### ✅ Success Indicators

1. **Extraction**:
   - All nodes extracted
   - All properties captured
   - No missing data

2. **Code Generation**:
   - Code compiles without errors
   - Preview renders correctly
   - Styles match visually

3. **Visual Fidelity**:
   - < 1% diff = Excellent
   - 1-3% diff = Very Good
   - 3-5% diff = Good (acceptable)

### ⚠️ Warning Signs

1. **Extraction Issues**:
   - Missing nodes in IRS
   - Null/undefined properties
   - Extraction errors in logs

2. **Code Issues**:
   - Syntax errors
   - Missing styles
   - Incorrect CSS

3. **Visual Issues**:
   - > 5% diff
   - Obvious visual mismatches
   - Missing elements

### ❌ Failure Indicators

1. **Extraction Fails**:
   - Component not found
   - API errors
   - Timeout errors

2. **Code Generation Fails**:
   - Component doesn't compile
   - Preview doesn't render
   - Critical styles missing

3. **Visual Mismatch**:
   - > 10% diff
   - Major layout issues
   - Colors completely wrong

---

## 🎯 Expected Results

### Realistic Expectations

**100% Pixel-Perfect**: ❌ **Not Possible**
- Browser rendering differs from Figma
- Font rendering varies by platform
- Sub-pixel positioning differences
- Anti-aliasing algorithms differ

**99.9% Visual Fidelity**: ✅ **Target**
- Visually indistinguishable to human eye
- < 1% pixel diff
- Acceptable for production

**95-99% Fidelity**: ✅ **Good**
- Minor differences visible on close inspection
- Acceptable for most use cases
- May need minor adjustments

---

## 🐛 Common Issues & Solutions

### Issue: Missing Properties

**Symptoms**: Properties show as null/undefined in extracted data

**Solutions**:
1. Check Figma API response in logs
2. Verify node has the property in Figma
3. Check if property is in a child node
4. Verify Figma PAT has read access

### Issue: Gradients Don't Match

**Symptoms**: Gradient colors or direction incorrect

**Solutions**:
1. Check gradient extraction in IRS
2. Verify gradient transform matrix
3. Check CSS gradient generation
4. Test with simpler gradient first

### Issue: Layout Doesn't Match

**Symptoms**: Spacing, alignment, or sizing incorrect

**Solutions**:
1. Check auto-layout extraction
2. Verify padding/spacing values
3. Check constraints extraction
4. Verify flexbox CSS generation

### Issue: Typography Doesn't Match

**Symptoms**: Font size, weight, or spacing incorrect

**Solutions**:
1. Check font family is available
2. Verify font size extraction
3. Check line height calculation
4. Verify letter spacing

---

## 📈 Improvement Process

### If Diff > 1%

1. **Identify the Gap**:
   - Use visual diff image to see differences
   - Check which properties are off
   - Review extraction logs

2. **Fix Extraction** (if needed):
   - Update `irsExtraction.ts` to capture missing property
   - Test extraction again

3. **Fix Code Generation** (if needed):
   - Update `codeGenerator.ts` CSS generation
   - Test code generation again

4. **Re-test**:
   - Extract component again
   - Run visual diff again
   - Verify improvement

---

## ✅ Test Completion Criteria

A component passes if:

1. ✅ **Extraction**: All properties extracted successfully
2. ✅ **Code Generation**: Code compiles and renders
3. ✅ **Visual Fidelity**: < 5% diff (or < 1% for production)
4. ✅ **Functionality**: Variants work, interactions work (if applicable)

---

## 📝 Test Report Template

After testing, document results:

```markdown
# Component Builder Test Report

## Test Summary
- **Date**: [Date]
- **Components Tested**: [Count]
- **Average Fidelity**: [X]%
- **Status**: ✅ Pass / ⚠️ Partial / ❌ Fail

## Component Results

### [Component 1]
- **Figma URL**: [URL]
- **Diff**: [X]%
- **Status**: ✅ / ⚠️ / ❌
- **Issues**: [List]

### [Component 2]
...

## Overall Assessment
[Summary of findings]

## Recommendations
[What needs improvement]
```

---

**Ready to Test?** Follow the procedure above with a real Figma component!

