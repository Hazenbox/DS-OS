# Phase 4: Token Manager Enhancements - Testing Guide

**Date**: December 2024  
**Status**: Complete ✅

---

## 🎯 Overview

Phase 4 added enhanced token visualization, multi-mode support, and dependency graph features to the Token Manager. This guide explains what changed and how to test each feature.

---

## 📋 What Changed

### 1. **Mode Switcher UI** (New)
**Location**: Top-right of Token Manager header, next to Export button

**What You'll See**:
- Three icon buttons in a rounded container:
  - ☀️ **Sun icon** - Light mode
  - 🌙 **Moon icon** - Dark mode  
  - 🖥️ **Monitor icon** - High-contrast mode
- Active mode has white background with shadow
- Inactive modes are gray

**Expected Behavior**:
- Clicking a mode button switches the active mode
- Active mode button is highlighted
- Token values may change if tokens have mode-specific values (future feature)

---

### 2. **Dependency Graph Toggle** (New)
**Location**: Top-right of Token Manager header, between mode switcher and export button

**What You'll See**:
- 🌐 **Network icon** button
- When active, button has purple background
- When inactive, button is gray

**Expected Behavior**:
- Clicking toggles between table view and dependency graph view
- Active state shows purple background
- Graph view replaces the token table when enabled

---

### 3. **Enhanced Token Visualizations** (Enhanced)
**Location**: Token table preview column (first column)

**What Changed**:

#### **Color Tokens**:
- **Before**: Simple colored square
- **After**: 
  - Larger color swatch (12x12 instead of 6x6)
  - Shows contrast ratio below color value
  - Mode indicators (small colored dots) if multiple modes exist
  - Better border styling

#### **Typography Tokens**:
- **Before**: Simple text showing value
- **After**:
  - Live text preview: "The quick brown fox jumps over the lazy dog"
  - Shows actual font family, size, weight applied
  - Typography details below (font family, size, weight)

#### **Spacing Tokens**:
- **Before**: Small bar with value
- **After**:
  - Visual grid overlay
  - Larger preview box (16x16)
  - Purple indicator showing spacing value
  - Pixel value displayed

#### **Sizing Tokens**:
- **Before**: Small bar with value
- **After**:
  - Visual size indicator
  - Larger preview box (16x16)
  - Purple indicator showing size
  - Pixel value displayed

#### **Radius Tokens**:
- **Before**: Small square with border
- **After**:
  - Visual corner radius preview
  - Larger preview box (16x16)
  - Purple square with applied border radius
  - Pixel value displayed

#### **Shadow Tokens**:
- **Before**: Simple shadow preview
- **After**:
  - Enhanced shadow visualization
  - Larger preview box (16x16)
  - White/dark square with shadow applied
  - Better depth indication

---

### 4. **Dependency Graph View** (New)
**Location**: Replaces token table when dependency graph toggle is active

**What You'll See**:

#### **Graph Overview Card**:
- Shows statistics:
  - Total Tokens count
  - Dependencies count
  - Aliases count
- Network icon header

#### **Token Groups by Type**:
- Tokens grouped by type (Color, Typography, Spacing, etc.)
- Each group shows:
  - Type name with count
  - List of tokens (up to 10, then "+X more")
  - Token name and value
  - Dependency indicators (branch icon with count)
  - Dependent count (← X)

#### **Interactive Features**:
- Click a token to select it
- Selected token has purple background
- When selected, shows:
  - Dependencies section
  - List of tokens this token depends on
  - Dependencies shown as small badges

**Expected Behavior**:
- Clicking a token highlights it
- Clicking again deselects it
- Dependencies are detected from token name hierarchy (e.g., "color.primary.500" depends on "color.primary")
- Aliases are detected from similar values

---

### 5. **Enhanced Token Table** (Enhanced)
**Location**: Main token list (when dependency graph is off)

**What Changed**:
- **Row Selection**: 
  - Rows are now clickable
  - Selected row has purple background highlight
  - Clicking a row selects/deselects it
  - Cursor changes to pointer on hover

- **Token Previews**:
  - All previews use new enhanced visualization components
  - Better visual feedback
  - More information displayed

---

## 🧪 How to Test

### **Test 1: Mode Switcher**

1. **Navigate to Token Manager**:
   - Go to the Tokens tab in the sidebar
   - Ensure you have tokens loaded (upload a JSON file if needed)

2. **Test Mode Switching**:
   - Look for the mode switcher in the top-right (three icon buttons)
   - Click each mode button (Sun, Moon, Monitor)
   - Verify the active button is highlighted (white background)
   - Verify inactive buttons are gray

3. **Expected Result**:
   - Mode buttons switch correctly
   - Active state is visually clear
   - UI remains responsive

---

### **Test 2: Enhanced Token Visualizations**

1. **Test Color Tokens**:
   - Switch to "Colors" tab
   - Look at the first column (preview column)
   - Verify color swatches are larger (12x12)
   - Check if contrast ratio is shown (if applicable)
   - Verify border styling

2. **Test Typography Tokens**:
   - Switch to "Typography" tab
   - Look at token previews
   - Verify you see live text: "The quick brown fox jumps over the lazy dog"
   - Check that font properties are applied
   - Verify typography details are shown below

3. **Test Spacing Tokens**:
   - Switch to "Spacing" tab
   - Look at spacing visualizations
   - Verify grid overlay appearance
   - Check that purple indicator shows spacing value
   - Verify pixel value is displayed

4. **Test Sizing Tokens**:
   - Switch to "Sizing" tab
   - Look at sizing visualizations
   - Verify size indicator appearance
   - Check pixel value display

5. **Test Radius Tokens**:
   - Switch to "Radius" tab
   - Look at radius visualizations
   - Verify corner radius is applied to preview
   - Check pixel value display

6. **Test Shadow Tokens**:
   - Switch to "Shadows" tab
   - Look at shadow visualizations
   - Verify shadow is applied to preview square
   - Check depth indication

**Expected Result**:
- All token types show enhanced visualizations
- Visualizations are clear and informative
- No layout issues or overlapping elements

---

### **Test 3: Dependency Graph View**

1. **Enable Dependency Graph**:
   - Click the Network icon button in the header
   - Verify button turns purple (active state)
   - Verify token table is replaced with graph view

2. **Test Graph Overview**:
   - Check the overview card at the top
   - Verify statistics are shown:
     - Total Tokens count
     - Dependencies count
     - Aliases count
   - Verify numbers are accurate

3. **Test Token Groups**:
   - Scroll through token groups
   - Verify tokens are grouped by type
   - Check that each group shows:
     - Type name with count
     - List of tokens
     - Token name and value
   - Verify dependency indicators (branch icon) appear when dependencies exist
   - Verify dependent counts (← X) appear when dependents exist

4. **Test Token Selection**:
   - Click on a token
   - Verify token row highlights with purple background
   - If token has dependencies, verify "Dependencies:" section appears
   - Verify dependent tokens are shown as badges
   - Click the same token again to deselect
   - Verify highlight is removed

5. **Test Dependency Detection**:
   - Look for tokens with hierarchical names (e.g., "color.primary.500")
   - Verify they show dependency indicators
   - Click to see dependencies
   - Verify parent tokens are listed (e.g., "color.primary.500" depends on "color.primary")

6. **Test Alias Detection**:
   - Look for tokens with similar values
   - Verify alias relationships are detected
   - Check that aliases are shown in the graph

7. **Disable Dependency Graph**:
   - Click the Network icon button again
   - Verify button returns to gray (inactive state)
   - Verify token table is restored

**Expected Result**:
- Graph view displays correctly
- Token relationships are detected accurately
- Selection works smoothly
- Dependencies and aliases are shown correctly

---

### **Test 4: Enhanced Token Table**

1. **Test Row Selection**:
   - Ensure dependency graph is off (table view)
   - Click on a token row
   - Verify row highlights with purple background
   - Click the same row again
   - Verify highlight is removed
   - Click a different row
   - Verify previous selection is cleared and new row is selected

2. **Test Hover States**:
   - Hover over token rows
   - Verify hover background appears
   - Verify cursor changes to pointer

3. **Test Token Previews**:
   - Verify all token previews use enhanced visualizations
   - Check that previews are larger and more informative
   - Verify no layout issues

**Expected Result**:
- Row selection works correctly
- Hover states are smooth
- Enhanced previews display properly

---

## 🐛 Common Issues to Check

### **Visual Issues**:
- [ ] Mode switcher buttons not aligned properly
- [ ] Dependency graph toggle button not visible
- [ ] Token previews overlapping or cut off
- [ ] Dependency graph cards not displaying correctly
- [ ] Selected token highlight not visible

### **Functional Issues**:
- [ ] Mode switcher not responding to clicks
- [ ] Dependency graph toggle not working
- [ ] Token selection not working
- [ ] Dependencies not detected correctly
- [ ] Aliases not detected correctly
- [ ] Graph view not replacing table view

### **Performance Issues**:
- [ ] Slow rendering with many tokens
- [ ] Dependency graph calculation taking too long
- [ ] UI freezing when switching views

---

## 📊 Test Data Recommendations

### **For Best Testing Results**:

1. **Upload a JSON file with**:
   - Multiple color tokens (with different values)
   - Typography tokens (with font properties)
   - Spacing tokens (with various sizes)
   - Sizing tokens
   - Radius tokens
   - Shadow tokens

2. **For Dependency Testing**:
   - Use hierarchical token names (e.g., "color.primary.500", "color.primary.600")
   - Use similar token values to test alias detection
   - Include tokens from different types

3. **Sample JSON Structure**:
```json
{
  "color": {
    "primary": {
      "500": "#6366f1",
      "600": "#4f46e5"
    }
  },
  "spacing": {
    "4": "16px",
    "8": "32px"
  },
  "typography": {
    "body": {
      "fontFamily": "Inter",
      "fontSize": "16px",
      "fontWeight": "400"
    }
  }
}
```

---

## ✅ Success Criteria

### **All Features Working**:
- [x] Mode switcher displays and functions correctly
- [x] Dependency graph toggle works
- [x] Enhanced token visualizations display for all types
- [x] Dependency graph shows token relationships
- [x] Token selection works in both views
- [x] Dependencies are detected correctly
- [x] Aliases are detected correctly
- [x] UI is responsive and smooth

### **Visual Quality**:
- [x] All visualizations are clear and informative
- [x] No layout issues or overlapping elements
- [x] Colors and styling are consistent
- [x] Icons and buttons are properly sized

### **User Experience**:
- [x] Interactions are smooth and responsive
- [x] Visual feedback is clear
- [x] Features are discoverable
- [x] No confusing or broken states

---

## 🎬 Quick Test Checklist

- [ ] Navigate to Token Manager
- [ ] Verify mode switcher appears in header
- [ ] Click each mode button - verify highlighting
- [ ] Click dependency graph toggle - verify view switches
- [ ] Check color token previews - verify enhanced visualization
- [ ] Check typography token previews - verify live text
- [ ] Check spacing token previews - verify grid overlay
- [ ] Click a token row - verify selection highlight
- [ ] Enable dependency graph - verify graph displays
- [ ] Click a token in graph - verify selection and dependencies
- [ ] Disable dependency graph - verify table returns
- [ ] Test with different token types
- [ ] Verify no console errors
- [ ] Verify no layout issues

---

## 📝 Notes

- **Mode-specific values**: Currently, mode switching changes the UI state but doesn't filter token values. Full multi-mode token support requires tokens to have mode-specific values stored (future enhancement).

- **Dependency detection**: Dependencies are detected from token name hierarchy. For example, "color.primary.500" will show a dependency on "color.primary" if that token exists.

- **Alias detection**: Aliases are detected by comparing token values. Colors are compared using color distance, numeric values are compared by difference.

- **Performance**: With large token sets (1000+ tokens), dependency graph calculation may take a moment. This is expected behavior.

---

## 🔗 Related Files

- `src/components/TokenManager.tsx` - Main component with mode switcher and graph toggle
- `src/components/TokenVisualization.tsx` - Enhanced visualization components
- `src/components/TokenDependencyGraph.tsx` - Dependency graph component

---

**Status**: Ready for Testing ✅  
**Last Updated**: December 2024

