# Fix Orphaned Records - Interactive Checklist

**Time**: 15 minutes  
**Status**: ⏳ Ready to execute

---

## ✅ Pre-flight Check

Before starting, ensure:
- [ ] You have access to Convex Dashboard
- [ ] Your project is selected in the dashboard
- [ ] You have terminal access for deployment

---

## Step 1: Open Convex Dashboard

1. [ ] Go to [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. [ ] Select your DS-OS project
3. [ ] Click on **Functions** tab (left sidebar)

**Current Status**: ⏳ Waiting for you to open dashboard

---

## Step 2: Find Orphaned Records

1. [ ] In the Functions search bar (top), type: `migrations.fixOrphanedRecords.findOrphanedRecords`
2. [ ] Click on the function when it appears
3. [ ] Click the **Run** button (blue button)
4. [ ] Review the results in the output panel

**Expected Result**:
```json
{
  "projects": [],
  "tokens": [],
  "components": [],
  "tokenFiles": [],
  "releases": [],
  "activities": [],
  "settings": [],
  "brands": [],
  "figmaExtractions": []
}
```

**If you see empty arrays `[]`**: ✅ No orphaned records found - proceed to Step 4  
**If you see IDs in arrays**: ⚠️ Orphaned records found - proceed to Step 3

**Your Result**: 
```
[Paste your result here]
```

---

## Step 3: Fix Orphaned Records

**Only do this if Step 2 found orphaned records**

1. [ ] In the Functions search bar, type: `migrations.fixOrphanedRecords.fixOrphanedRecords`
2. [ ] Click on the function
3. [ ] Click **Run** button
4. [ ] In the **Input** field (JSON editor), enter: `{}`
5. [ ] Click **Run** again
6. [ ] Review the results

**Expected Result**:
```json
{
  "fixed": 0,
  "deleted": 0,
  "errors": []
}
```

**Your Result**:
```
[Paste your result here]
```

**Notes**:
- `fixed`: Number of records associated with tenants
- `deleted`: Number of system activities that couldn't be associated
- `errors`: Any errors encountered (should be empty)

---

## Step 4: Verify Migration

1. [ ] In the Functions search bar, type: `migrations.tenantMigration.verify`
2. [ ] Click on the function
3. [ ] Click **Run** button
4. [ ] Review the results

**Expected Result**:
```json
{
  "valid": true,
  "issues": []
}
```

**If `valid: false`**:
- [ ] Review the `issues` array
- [ ] Note any problems
- [ ] May need to run fix again or contact support

**Your Result**:
```
[Paste your result here]
```

---

## Step 5: Deploy Schema Changes

1. [ ] Open your terminal
2. [ ] Navigate to project: `cd /Users/upen/Desktop/My\ Hazen/Products/ds-os`
3. [ ] Run: `npx convex deploy`
4. [ ] Wait for deployment to complete (may take 1-2 minutes)
5. [ ] Verify no errors in output

**Expected Output**:
```
✓ Deployed functions
✓ Updated schema
✓ Deployment complete
```

**Your Output**:
```
[Paste your output here]
```

---

## ✅ Final Verification

After deployment, verify again:

1. [ ] Go back to Convex Dashboard
2. [ ] Run `migrations.tenantMigration.verify` again
3. [ ] Should still return `{valid: true, issues: []}`

---

## 🎉 Success!

If all steps completed successfully:
- ✅ All records have `tenantId`
- ✅ Schema is deployed
- ✅ System is ready for production

**Next Step**: Proceed to IR system testing
- See: `scripts/QUICK_START_TESTING.md`

---

## ❌ Troubleshooting

### Issue: Can't find function in dashboard
**Solution**: 
- Make sure you're in the correct project
- Try refreshing the page
- Check that `npx convex dev` is running (if in development)

### Issue: `fixOrphanedRecords` returns errors
**Solution**:
- Review the `errors` array
- Some records may need manual fixing
- Check if records can be associated with projects

### Issue: `verify` returns `valid: false`
**Solution**:
- Review the `issues` array
- Run `findOrphanedRecords` again to see what's still missing
- May need to run `fixOrphanedRecords` again

### Issue: Deployment fails
**Solution**:
- Check your Convex authentication: `npx convex login`
- Verify you have deployment permissions
- Check for TypeScript errors: `npm run typecheck`

---

## 📝 Notes

Use this space to document any issues or observations:

```
[Your notes here]
```

---

**Last Updated**: [Date]  
**Status**: ⏳ Ready to execute

