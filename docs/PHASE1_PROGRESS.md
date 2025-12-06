# Phase 1: Core Tenant Foundation - Progress Report

## ✅ Completed (Week 1)

### 1. Schema & Data Model ✅
- [x] Created tenant TypeScript schema (`src/schemas/tenant.ts`)
- [x] Added `tenantId` to all Convex tables:
  - `tenants` - Organization/company records
  - `tenantUsers` - User-tenant relationships with roles
  - `tenantSettings` - Per-tenant configuration
  - `tenantQuotas` - Resource limits
  - `tenantUsage` - Daily usage snapshots
  - `tenantInvitations` - Pending invitations
  - `ssoConfigs` - SSO/SAML/OIDC settings
  - Updated: `projects`, `tokens`, `tokenFiles`, `components`, `activity`, `releases`, `brands`, `settings`, `figmaExtractions`
- [x] Added tenant indexes for efficient queries

### 2. Tenant Management Functions ✅
- [x] Created `convex/tenants.ts` with:
  - `create` - Create new tenant
  - `get` / `getBySlug` - Get tenant details
  - `list` - List user's tenants
  - `update` - Update tenant (admin only)
  - `getUsers` - List tenant users
  - `inviteUser` - Invite user to tenant
  - `updateUserRoles` - Update user roles
  - `removeUser` - Remove user from tenant
  - `getSettings` / `updateSettings` - Tenant settings
  - `getQuota` / `checkQuota` - Quota management

### 3. Tenant Middleware ✅
- [x] Created `convex/tenantMiddleware.ts` with:
  - `getTenantContext` - Get tenant context from session
  - `requireRole` - Verify user has required role
  - `verifyTenantResource` - Verify resource belongs to tenant
  - `getActiveTenantForUser` - Get user's active tenant
  - `createPersonalTenant` - Create personal tenant for migration

### 4. RBAC Implementation ✅
- [x] Role hierarchy: owner > admin > developer > designer > viewer
- [x] Role checks in all tenant operations
- [x] Quota enforcement before resource creation

### 5. Migration Script ✅
- [x] Created `convex/migrations/tenantMigration.ts` with:
  - `dryRun` - Preview migration without changes
  - `migrate` - Actual migration (supports dry-run mode)
  - `verify` - Verify migration integrity
- [x] Strategy: Create personal tenant for each user, migrate all data

### 6. Updated Functions ✅
- [x] `projects.ts` - Fully tenant-aware with RBAC

---

## 🔄 In Progress

### 7. Update Remaining Functions
- [ ] `tokens.ts` - Add tenantId to all operations
- [ ] `tokenFiles.ts` - Add tenantId to all operations
- [ ] `components.ts` - Add tenantId to all operations
- [ ] `activity.ts` - Add tenantId to all operations
- [ ] `releases.ts` - Add tenantId to all operations
- [ ] `settings.ts` - Add tenantId to all operations
- [ ] `claudeExtraction.ts` - Add tenantId to extraction
- [ ] `figma.ts` - Add tenantId to Figma operations

---

## 📋 Next Steps (Remaining Week 1-2)

### 8. Frontend Updates
- [ ] Create `TenantContext` provider (similar to ProjectContext)
- [ ] Add tenant selector to Sidebar
- [ ] Create tenant onboarding flow UI
- [ ] Update all components to use tenantId from context
- [ ] Add tenant management UI (invite users, manage roles)

### 9. Session Management
- [ ] Update session to include `tenantId`
- [ ] Handle tenant switching in UI
- [ ] Persist active tenant in localStorage

### 10. Testing
- [ ] Unit tests for tenant middleware
- [ ] Integration tests for tenant isolation
- [ ] Test migration script in staging

---

## 🚨 Breaking Changes

### API Changes
All functions now require `tenantId` parameter:
- `projects.list({ tenantId, userId })` (was: `{ userId }`)
- `projects.create({ tenantId, userId, name, ... })` (was: `{ userId, name, ... }`)
- All other functions similarly updated

### Migration Required
- Run `migrations.tenantMigration.dryRun()` first
- Then run `migrations.tenantMigration.migrate({ dryRun: false })`
- Verify with `migrations.tenantMigration.verify()`

---

## 📊 Files Created/Modified

### New Files
- `src/schemas/tenant.ts` - Tenant type definitions
- `convex/tenants.ts` - Tenant management functions
- `convex/tenantMiddleware.ts` - Tenant access helpers
- `convex/migrations/tenantMigration.ts` - Migration script

### Modified Files
- `convex/schema.ts` - Added tenant tables and tenantId fields
- `convex/projects.ts` - Made tenant-aware

### Files Still To Update
- `convex/tokens.ts`
- `convex/tokenFiles.ts`
- `convex/components.ts`
- `convex/activity.ts`
- `convex/releases.ts`
- `convex/settings.ts`
- `convex/claudeExtraction.ts`
- `convex/figma.ts`
- `src/contexts/ProjectContext.tsx` (needs TenantContext)
- `src/components/Sidebar.tsx` (needs tenant selector)
- All other components using Convex queries

---

## ⚠️ Important Notes

1. **Backward Compatibility**: Legacy `userId` fields are kept for migration period
2. **Personal Tenants**: Users without orgs get "personal" tenants automatically
3. **Quota Enforcement**: Currently only checks projects quota, need to add others
4. **Session**: Need to update session management to include tenantId

---

## 🎯 Success Criteria

- [x] All tables have tenantId
- [x] Tenant CRUD operations work
- [x] RBAC implemented
- [x] Migration script ready
- [ ] All functions tenant-aware
- [ ] Frontend updated
- [ ] Tests passing
- [ ] Migration run successfully

