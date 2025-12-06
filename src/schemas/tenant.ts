/**
 * Tenant Schema Definitions
 * 
 * Multi-tenant data model for DS-OS enterprise SaaS platform.
 * All data is scoped to tenants for isolation and security.
 */

export type TenantId = string;
export type UserId = string;

export type RoleName = 'owner' | 'admin' | 'developer' | 'designer' | 'viewer' | 'billing';

export type TenantStatus = 'active' | 'suspended' | 'deleted' | 'pending';

export type TenantPlan = 'free' | 'pro' | 'enterprise';

/**
 * Tenant - Represents an organization/company using DS-OS
 */
export interface Tenant {
  id: TenantId;
  name: string;
  slug: string; // Unique friendly ID for URLs (e.g., "acme-corp")
  createdAt: string;
  updatedAt: string;
  plan?: TenantPlan;
  region?: string; // Optional data residency (e.g., "us-east-1", "eu-west-1")
  billingAccountId?: string; // Link to payment provider (Stripe customer ID)
  status: TenantStatus;
  metadata?: Record<string, any>;
}

/**
 * Tenant Settings - Configuration per tenant
 */
export interface TenantSettings {
  tenantId: TenantId;
  defaultTokenPolicy?: 'enforceSemantic' | 'allowCustom';
  allowPublicSharing?: boolean;
  storageBucket?: string; // Tenant-prefixed bucket name
  retentionDays?: number; // For artifacts / logs
  allowedDomains?: string[]; // Restrict signups to specific email domains
  customBrand?: {
    logoUrl?: string;
    primaryColor?: string;
    favicon?: string;
  };
}

/**
 * Tenant User - User belonging to a tenant with roles
 */
export interface TenantUser {
  id: UserId;
  tenantId: TenantId;
  email: string;
  displayName?: string;
  roles: RoleName[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  ssoProvider?: string; // e.g., 'okta', 'azure', 'google-workspace'
  externalId?: string; // ID from SCIM/SAML/OIDC provider
  invitedBy?: UserId;
  invitedAt?: string;
}

/**
 * SSO Configuration - SSO/SAML/OIDC settings per tenant
 */
export interface SsoConfig {
  tenantId: TenantId;
  provider: 'saml' | 'oidc';
  providerName: string; // e.g., "Okta", "Azure AD"
  clientId?: string;
  issuer?: string;
  ssoUrl?: string;
  certificate?: string; // If SAML
  scimEnabled?: boolean;
  scimUrl?: string;
  scimAuthTokenEncrypted?: string;
  allowProvisioning?: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tenant Quota - Resource limits per tenant
 */
export interface TenantQuota {
  tenantId: TenantId;
  maxProjects?: number;
  maxComponents?: number;
  monthlyBuildMinutes?: number;
  storageGB?: number;
  apiRequestsPerMinute?: number;
  maxUsers?: number;
}

/**
 * Tenant Usage - Daily usage snapshots for billing
 */
export interface TenantUsage {
  tenantId: TenantId;
  date: string; // YYYY-MM-DD
  projects: number;
  components: number;
  buildMinutes: number;
  storageGB: number;
  apiRequests: number;
  activeUsers: number;
}

/**
 * Tenant Invitation - Pending user invitations
 */
export interface TenantInvitation {
  id: string;
  tenantId: TenantId;
  email: string;
  roles: RoleName[];
  invitedBy: UserId;
  invitedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  token: string; // Secure invitation token
}

/**
 * Helper: Check if user has required role
 */
export function hasRole(user: TenantUser, requiredRole: RoleName): boolean {
  // Role hierarchy: owner > admin > developer > designer > viewer
  const roleHierarchy: Record<RoleName, number> = {
    owner: 5,
    admin: 4,
    developer: 3,
    designer: 2,
    viewer: 1,
    billing: 0, // Special role, no hierarchy
  };

  const userMaxRole = Math.max(...user.roles.map(r => roleHierarchy[r] || 0));
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userMaxRole >= requiredLevel;
}

/**
 * Helper: Check if user can perform action
 */
export function canPerformAction(
  user: TenantUser,
  action: 'create' | 'read' | 'update' | 'delete' | 'admin'
): boolean {
  if (!user.isActive) return false;

  switch (action) {
    case 'create':
    case 'read':
      return hasRole(user, 'viewer');
    case 'update':
      return hasRole(user, 'developer');
    case 'delete':
      return hasRole(user, 'admin');
    case 'admin':
      return hasRole(user, 'admin');
    default:
      return false;
  }
}

