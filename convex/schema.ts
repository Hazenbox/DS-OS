import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Token Files - JSON files uploaded by users
  tokenFiles: defineTable({
    projectId: v.id("projects"),
    name: v.string(), // Display name (editable)
    originalName: v.string(), // Original filename
    content: v.string(), // JSON content as string
    tokenCount: v.number(), // Number of tokens in the file
    isActive: v.boolean(), // Whether to use this file's tokens
    uploadedAt: v.number(),
    uploadedBy: v.string(), // User email
  })
    .index("by_project", ["projectId"])
    .index("by_project_active", ["projectId", "isActive"]),

  // Design Tokens - scoped to project
  tokens: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    value: v.string(),
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
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_type", ["type"])
    .index("by_brand", ["brand"])
    .index("by_source_file", ["sourceFileId"]),

  // Components - scoped to project
  components: defineTable({
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
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_status", ["status"]),

  // Activity Log - scoped to project
  activity: defineTable({
    projectId: v.optional(v.id("projects")), // Optional for system-wide activity
    user: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("import"),
      v.literal("download"),
      v.literal("release")
    ),
    target: v.string(),
    targetType: v.union(
      v.literal("token"),
      v.literal("component"),
      v.literal("release"),
      v.literal("system")
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_action", ["action"]),

  // Settings - scoped to user
  settings: defineTable({
    userId: v.optional(v.string()), // Owner's email (optional for legacy data)
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"])
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  // Releases - scoped to project
  releases: defineTable({
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
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_status", ["status"]),

  // Brands - scoped to project
  brands: defineTable({
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    isDefault: v.boolean(),
  }).index("by_project", ["projectId"]),

  // Projects - scoped to user
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.optional(v.string()), // Owner's email
    createdBy: v.optional(v.string()), // Legacy field for backward compatibility
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

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
      v.literal("github")
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
});
