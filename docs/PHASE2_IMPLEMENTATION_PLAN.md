# Phase 2: Enterprise Auth (SSO/SCIM) - Implementation Plan

**Status:** 🚀 Starting  
**Timeline:** Weeks 4-8  
**Priority:** High (Enterprise readiness)

---

## 📋 Overview

Phase 2 implements enterprise-grade authentication and user provisioning:
- **OIDC SSO**: Single Sign-On via OIDC (Okta, Azure AD, Google Workspace)
- **SAML SSO**: Optional SAML 2.0 support
- **SCIM v2**: Automated user provisioning and deprovisioning
- **Tenant Admin Console**: UI for SSO/SCIM configuration
- **Branding & Domains**: Custom tenant branding and domain configuration

---

## 🎯 Goals

1. Enable enterprise customers to use their existing identity providers
2. Automate user provisioning/deprovisioning via SCIM
3. Support Just-in-Time (JIT) provisioning
4. Provide tenant admins with easy SSO/SCIM configuration
5. Enable custom branding and domain configuration

---

## 📦 Implementation Tasks

### Task 1: OIDC SSO Connector ⭐ (Start Here)

**Priority:** High  
**Estimated Time:** 1-2 weeks

#### Backend Implementation

1. **OIDC Configuration Storage**
   - Update `ssoConfigs` table to store OIDC settings:
     - `clientId` (encrypted)
     - `clientSecret` (encrypted)
     - `issuerUrl`
     - `authorizationEndpoint`
     - `tokenEndpoint`
     - `userInfoEndpoint`
     - `scopes` (array)
     - `redirectUri`

2. **OIDC Authentication Flow**
   - Create `convex/sso/oidc.ts`:
     - `initiateLogin` - Generate state/nonce, redirect to IdP
     - `handleCallback` - Validate callback, exchange code for tokens
     - `getUserInfo` - Fetch user info from IdP
     - `validateToken` - Validate ID token

3. **Session Management**
   - Link IdP `sub` to `TenantUser.externalId`
   - Create DS-OS session tied to `tenantId`
   - Support JIT provisioning (auto-create users on first SSO login)

4. **Security**
   - Encrypt client secrets (use Convex secrets or external KMS)
   - Validate state/nonce to prevent CSRF
   - Verify token signatures
   - Handle token refresh

#### Frontend Implementation

1. **SSO Configuration UI**
   - Create `src/components/SSOConfig.tsx`:
     - Form for OIDC provider details
     - Test connection button
     - Enable/disable SSO toggle
     - Redirect URI display

2. **SSO Login Button**
   - Add SSO login option to login page
   - Show SSO button if tenant has SSO configured
   - Handle SSO redirect flow

#### Files to Create/Update

- `convex/sso/oidc.ts` - OIDC authentication logic
- `convex/sso/config.ts` - SSO configuration management
- `src/components/SSOConfig.tsx` - SSO configuration UI
- `src/components/Login.tsx` - Add SSO login option
- Update `convex/schema.ts` - Ensure `ssoConfigs` table is complete

---

### Task 2: SCIM v2 Provisioning Endpoints

**Priority:** High  
**Estimated Time:** 1-2 weeks

#### Backend Implementation

1. **SCIM v2 Endpoints** (`convex/scim/`)
   - `GET /scim/v2/Users` - List users
   - `GET /scim/v2/Users/:id` - Get user
   - `POST /scim/v2/Users` - Create user
   - `PUT /scim/v2/Users/:id` - Update user
   - `PATCH /scim/v2/Users/:id` - Partial update
   - `DELETE /scim/v2/Users/:id` - Delete user
   - `GET /scim/v2/Groups` - List groups (optional)
   - `GET /scim/v2/ServiceProviderConfig` - SCIM capabilities

2. **SCIM to DS-OS Mapping**
   - Map SCIM `externalId` → `TenantUser.externalId`
   - Map SCIM groups → DS-OS roles
   - Map SCIM attributes → `TenantUser` fields

3. **SCIM Authentication**
   - Bearer token authentication
   - Per-tenant SCIM tokens (stored encrypted)
   - Validate SCIM requests

4. **SCIM Event Logging**
   - Log all SCIM operations for debugging
   - Store in `scimEvents` table

#### Files to Create

- `convex/scim/users.ts` - SCIM Users endpoints
- `convex/scim/groups.ts` - SCIM Groups endpoints (optional)
- `convex/scim/config.ts` - SCIM configuration
- `convex/scim/events.ts` - SCIM event logging
- Update `convex/schema.ts` - Add `scimEvents` table

---

### Task 3: Tenant Admin Console UI

**Priority:** Medium  
**Estimated Time:** 1 week

#### UI Components

1. **SSO Configuration Page**
   - OIDC provider setup form
   - SAML configuration (if implemented)
   - Test connection functionality
   - Enable/disable SSO

2. **SCIM Configuration Page**
   - Generate SCIM token
   - Display SCIM endpoint URLs
   - SCIM event logs viewer
   - Group-to-role mapping configuration

3. **Branding Configuration**
   - Logo upload
   - Primary color picker
   - Favicon upload
   - Preview

4. **Domain Configuration** (Future)
   - Custom domain setup
   - CNAME instructions
   - SSL certificate status

#### Files to Create

- `src/components/admin/SSOConfig.tsx` - SSO configuration
- `src/components/admin/SCIMConfig.tsx` - SCIM configuration
- `src/components/admin/BrandingConfig.tsx` - Branding settings
- `src/components/admin/AdminSettings.tsx` - Main admin settings page
- Update `src/App.tsx` - Add admin settings route

---

### Task 4: SAML SSO Connector (Optional)

**Priority:** Low (if needed)  
**Estimated Time:** 1-2 weeks

#### Implementation

1. **SAML Configuration**
   - Metadata XML upload
   - Certificate storage
   - Entity ID configuration

2. **SAML Authentication Flow**
   - SAML request generation
   - SAML response validation
   - Attribute mapping

#### Files to Create

- `convex/sso/saml.ts` - SAML authentication logic
- Update `convex/sso/config.ts` - Add SAML config

---

### Task 5: Session Handling & JIT Provisioning

**Priority:** High  
**Estimated Time:** 3-5 days

#### Implementation

1. **Update Auth Flow**
   - Link IdP `sub` to `TenantUser.externalId`
   - Support JIT user creation
   - Map IdP groups to DS-OS roles

2. **Session Management**
   - Create sessions tied to `tenantId`
   - Handle SSO session refresh
   - Support multiple tenants per user

#### Files to Update

- `convex/auth.ts` - Update authentication logic
- `convex/sessions.ts` - Update session creation
- `convex/tenants.ts` - Add JIT user creation

---

### Task 6: Testing & Documentation

**Priority:** High  
**Estimated Time:** 1 week

#### Testing

1. **Unit Tests**
   - OIDC token validation
   - SCIM endpoint handlers
   - User provisioning logic

2. **Integration Tests**
   - End-to-end SSO flow
   - SCIM provisioning flow
   - JIT user creation

3. **Manual Testing**
   - Test with Okta (OIDC)
   - Test with Azure AD (OIDC)
   - Test with Google Workspace (OIDC)
   - Test SCIM with Okta/Azure AD

#### Documentation

1. **Admin Guide**
   - How to configure OIDC SSO
   - How to configure SCIM
   - Troubleshooting guide

2. **Developer Guide**
   - SSO implementation details
   - SCIM endpoint specifications
   - Security considerations

---

## 🔐 Security Considerations

1. **Secret Management**
   - Encrypt all client secrets
   - Use Convex secrets or external KMS
   - Never log secrets

2. **Token Validation**
   - Verify token signatures
   - Validate token expiration
   - Check token audience and issuer

3. **CSRF Protection**
   - Use state/nonce for OIDC
   - Validate SAML request IDs

4. **SCIM Security**
   - Bearer token authentication
   - Rate limiting on SCIM endpoints
   - Audit logging

---

## 📊 Success Criteria

- [ ] OIDC SSO works with at least one IdP (Okta/Azure AD/Google)
- [ ] SCIM v2 endpoints implemented and tested
- [ ] JIT provisioning works for new users
- [ ] Tenant Admin Console UI functional
- [ ] Integration tests pass
- [ ] Documentation complete
- [ ] Security review completed

---

## 🚀 Next Steps

1. **Start with Task 1** (OIDC SSO Connector)
2. **Implement Task 5** (Session Handling) in parallel
3. **Then Task 2** (SCIM v2)
4. **Then Task 3** (Admin Console UI)
5. **Finally Task 6** (Testing & Documentation)

---

## 📝 Notes

- OIDC is recommended first (simpler, more common)
- SAML can be added later if needed
- SCIM is critical for enterprise customers
- JIT provisioning reduces admin overhead
- Security is paramount - review all auth flows

