# Project Management Implementation Plan

## Overview

Implement comprehensive project management features including:
- Project list view
- Rename projects
- Delete projects
- Add/remove project members
- Project roles and permissions
- Project settings

## Implementation Steps

### 1. Schema Updates
- [ ] Add `projectMembers` table for project-level access control
- [ ] Add project roles (owner, admin, editor, viewer)

### 2. Backend Functions
- [ ] Project member management (add, remove, update role)
- [ ] Project member queries (list members, check access)
- [ ] Project settings management

### 3. Frontend Components
- [ ] ProjectManagement page component
- [ ] ProjectMemberList component
- [ ] ProjectMemberModal (add/edit members)
- [ ] ProjectSettings component
- [ ] Update Sidebar to link to project management

### 4. UI Features
- [ ] Project list with actions (rename, delete, settings)
- [ ] Member list with roles
- [ ] Add member by email
- [ ] Remove member
- [ ] Update member role
- [ ] Project settings (name, description)

## Data Model

### projectMembers Table
```typescript
{
  projectId: Id<"projects">,
  tenantId: Id<"tenants">,
  userId: Id<"users">,
  role: "owner" | "admin" | "editor" | "viewer",
  addedBy: Id<"users">,
  addedAt: number,
  isActive: boolean
}
```

### Project Roles
- **owner**: Full control (delete project, manage all members)
- **admin**: Manage members, edit project settings
- **editor**: Create/edit tokens, components, releases
- **viewer**: Read-only access

## Access Control

- Project members inherit tenant access
- Project roles are in addition to tenant roles
- Most restrictive permission applies

