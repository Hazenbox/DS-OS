import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================================================
  // TENANT MANAGEMENT TABLES
  // ============================================================================
  
  // Tenants - Organizations/companies using DS-OS
  tenants: defineTable({
    name: v.string(),
    slug: v.string(), // Unique friendly ID for URLs
    plan: v.optional(v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("enterprise")
    )),
    region: v.optional(v.string()), // Data residency
    billingAccountId: v.optional(v.string()), // Stripe customer ID
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("deleted"),
      v.literal("pending")
    ),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // Tenant Users - Users belonging to tenants with roles
  tenantUsers: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"), // Link to users table
    email: v.string(),
    displayName: v.optional(v.string()),
    roles: v.array(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("developer"),
      v.literal("designer"),
      v.literal("viewer"),
      v.literal("billing")
    )),
    isActive: v.boolean(),
    ssoProvider: v.optional(v.string()),
    externalId: v.optional(v.string()), // SCIM/SAML/OIDC ID
    invitedBy: v.optional(v.id("users")),
    invitedAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_email", ["email"])
    .index("by_external_id", ["externalId"]),

  // Tenant Settings - Configuration per tenant
  tenantSettings: defineTable({
    tenantId: v.id("tenants"),
    defaultTokenPolicy: v.optional(v.union(
      v.literal("enforceSemantic"),
      v.literal("allowCustom")
    )),
    allowPublicSharing: v.optional(v.boolean()),
    storageBucket: v.optional(v.string()),
    retentionDays: v.optional(v.number()),
    allowedDomains: v.optional(v.array(v.string())),
    customBrand: v.optional(v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      favicon: v.optional(v.string()),
    })),
  })
    .index("by_tenant", ["tenantId"]),

  // Tenant Quotas - Resource limits per tenant
  tenantQuotas: defineTable({
    tenantId: v.id("tenants"),
    maxProjects: v.optional(v.number()),
    maxComponents: v.optional(v.number()),
    monthlyBuildMinutes: v.optional(v.number()),
    storageGB: v.optional(v.number()),
    apiRequestsPerMinute: v.optional(v.number()),
    maxUsers: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"]),

  // Tenant Usage - Daily usage snapshots for billing
  tenantUsage: defineTable({
    tenantId: v.id("tenants"),
    date: v.string(), // YYYY-MM-DD
    projects: v.number(),
    components: v.number(),
    buildMinutes: v.number(),
    storageGB: v.number(),
    apiRequests: v.number(),
    activeUsers: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_date", ["tenantId", "date"])
    .index("by_date", ["date"]),

  // Tenant Invitations - Pending user invitations
  tenantInvitations: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    roles: v.array(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("developer"),
      v.literal("designer"),
      v.literal("viewer"),
      v.literal("billing")
    )),
    invitedBy: v.id("users"),
    invitedAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    token: v.string(), // Secure invitation token
  })
    .index("by_tenant", ["tenantId"])
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_expires", ["expiresAt"]),

  // SSO Configuration - SSO/SAML/OIDC settings per tenant
  ssoConfigs: defineTable({
    tenantId: v.id("tenants"),
    provider: v.union(v.literal("saml"), v.literal("oidc")),
    providerName: v.string(), // e.g., "Okta", "Azure AD", "Google Workspace"
    // OIDC fields
    clientId: v.optional(v.string()),
    clientSecretEncrypted: v.optional(v.string()), // Encrypted client secret
    issuer: v.optional(v.string()), // OIDC issuer URL
    authorizationEndpoint: v.optional(v.string()),
    tokenEndpoint: v.optional(v.string()),
    userInfoEndpoint: v.optional(v.string()),
    jwksUri: v.optional(v.string()), // For token verification
    scopes: v.optional(v.array(v.string())), // Default: ["openid", "email", "profile"]
    redirectUri: v.optional(v.string()),
    // SAML fields
    ssoUrl: v.optional(v.string()), // SAML SSO URL
    certificate: v.optional(v.string()), // SAML certificate
    entityId: v.optional(v.string()), // SAML entity ID
    // SCIM fields
    scimEnabled: v.optional(v.boolean()),
    scimUrl: v.optional(v.string()),
    scimAuthTokenEncrypted: v.optional(v.string()),
    // Configuration
    allowProvisioning: v.optional(v.boolean()), // JIT provisioning
    defaultRole: v.optional(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("developer"),
      v.literal("designer"),
      v.literal("viewer")
    )), // Default role for JIT-provisioned users
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_enabled", ["tenantId", "enabled"]),

  // SSO State - Temporary storage for OAuth state/nonce during SSO flow
  ssoStates: defineTable({
    state: v.string(), // CSRF protection
    nonce: v.string(), // Replay protection
    tenantId: v.id("tenants"),
    redirectUrl: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(), // 10 minutes
  })
    .index("by_state", ["state"])
    .index("by_tenant", ["tenantId"]),

  // SCIM Events - Audit log for SCIM operations
  scimEvents: defineTable({
    tenantId: v.id("tenants"),
    operation: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("get"),
      v.literal("list")
    ),
    resourceType: v.union(v.literal("User"), v.literal("Group")),
    resourceId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_created", ["tenantId", "createdAt"]),

  // ============================================================================
  // EXISTING TABLES - NOW WITH TENANT ID
  // ============================================================================

  // Token Files - JSON files uploaded by users
  tokenFiles: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.id("projects"),
    name: v.string(), // Display name (editable)
    originalName: v.string(), // Original filename
    content: v.string(), // JSON content as string
    tokenCount: v.number(), // Number of tokens in the file
    isActive: v.boolean(), // Whether to use this file's tokens
    uploadedAt: v.number(),
    uploadedBy: v.string(), // User email
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_project_active", ["projectId", "isActive"]),

  // Font Files - Font files uploaded by users (woff, woff2, ttf, otf)
  fontFiles: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    name: v.string(), // Display name (editable)
    originalName: v.string(), // Original filename
    fontFamily: v.string(), // Font family name (e.g., "Inter", "Whyte")
    fontUrl: v.string(), // URL to font file (stored externally or as base64)
    format: v.union(v.literal("woff"), v.literal("woff2"), v.literal("ttf"), v.literal("otf")),
    uploadedAt: v.number(),
    uploadedBy: v.string(), // User email
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_font_family", ["fontFamily"]),

  // Design Tokens - scoped to project
  tokens: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.id("projects"),
    name: v.string(),
    value: v.string(), // Default value (for backward compatibility)
    valueByMode: v.optional(v.any()), // Mode-specific values: { "light": "#fff", "dark": "#000" }
    type: v.union(
      v.literal("color"),
      v.literal("typography"),
      v.literal("spacing"),
      v.literal("sizing"),
      v.literal("radius"),
      v.literal("shadow"),
      v.literal("blur"),
      v.literal("unknown")
    ),
    description: v.optional(v.string()),
    brand: v.optional(v.string()),
    sourceFileId: v.optional(v.id("tokenFiles")), // Link to source file
    modes: v.optional(v.array(v.string())), // Available modes: ["light", "dark"]
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_type", ["type"])
    .index("by_brand", ["brand"])
    .index("by_source_file", ["sourceFileId"]),

  // Token Bundles - Compiled CSS/JSON bundles for themes and components
  tokenBundles: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    type: v.union(v.literal("global"), v.literal("component")),
    componentId: v.optional(v.id("components")), // For component bundles
    version: v.string(),
    cssContent: v.optional(v.string()), // CSS with :root variables (fallback, prefer CDN)
    jsonContent: v.string(), // JSON token map (fallback, prefer CDN)
    cssUrl: v.optional(v.string()), // CDN URL for CSS bundle
    jsonUrl: v.optional(v.string()), // CDN URL for JSON bundle
    tokenCount: v.number(),
    modes: v.optional(v.array(v.string())), // e.g., ["light", "dark"]
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_component", ["componentId"]),

  // Components - scoped to project
  components: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.id("projects"),
    name: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("stable"),
      v.literal("deprecated")
    ),
    version: v.string(),
    code: v.string(),
    docs: v.string(),
    storybook: v.optional(v.string()), // Storybook story code
    progressId: v.optional(v.id("extractionProgress")), // Link to extraction progress for Log tab
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_status", ["status"]),

  // Activity Log - scoped to project
  activity: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.optional(v.id("projects")), // Optional for system-wide activity
    user: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("import"),
      v.literal("download"),
      v.literal("release"),
      v.literal("component_approved"),
      v.literal("component_rejected"),
      v.literal("release_approved")
    ),
    target: v.string(),
    targetType: v.union(
      v.literal("token"),
      v.literal("component"),
      v.literal("release"),
      v.literal("system")
    ),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_action", ["action"]),

  // Settings - scoped to tenant (migrated from user-scoped)
  settings: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    userId: v.optional(v.string()), // Owner's email (optional for legacy data)
    key: v.string(),
    value: v.string(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_key", ["key"])
    .index("by_user", ["userId"])
    .index("by_tenant_key", ["tenantId", "key"])
    .index("by_user_key", ["userId", "key"]),

  // Releases - scoped to project
  releases: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.id("projects"),
    version: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("in_progress"),
      v.literal("published"),
      v.literal("failed")
    ),
    changelog: v.string(),
    publishedAt: v.optional(v.number()),
    components: v.array(v.string()),
    visualDiffResults: v.optional(v.array(v.object({
      componentId: v.string(),
      variantId: v.optional(v.string()),
      passed: v.boolean(),
      diffPercentage: v.number(),
      diffImage: v.optional(v.string()),
      threshold: v.number(),
      screenshotUrl: v.optional(v.string()),
      figmaImageUrl: v.optional(v.string()),
      errors: v.optional(v.array(v.string())),
      testedAt: v.number(),
    }))),
    accessibilityResults: v.optional(v.array(v.object({
      componentId: v.string(),
      variantId: v.optional(v.string()),
      passed: v.boolean(),
      violations: v.array(v.object({
        id: v.string(),
        impact: v.string(),
        description: v.string(),
        help: v.string(),
        helpUrl: v.string(),
        nodes: v.array(v.string()),
      })),
      testedAt: v.number(),
      score: v.optional(v.number()), // 0-100 accessibility score
    }))),
    componentApprovals: v.optional(v.array(v.object({
      componentId: v.string(),
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      approvedBy: v.optional(v.string()), // User email
      approvedAt: v.optional(v.number()),
      rejectedBy: v.optional(v.string()), // User email
      rejectedAt: v.optional(v.number()),
      rejectionReason: v.optional(v.string()),
    }))),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_status", ["status"]),

  // Brands - scoped to project
  brands: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    isDefault: v.boolean(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"]),

  // Projects - scoped to tenant
  projects: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.optional(v.string()), // Owner's email (legacy)
    createdBy: v.optional(v.string()), // Legacy field for backward compatibility
    ownerId: v.optional(v.id("users")), // Project owner (for member management)
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_tenant_active", ["tenantId", "isActive"])
    .index("by_user_active", ["userId", "isActive"]),

  // Project Members - Users with access to specific projects
  projectMembers: defineTable({
    projectId: v.id("projects"),
    tenantId: v.id("tenants"), // For efficient tenant-scoped queries
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    addedBy: v.id("users"),
    addedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  // Users
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    provider: v.optional(v.union(
      v.literal("email"),
      v.literal("google"),
      v.literal("github"),
      v.literal("oidc"),
      v.literal("saml")
    )),
    providerId: v.optional(v.string()),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_provider", ["provider", "providerId"]),

  // Email verification tokens
  emailVerifications: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    verified: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Rate limiting
  rateLimits: defineTable({
    identifier: v.string(), // IP, email, or userId
    action: v.string(), // AUTH, BULK_IMPORT, API, etc.
    timestamp: v.number(),
    success: v.optional(v.boolean()),
  })
    .index("by_identifier_action", ["identifier", "action"])
    .index("by_timestamp", ["timestamp"]),

  // User sessions (for secure session management)
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"])
    .index("by_expires", ["expiresAt"]),

  // Figma Extractions - stores extraction requests and results
  figmaExtractions: defineTable({
    tenantId: v.id("tenants"), // Required - fresh start
    projectId: v.id("projects"),
    userId: v.string(),
    figmaUrl: v.optional(v.string()),
    nodeId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    result: v.optional(v.any()), // Extracted component data
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["projectId"])
    .index("by_tenant_project", ["tenantId", "projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_user", ["userId"]),

  // ============================================================================
  // EXTRACTION PROGRESS TRACKING
  // ============================================================================
  
  extractionProgress: defineTable({
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    figmaUrl: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("extracting"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    currentStep: v.string(),
    steps: v.array(v.object({
      id: v.string(),
      label: v.string(),
      status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("failed")),
      details: v.optional(v.string()),
    })),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_status", ["status"]),
});
