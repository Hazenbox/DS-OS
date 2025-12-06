# Tenant Migration Guide

## Overview

This guide walks you through migrating existing user-owned data to tenant-scoped data. The migration creates a "personal" tenant for each user and associates all their existing data with that tenant.

## Prerequisites

- Convex dev server running (`npx convex dev`)
- Access to your Convex dashboard
- Backup of your data (recommended)

## Migration Steps

### Step 1: Dry Run (Preview)

First, preview what will be migrated without making any changes:

**Option A: Using Convex Dashboard**
1. Go to your Convex dashboard
2. Navigate to **Functions**
3. Find `migrations.tenantMigration.dryRun`
4. Click **Run** (no arguments needed)
5. Review the results

**Option B: Using Script**
```bash
npx tsx scripts/run-migration.ts
```

**Expected Output:**
```
Users to migrate: X
Projects to migrate: X
Tokens to migrate: X
Components to migrate: X
...
```

### Step 2: Run Migration

Once you've reviewed the dry run results, run the actual migration:

**Using Convex Dashboard:**
1. Go to **Functions**
2. Find `migrations.tenantMigration.migrate`
3. Click **Run**
4. Enter arguments: `{ "dryRun": false }`
5. Click **Run Function**

**What Happens:**
- Creates a "personal" tenant for each user (if they don't have one)
- Updates all projects with `tenantId`
- Updates all child records (tokens, components, etc.) with `tenantId`
- Updates settings with `tenantId`

### Step 3: Verify Migration

After migration completes, verify the results:

**Using Convex Dashboard:**
1. Go to **Functions**
2. Find `migrations.tenantMigration.verify`
3. Click **Run** (no arguments needed)

**Expected Output:**
```json
{
  "valid": true,
  "issues": []
}
```

If there are issues, they will be listed in the `issues` array.

## Post-Migration Steps

After successful migration:

### 1. Make tenantId Required in Schema

Update `convex/schema.ts` to make `tenantId` required (remove `v.optional`):

```typescript
// Change from:
tenantId: v.optional(v.id("tenants")), // Optional temporarily for migration

// To:
tenantId: v.id("tenants"), // Required
```

**Tables to update:**
- `projects`
- `tokens`
- `tokenFiles`
- `components`
- `activity`
- `releases`
- `settings`
- `brands`
- `figmaExtractions`

### 2. Update verifyTenantResource

Update `convex/tenantMiddleware.ts`:

```typescript
// Change from:
export async function verifyTenantResource<T extends { tenantId?: Id<"tenants"> }>

// To:
export async function verifyTenantResource<T extends { tenantId: Id<"tenants"> }>

// And remove the optional check:
// Remove this block:
if (!resource.tenantId) {
  console.warn("Resource missing tenantId - migration may be needed");
  return resource;
}
```

### 3. Deploy Changes

```bash
npx convex deploy
```

## Troubleshooting

### "No data to migrate"
- This means all data already has `tenantId` populated
- You can skip to post-migration steps

### "Error migrating user..."
- Check the error message for details
- Common issues:
  - User email is missing
  - Invalid tenant ID
  - Database constraint violations

### Verification shows issues
- Check which records are missing `tenantId`
- Re-run migration for specific users if needed
- Check for orphaned records

## Rollback

If you need to rollback:

1. **Don't delete tenants** - This will orphan data
2. **Remove tenantId** from records (set to `undefined`)
3. **Restore from backup** if needed

## Next Steps

After migration:
- ✅ All new data is tenant-scoped
- ✅ All existing data has `tenantId`
- ✅ Tenant isolation is enforced
- ⚠️ Make `tenantId` required in schema
- ⚠️ Remove temporary workarounds

See `docs/TENANT_MIGRATION_STATUS.md` for current status.

