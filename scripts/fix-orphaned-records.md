# Fix Orphaned Records - Step-by-Step Guide

**Estimated Time**: 15 minutes  
**Location**: Convex Dashboard

---

## Step 1: Open Convex Dashboard

1. Go to [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your project
3. Navigate to **Functions** tab

---

## Step 2: Find Orphaned Records

1. In the Functions search bar, type: `fixOrphanedRecords.findOrphanedRecords`
2. Click on the function
3. Click **Run** button
4. Review the results:
   - Should show arrays of orphaned records (if any)
   - Empty arrays `[]` means no orphaned records found

**Expected Output**:
```json
{
  "orphanedActivities": [],
  "orphanedSettings": [],
  "orphanedReleases": []
}
```

---

## Step 3: Fix Orphaned Records

1. In the Functions search bar, type: `fixOrphanedRecords.fixOrphanedRecords`
2. Click on the function
3. Click **Run** button
4. In the input field, enter: `{}`
5. Click **Run** again
6. Review the results:
   - Should show count of fixed records
   - Or message that no records needed fixing

**Expected Output**:
```json
{
  "fixed": 0,
  "deleted": 0,
  "message": "No orphaned records found"
}
```

---

## Step 4: Verify Migration

1. In the Functions search bar, type: `tenantMigration.verify`
2. Click on the function
3. Click **Run** button
4. **Expected Output**:
```json
{
  "valid": true,
  "issues": []
}
```

If `valid: false`, review the `issues` array and fix them.

---

## Step 5: Deploy Schema Changes

1. Open your terminal
2. Navigate to project directory: `cd /Users/upen/Desktop/My\ Hazen/Products/ds-os`
3. Run: `npx convex deploy`
4. Wait for deployment to complete
5. Verify no errors in the output

---

## Troubleshooting

### If orphaned records are found:
- The fix script will:
  - Associate records with their project's tenant (if possible)
  - Delete system activities that can't be associated

### If verification fails:
- Check the `issues` array for specific problems
- Some records may need manual intervention
- Contact support if issues persist

---

## Success Criteria

✅ `findOrphanedRecords` returns empty arrays  
✅ `fixOrphanedRecords` reports 0 fixed/deleted  
✅ `tenantMigration.verify` returns `{valid: true}`  
✅ `npx convex deploy` completes without errors

---

**Next Step**: After fixing orphaned records, proceed to IR system testing.

