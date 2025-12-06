
# DS-OS Enterprise Transition Plan — Multi-Tenant Roadmap & Implementation Guide

**Purpose:** This document is a single-source, comprehensive plan to convert DS-OS from a single-user/small-team tool into a production-grade, multi-tenant SaaS platform suitable for enterprise customers. It contains priorities, architecture patterns, step-by-step implementation tasks, timelines, migration plans, security/compliance requirements, Cursor tasks, and DoD checklists.

**Audience:** Engineering Leads, Platform Engineers, Product Managers, Security, DevOps, Cursor automation agents.

---

## Executive Summary

You're evolving DS-OS into a multi-tenant platform where companies can sign up, create design systems, and generate component libraries, Storybooks, and documentation. The highest-priority foundational work is tenantization (tenant model, tenant middleware, row-level isolation), then enterprise-grade auth (SSO/SCIM), billing & quotas, and finally per-tenant artifacts (Storybook, docs, npm packages). Security, compliance, and observability run in parallel.

Estimated time to enterprise-readiness (core features): 3–6 months with a focused team. Staged rollout recommended.

---

# Table of Contents

1. Priorities & Phases (High-level)
2. Architecture & Multi-Tenancy Patterns
3. Tenant Data Model & TypeScript Schemas
4. Implementation Roadmap (Phases & Tasks)
5. Migration Plan (current single-user data → tenant model)
6. Security, Compliance & Operational Controls
7. SSO / SCIM Implementation Details
8. Billing, Quotas & Metering Design
9. Per-Tenant Artifacts: Storybook, Docs & NPM
10. CI/CD and Release Strategy (per-tenant)
11. Observability & SLOs
12. Cursor Task List (detailed actionable tasks)
13. Definitions of Done (DoD), Checklists & Acceptance Criteria
14. Appendix: Example Convex middleware & pseudocode
15. Next steps — recommended immediate actions

---

## 1. Priorities & Phases (High-level)

**Phase 1 — Core Tenant Foundation (Weeks 1–4)**  
- Tenant model + TenantUser + Roles  
- Tenant middleware + row-level checks  
- Tenant-aware secrets & storage prefixes  
- Data migration plan & initial migrations

**Phase 2 — Enterprise Auth (Weeks 4–8)**  
- OIDC + SAML SSO connectors  
- SCIM v2 provisioning endpoints  
- Tenant Admin Console (SSO/SCIM UI, branding, domains)

**Phase 3 — Billing, Quotas & Metering (Weeks 8–12)**  
- Usage metering & snapshotting  
- Quota enforcement + notifications  
- Billing integration (Stripe/Chargebee), trial flows

**Phase 4 — Per-Tenant Artifacts (Weeks 12–18)**  
- Storybook & Docusaurus generation per tenant  
- Private package publishing (registry or GitHub Packages)  
- Custom domain, CNAME & TLS handling

**Phase 5 — Compliance, Security, Observability (Weeks 18–24)**  
- GDPR & data export/delete flows  
- SOC2 readiness checklist & documentation  
- Per-tenant SLOs and dashboards

Parallel tasks: design token governance, IR improvements, IML expansion, visual regression per tenant.

---

## 2. Architecture & Multi-Tenancy Patterns

### Recommendation: Start with **Shared Application, Logical Tenancy** (single codebase, tenantId in all DB records), with plan to offer Per-tenant storage separation and isolated deployments for enterprise customers later.

**Key rules:**
- All persisted objects MUST include `tenantId`. Enforce in DB layer/middleware.
- Use middleware to derive `tenantId` from authenticated session — **never** accept tenantId from client payload.
- Storage (S3) prefixes: `s3://dsos-assets/tenants/{tenantId}/...`
- Tenant secrets stored encrypted per tenant (KMS).
- Background jobs and queues must be tenant-aware and rate-limited per tenant.
- Deploy feature flags for tenant-level opt-in/opt-out for heavy features (e.g., visual regression baseline compute).

**Tradeoffs:**
- Shared app is simpler and cheaper; suitable for early growth.
- Provide path to per-tenant schema or isolated deployments for customers needing compliance.

---

## 3. Tenant Data Model & TypeScript Schemas

Drop into `/src/schemas/tenant.ts` (or equivalent). Example (simplified):

```ts
export type TenantId = string;
export type UserId = string;
export type RoleName = 'owner'|'admin'|'developer'|'designer'|'viewer'|'billing';

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  createdAt: string;
  plan?: string;
  region?: string;
  status?: 'active'|'suspended'|'deleted'|'pending';
  metadata?: Record<string, any>;
}

export interface TenantSettings {
  defaultTokenPolicy?: 'enforceSemantic'|'allowCustom';
  allowPublicSharing?: boolean;
  storageBucket?: string;
  retentionDays?: number;
  allowedDomains?: string[];
  customBrand?: { logoUrl?: string; primaryColor?: string; favicon?: string; };
}

export interface TenantUser {
  id: UserId;
  tenantId: TenantId;
  email: string;
  displayName?: string;
  roles: RoleName[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  externalId?: string; // SCIM / SSO mapping
}
```

**DB considerations**
- Add indexes on `tenantId` for all collections.
- Consider separate logical DB schema or table prefix per tenant for faster cleanup/export.
- Store historical audit logs in a separate append-only store (with tenantId).

---

## 4. Implementation Roadmap (Phases & Tasks — Detailed)

### Phase 1 — Core Tenant Foundation (Weeks 1–4)

**Tasks**
1. Schema changes:
   - Add `tenantId` field to all documents: projects, tokens, tokenFiles, components, releases, activities, settings.
2. Backend middleware:
   - Implement server middleware to attach `tenantId` & `userId` from session token.
   - Enforce tenant-level checks on every DB operation.
3. Tenant onboarding API:
   - `POST /api/tenants` (create tenant)
   - `POST /api/tenants/:id/invite` (invite user)
4. Role-based access:
   - Implement RBAC logic (owner/admin/dev/designer/viewer).
5. Storage isolation:
   - S3/GCS bucket prefixes per tenant.
6. Secrets:
   - Move Figma PATs / Claude keys to tenant-scoped secrets encrypted with KMS.
7. Data migration plan:
   - Script to convert user-owned projects into `tenantId = user:{userId}` or to prompt for tenant creation.
8. Tests:
   - Unit & integration tests for tenant enforcement.

**Deliverables**
- Tenant schema + migrations
- Middleware & unit tests
- Test tenants seeded for QA

---

### Phase 2 — Enterprise Auth (Weeks 4–8)

**Tasks**
1. SSO connectors:
   - Implement OIDC provider flow (common for Okta, Azure, Google Workspace).
   - Optionally implement SAML (for customers using SAML2).
2. SCIM v2 endpoints:
   - `/scim/v2/Users` & `/scim/v2/Groups`
   - Mapping SCIM groups → Tenant roles
3. Admin UI:
   - UI for tenant admins to connect SSO provider, toggle SCIM, map default roles.
4. Session handling:
   - Create tenant session linking identity provider assertions to `TenantUser.externalId`.
5. Tests:
   - Automated tests for SSO flows and SCIM provisioning.

**Deliverables**
- SSO & SCIM code + docs
- Admin UI for configuration
- Integration tests

---

### Phase 3 — Billing, Quotas & Metering (Weeks 8–12)

**Tasks**
1. Usage metrics:
   - Implement per-tenant counters: build minutes, components generated, storage used, API calls.
   - Store daily snapshots.
2. Quota enforcement:
   - Implement policy checks when creating projects, components, and running builds.
   - Admin notifications & overage handling.
3. Billing integration:
   - Integrate Stripe / Chargebee; implement plans and invoice flow.
4. Trial & onboarding:
   - Trial tenant creation, usage limits, upgrade path.
5. UI:
   - Billing dashboard, usage view, upgrade path.

**Deliverables**
- Metering service + UI
- Billing integration & plan mappings
- Quota enforcement code

---

### Phase 4 — Per-Tenant Artifacts (Weeks 12–18)

**Tasks**
1. Storybook & Docs Generator:
   - Per-tenant static builds; uploaded to tenant-specific hosting (tenant slug subdomain).
2. Package publishing:
   - Private registry or GitHub Packages publish flow per tenant with `@{tenantSlug}/design-system`.
3. Domain & TLS:
   - Support custom domains (CNAME) with automatic TLS (Let's Encrypt) for tenant subdomains.
4. Per-tenant CI:
   - Scoped build pipelines per tenant; separate logs & artifacts.

**Deliverables**
- Hosted Storybook & Docs per tenant
- Private package publishing pipeline
- Custom domain support

---

### Phase 5 — Compliance, Security, Observability (Weeks 18–24)

**Tasks**
1. GDPR + Data export/delete:
   - Implement tenant data export & delete endpoints.
2. Audit logs:
   - Append-only audit logs (who/what/when).
3. SOC2 readiness:
   - Policies, controls, evidence collection.
4. Observability:
   - Per-tenant dashboards (errors, build times, usage).
5. DR & backups:
   - Per-tenant backup & restore tests.

**Deliverables**
- Compliance documentation
- Admin & tenant audit tooling
- Backup & DR playbook

---

## 5. Migration Plan (current single-user data → tenant model)

### Goals:
- Move existing user-owned projects/components into tenant-scoped resources without losing data.
- Provide minimal disruption.

### Strategy:
1. **Add tenantId to schema with default**: for current objects set `tenantId = "legacy:user:{userId}"`.
2. **Create tenant onboarding flow**: allow users to convert their personal account into a tenant or create a company tenant and migrate resources.
3. **Migration script**:
   - For each user-owned project:
     - Create Tenant record (if user chooses to create tenant) or map to existing tenant.
     - Update `project.tenantId`, `component.tenantId`, and other child objects.
     - Re-encrypt & move secrets to tenant secret store.
     - Move files to tenant-specific storage prefix.
4. **Verification**:
   - Unit tests & integration tests to ensure queries with tenantId still resolve.
   - Run in staging and manual validation steps.
5. **Rollback plan**:
   - Snapshots before migration (DB export).
   - A rollback script to restore previous tenant-less dataset.

**Notes:**
- For minimal friction, allow "personal" tenants (e.g., `tenant:personal:{userId}`) to support individuals who don't want to create an org immediately.

---

## 6. Security, Compliance & Operational Controls

### Security Controls
- TLS enforced, HSTS
- Secrets in KMS (AWS KMS / GCP KMS / Azure Key Vault)
- Server-side encryption for storage artifacts with per-tenant prefix keys
- Role-based access control (RBAC)
- Least privilege for cloud IAM roles
- Periodic dependency scanning & vulnerability management

### Compliance Controls
- GDPR: export/delete functionality, DPA templates
- Data residency: optional region selection for enterprise plans
- SOC2: controls, policies, testing, auditors

### Operational Controls
- Backups: daily snapshots with per-tenant restore test
- Incident response & runbooks
- On-call SRE rotation & alerting
- Rate limiting & WAF

---

## 7. SSO / SCIM Implementation Details (Practical)

### SSO (OIDC) Flow (recommended first)
1. Tenant admin registers OIDC provider: `clientId`, `clientSecret`, `issuerUrl`, scopes.
2. Backend stores encrypted client secret per tenant.
3. On login, redirect to IdP with `state` and `nonce`.
4. Receive callback, validate tokens, extract `sub` and email, map to `TenantUser.externalId`.
5. Issue DS-OS session tied to `tenantId`.

### SAML (if necessary)
- Support SAML metadata upload (certificate & entity ID).
- Handle signed assertions and map attributes to DS-OS user/email.

### SCIM v2
- Implement `/scim/v2/Users` with basic CRUD mapping:
  - `externalId` → `TenantUser.externalId`
  - SCIM group → DS-OS role mapping
- Provide SCIM outbox/event logging so you can debug provisioning failures.

**Security Tip:** Allow "Just-in-time" provisioning and also SCIM-based provisioning — support both.

---

## 8. Billing, Quotas & Metering Design

### Metering model
- Track: `componentsGenerated`, `buildMinutes`, `storageGB`, `apiRequests`, `users`, `projects`.
- Store daily usage snapshots with `tenantId`.

### Billing events
- Monthly billing cycle with usage-based overage
- Alerts at 80% and 100% usage
- Invoice generation via Stripe/Chargebee APIs

### Quota enforcement
- Enforce strictly for lower tiers, soft enforcement with warnings + temp block for exceeding critical quotas.
- Admins can request temporary increases with manual approval.

---

## 9. Per-Tenant Artifacts: Storybook, Docs & NPM

### Storybook
- Generate static Storybook builds per tenant.
- Host on per-tenant subdomains or on a shared CDN with `tenant/{slug}/storybook`.
- Optionally offer Chromatic integration.

### Documentation
- Generate Docusaurus MDX per tenant from component MDX + tokens.
- Host similarly to Storybook.

### NPM / Package Publishing
- For public packages: publish under org scope with tenant prefix (if allowed).
- For private packages: use GitHub Packages or private registry; require tenant-narrowed access tokens.

---

## 10. CI/CD and Release Strategy (per-tenant)

- Each tenant can trigger a build pipeline for their Storybook/package generation.
- Use GitHub Actions with per-tenant secrets to publish artifacts to tenant-scoped hosting.
- Use a queueing system (e.g., Redis/Cloud Tasks) with per-tenant concurrency limits.

---

## 11. Observability & SLOs

- Collect per-tenant metrics: error rate, build time, queue length, API latency.
- Set SLOs (e.g., 99.5% request success, build time p95 < target).
- Alert on tenant-specific degradations to avoid noisy neighbor SLA breaches.

---

## 12. Cursor Task List (Actionable Items for Automation)

Below are atomic tasks you can assign to Cursor (each task should include sample input & expected output):

**High priority**
1. `task/tenant-schema-and-migration` — add tenantId to all schemas, create migration script.
2. `task/tenant-middleware` — implement middleware that enforces tenantId on all requests and DB calls.
3. `task/tenant-secrets-store` — move secret storage to KMS pattern and tenant-scoped entries.

**Auth**
4. `task/oidc-connector` — implement OIDC auth flow and admin UI to configure.
5. `task/scim-server` — create SCIM v2 endpoints and mapping tests.

**Billing & Quotas**
6. `task/metering-service` — daily usage snapshot implementation.
7. `task/quota-enforcer` — enforce quotas during API operations.

**Artifacts**
8. `task/storybook-generator` — per-tenant Storybook build pipeline.
9. `task/package-publisher` — private package publish flow.

**Security & Compliance**
10. `task/gdpr-delete` — implement tenant data export & deletion API.
11. `task/audit-logs` — append-only audit log store with query endpoints.

Each Cursor task should open a PR, include tests, and have an example input and expected output.

---

## 13. Definitions of Done (DoD), Checklists & Acceptance Criteria

**Tenant Middleware DoD**
- All collections have `tenantId` present in schema.
- Middleware attaches `tenantId` from session.
- Unit tests and integration tests exist verifying tenant isolation.
- No API can access data outside `tenantId`.
- Migration script exists with dry-run mode.

**SSO DoD**
- OIDC flow works with a test IdP (Okta).
- Users are provisioned with `TenantUser.externalId`.
- Admin UI to connect SSO exists.
- Tests for token validation & session creation.

**Billing DoD**
- Usage snapshot created daily with `tenantId`.
- Plans exist and quotas are enforced.
- Stripe integration works end-to-end in test mode.

**Storybook DoD**
- Generated Storybook per tenant accessible via tenant URL.
- MDX docs generated and live-hosted.

---

## 14. Appendix — Example Convex middleware & pseudocode

**Session verification & tenant attachment (pseudocode)**

```ts
// server/middleware/authTenant.ts
import { verifySession } from './auth';

export async function withTenant(req, res, next) {
  const session = await verifySession(req.headers.authorization);
  if (!session) return res.status(401);
  // session should include tenantId if user is scoped to a tenant
  if (!session.tenantId) {
    // if personal account: create or return personal tenant ID
    session.tenantId = `personal:${session.userId}`;
  }
  req.context = { userId: session.userId, tenantId: session.tenantId, roles: session.roles };
  return next();
}
```

**DB call example (Convex-ish)**

```ts
// server/tenants/projects.ts
export async function getProject(projectId, ctx) {
  const project = await db.get('projects', projectId);
  if (project.tenantId !== ctx.tenantId) throw new Error('Forbidden');
  return project;
}
```

---

## 15. Next steps — Immediate actions I will generate for you (if you want)

I can now create the following files in your repo and open PR-ready branches:

1. `src/schemas/tenant.ts` (complete) — already prepared earlier
2. `server/middleware/tenantMiddleware.ts` — production-ready code implementing tenant checks
3. `scripts/migrate-to-tenants.js` — migration script with dry-run mode
4. `docs/tenant-onboarding.md` — admin-facing onboarding doc
5. `examples/ir-bundles/` — seed examples for tenant-level testing
6. `scim/` — SCIM server skeleton with endpoint stubs
7. `auth/oidc/` — OIDC connector skeleton and admin UI guide
8. `billing/` — Stripe integration skeleton and webhooks handler

Tell me which of these you want now and I will generate them into the repo.

---

## Contact & Governance Notes

- Ensure legal & privacy teams review DPA and hosting regions for enterprise customers.  
- Prioritize pilot customers and run early integrations for feedback before general availability.  
- Track migration metrics and be prepared to rollback or remediate tenant migration issues.

---

*Prepared for you, Upen — ask me to generate any of the immediate artifacts above and I will create them inside the repo (with tests, scripts, and PR-ready branches) so Cursor can continue implementing accurately.*  
