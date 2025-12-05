import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Design Tokens
  tokens: defineTable({
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
    brand: v.optional(v.string()), // For multi-brand support
  }).index("by_type", ["type"])
    .index("by_brand", ["brand"]),

  // Components
  components: defineTable({
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
  }).index("by_status", ["status"]),

  // Activity Log
  activity: defineTable({
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
  }).index("by_action", ["action"]),

  // Settings (singleton-like, one document)
  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // Releases
  releases: defineTable({
    version: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("in_progress"),
      v.literal("published"),
      v.literal("failed")
    ),
    changelog: v.string(),
    publishedAt: v.optional(v.number()),
    components: v.array(v.string()), // Component IDs included in release
  }).index("by_status", ["status"]),

  // Brands (for multi-brand token management)
  brands: defineTable({
    name: v.string(),
    isDefault: v.boolean(),
  }),

  // Users
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()), // Profile picture from OAuth
    role: v.union(v.literal("admin"), v.literal("user")),
    provider: v.optional(v.union(
      v.literal("email"),
      v.literal("google"),
      v.literal("github")
    )),
    providerId: v.optional(v.string()), // OAuth provider's user ID
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
});
