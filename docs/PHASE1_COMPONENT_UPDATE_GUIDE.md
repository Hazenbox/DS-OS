# Phase 1: Component Update Guide

## Pattern for Updating Components

All components need to be updated to use `tenantId` from `TenantContext`. Here's the pattern:

### 1. Import TenantContext
```typescript
import { useTenant } from '../contexts/TenantContext';
```

### 2. Get tenantId and userId
```typescript
const { tenantId, userId } = useTenant();
const { projectId } = useProject();
```

### 3. Update all Convex queries to include tenantId and userId
```typescript
// Before:
const tokens = useQuery(api.tokens.list, projectId ? { projectId } : "skip");

// After:
const tokens = useQuery(
  api.tokens.list, 
  projectId && tenantId && userId 
    ? { projectId, tenantId, userId } 
    : "skip"
);
```

### 4. Update all Convex mutations to include tenantId and userId
```typescript
// Before:
await createToken({ projectId, name, value, type });

// After:
await createToken({ projectId, tenantId, userId, name, value, type });
```

## Components to Update

- [x] Dashboard.tsx
- [ ] TokenManager.tsx
- [ ] ComponentBuilder.tsx
- [ ] ReleaseManager.tsx
- [ ] Settings.tsx
- [ ] Sidebar.tsx (if it uses queries)

## Functions Updated in Backend

All backend functions now require:
- `tenantId: Id<"tenants">`
- `userId: Id<"users">`

Functions updated:
- `projects.*` - All operations
- `tokens.*` - All operations
- `tokenFiles.*` - All operations
- `components.*` - All operations
- `activity.*` - All operations
- `releases.*` - All operations
- `settings.*` - All operations
- `claudeExtraction.*` - All operations

