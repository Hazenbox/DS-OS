# Quick Start: Testing IR Systems

**Time**: 15-30 minutes per component

---

## Step 1: Fix Orphaned Records (One-time)

Follow: `scripts/fix-orphaned-records.md`

---

## Step 2: Test Your First Component

### Option A: Using Component Builder UI

1. **Open Component Builder**:
   - Navigate to Component Builder in the app
   - Select your project

2. **Extract a Component**:
   - Paste a Figma URL (must include `node-id=...`)
   - Click "Extract Component"
   - Wait for extraction to complete

3. **Review Results**:
   - **Inspect Tab**: Check IRS/IRT/IML data
   - **Code Tab**: Review generated code
   - **Preview Tab**: Verify rendering

### Option B: Using Convex Dashboard (Automated Testing)

1. **Open Convex Dashboard**:
   - Go to [dashboard.convex.dev](https://dashboard.convex.dev)
   - Select your project
   - Go to **Functions** tab

2. **Run Test Function**:
   - Search: `testIRSystems.testAllIR`
   - Click **Run**
   - Enter:
   ```json
   {
     "figmaUrl": "https://figma.com/file/...?node-id=...",
     "tenantId": "your-tenant-id",
     "userId": "your-user-id",
     "projectId": "your-project-id"
   }
   ```
   - Click **Run**

3. **Review Results**:
   ```json
   {
     "allPassed": true,
     "results": {
       "irs": { "success": true, "irsNodes": 5, ... },
       "irt": { "success": true, "tokensFound": 10, ... },
       "iml": { "success": true, "category": "button", ... }
     }
   }
   ```

---

## Step 3: Test Checklist

For each component, verify:

### ✅ IRS (Structure)
- [ ] Node tree extracted
- [ ] Layout properties correct
- [ ] Visual properties (colors, strokes) correct
- [ ] Typography extracted
- [ ] Variants detected (if applicable)
- [ ] Slots detected (if applicable)

### ✅ IRT (Tokens)
- [ ] Figma variables mapped
- [ ] Semantic names inferred
- [ ] Multi-mode values extracted
- [ ] Token aliases resolved

### ✅ IML (Interactions)
- [ ] Component classified correctly
- [ ] ARIA attributes present
- [ ] Keyboard mappings correct
- [ ] States extracted

### ✅ Code Generation
- [ ] TypeScript compiles
- [ ] Component renders
- [ ] Preview matches Figma

---

## Step 4: Document Issues

Create a test log:

```markdown
# Test Log - [Date]

## Component: Button Primary
**Figma URL**: https://figma.com/...
**Status**: ✅ Pass / ❌ Fail

**Issues**:
- [List any issues found]

## Component: Input Field
**Figma URL**: https://figma.com/...
**Status**: ✅ Pass / ❌ Fail

**Issues**:
- [List any issues found]
```

---

## Recommended Test Components

Start with these (easiest to hardest):

1. **Simple Button** (5 min)
   - No variants, no tokens
   - Tests basic IRS extraction

2. **Button with Variants** (10 min)
   - Size × Color variants
   - Tests variant matrix extraction

3. **Input Field** (10 min)
   - With label and helper text
   - Tests slot detection

4. **Component with Tokens** (15 min)
   - Uses Figma variables
   - Tests IRT extraction

5. **Complex Component** (20 min)
   - Multiple variants, tokens, slots
   - Tests full pipeline

---

## Getting Help

If you encounter issues:

1. Check the **Inspect** tab for detailed IR data
2. Check browser console for errors
3. Review `scripts/test-ir-systems.md` for detailed testing guide
4. Check validation errors (should show in extraction progress)

---

**Next**: After testing, fix any issues found and re-test.

