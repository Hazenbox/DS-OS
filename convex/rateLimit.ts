import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * Rate Limiting Module
 * 
 * Provides configurable rate limiting for:
 * - Authentication attempts (login, signup)
 * - Bulk operations (imports)
 * - API calls per user
 * 
 * Uses a sliding window algorithm with Convex storage.
 */

// Rate limit configurations
export const RATE_LIMITS = {
  // Auth: 5 attempts per 15 minutes
  AUTH: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  // Bulk import: 10 per hour
  BULK_IMPORT: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  // General API: 100 per minute
  API: { maxAttempts: 100, windowMs: 60 * 1000 },
  // Password reset: 3 per hour
  PASSWORD_RESET: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
};

type RateLimitType = keyof typeof RATE_LIMITS;

// Check if an action is rate limited
export const checkRateLimit = query({
  args: {
    identifier: v.string(), // IP, userId, or email
    action: v.string(), // Type of action
  },
  handler: async (ctx, args) => {
    const config = RATE_LIMITS[args.action as RateLimitType] || RATE_LIMITS.API;
    const windowStart = Date.now() - config.windowMs;
    
    const attempts = await ctx.db
      .query("rateLimits")
      .withIndex("by_identifier_action", (q) => 
        q.eq("identifier", args.identifier).eq("action", args.action)
      )
      .filter((q) => q.gte(q.field("timestamp"), windowStart))
      .collect();
    
    return {
      allowed: attempts.length < config.maxAttempts,
      remaining: Math.max(0, config.maxAttempts - attempts.length),
      resetAt: attempts.length > 0 
        ? Math.min(...attempts.map(a => a.timestamp)) + config.windowMs
        : Date.now() + config.windowMs,
    };
  },
});

// Record a rate limit attempt
export const recordAttempt = mutation({
  args: {
    identifier: v.string(),
    action: v.string(),
    success: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("rateLimits", {
      identifier: args.identifier,
      action: args.action,
      timestamp: Date.now(),
      success: args.success ?? true,
    });
    
    return { recorded: true };
  },
});

// Internal: Clean up old rate limit records (run periodically)
export const cleanupOldRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const oldRecords = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("timestamp"), oneDayAgo))
      .collect();
    
    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }
    
    return { deleted: oldRecords.length };
  },
});

// Helper function to check and enforce rate limit
export async function enforceRateLimit(
  ctx: any,
  identifier: string,
  action: RateLimitType
): Promise<void> {
  const config = RATE_LIMITS[action];
  const windowStart = Date.now() - config.windowMs;
  
  const attempts = await ctx.db
    .query("rateLimits")
    .withIndex("by_identifier_action", (q: any) => 
      q.eq("identifier", identifier).eq("action", action)
    )
    .filter((q: any) => q.gte(q.field("timestamp"), windowStart))
    .collect();
  
  if (attempts.length >= config.maxAttempts) {
    const resetTime = Math.ceil((config.windowMs - (Date.now() - Math.min(...attempts.map((a: any) => a.timestamp)))) / 1000 / 60);
    throw new Error(`Rate limit exceeded. Please try again in ${resetTime} minutes.`);
  }
}

// Record attempt helper
export async function recordRateLimitAttempt(
  ctx: any,
  identifier: string,
  action: string,
  success: boolean = true
): Promise<void> {
  await ctx.db.insert("rateLimits", {
    identifier,
    action,
    timestamp: Date.now(),
    success,
  });
}

