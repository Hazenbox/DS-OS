# Tenant Migration Status

## Current State

### ✅ Fully Tenant-Aware (Required tenantId)
These tables **require** `tenantId` and are fully multi-tenant ready:

1. **`tenants`** - Tenant records
2. **`tenantUsers`** - User-tenant relationships
3. **`tenantInvitations`** - Tenant invitations
4. **`tenantSettings`** - Tenant-specific settings
5. **`tenantQuotas`** - Resource limits per tenant
6. **`tenantUsage`** - Usage tracking per tenant
7. **`ssoConfigs`** - SSO configurations per tenant

### ⚠️ Temporary Optional tenantId (For Migration)
These 9 tables have **optional** `tenantId` temporarily to support existing data before migration:

1. **`projects`** - `tenantId: v.optional(v.id("tenants"))`
2. **`tokens`** - `tenantId: v.optional(v.id("tenants"))`
3. **`tokenFiles`** - `tenantId: v.optional(v.id("tenants"))`
4. **`components`** - `tenantId: v.optional(v.id("tenants"))`
5. **`activity`** - `tenantId: v.optional(v.id("tenants"))`
6. **`releases`** - `tenantId: v.optional(v.id("tenants"))`
7. **`settings`** - `tenantId: v.optional(v.id("tenants"))`
8. **`brands`** - `tenantId: v.optional(v.id("tenants"))`
9. **`figmaExtractions`** - `tenantId: v.optional(v.id("tenants"))`

### 🔧 Temporary Workarounds

1. **`verifyTenantResource`** function:
   - Currently allows resources with missing `tenantId` (with warning)
   - This is temporary until migration completes
   - Location: `convex/tenantMiddleware.ts:105-124`

2. **All backend functions**:
   - Require `tenantId` as parameter
   - But schema allows optional `tenantId` in existing records
   - New records should always include `tenantId`

---

## Migration Plan

### Step 1: Run Migration Script ✅ Ready
The migration script is ready at `convex/migrations/tenantMigration.ts`:

```typescript
// Dry run first
await api.migrations.tenantMigration.dryRun();

// Then run actual migration
await api.migrations.tenantMigration.migrate({ dryRun: false });

// Verify
await api.migrations.tenantMigration.verify();
```

### Step 2: After Migration Completes
Once all existing data has `tenantId` populated:

1. **Make tenantId required in schema**:
   ```typescript
   // Change from:
   tenantId: v.optional(v.id("tenants"))
   
   // To:
   tenantId: v.id("tenants")
   ```

2. **Update `verifyTenantResource`**:
   ```typescript
   // Remove the optional check
   // Make tenantId required in the type
   export async function verifyTenantResource<T extends { tenantId: Id<"tenants"> }>
   ```

3. **Enforce tenantId in all mutations**:
   - Ensure all new records always include `tenantId`
   - Add validation to reject records without `tenantId`

---

## Current Behavior

### ✅ What Works Now
- New records created through the UI include `tenantId`
- All queries and mutations require `tenantId` as parameter
- Tenant isolation is enforced for new data
- Frontend components pass `tenantId` correctly

### ⚠️ What's Temporary
- Existing records may have `null` or `undefined` `tenantId`
- `verifyTenantResource` allows missing `tenantId` (with warning)
- Schema allows optional `tenantId` for backward compatibility

---

## Post-Migration Checklist

After running the migration:

- [ ] Verify all records have `tenantId` populated
- [ ] Make `tenantId` required in schema (9 tables)
- [ ] Update `verifyTenantResource` to require `tenantId`
- [ ] Remove migration warnings
- [ ] Test tenant isolation
- [ ] Verify no orphaned records exist

---

## Risk Assessment

### Low Risk ✅
- New data is properly tenant-scoped
- All new operations require `tenantId`
- Frontend correctly passes `tenantId`

### Medium Risk ⚠️
- Existing data without `tenantId` may be accessible across tenants (until migration)
- `verifyTenantResource` warning allows access to unmigrated data

### Action Required
- **Run migration script** to populate `tenantId` for all existing records
- **Make tenantId required** after migration completes

---

## Summary

**Current State**: 
- ✅ All new operations are tenant-aware
- ⚠️ 9 tables have optional `tenantId` for migration compatibility
- ⚠️ Existing data may not have `tenantId` yet

**Next Steps**:
1. Run migration script to populate `tenantId` for existing data
2. Make `tenantId` required in schema after migration
3. Remove temporary workarounds

**Timeline**: Migration should be run before production deployment.

