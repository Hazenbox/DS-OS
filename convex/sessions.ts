import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * Session Management Module
 * 
 * Provides secure session tokens instead of storing user data in localStorage.
 * Features:
 * - Cryptographically secure session tokens
 * - Automatic expiration (7 days default)
 * - Session invalidation on logout
 * - Multiple device support
 */

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Generate a secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Create a new session
export const createSession = mutation({
  args: {
    userId: v.id("users"),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const token = generateSessionToken();
    
    await ctx.db.insert("sessions", {
      userId: args.userId,
      token,
      expiresAt: now + SESSION_DURATION,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      createdAt: now,
      lastActiveAt: now,
    });
    
    return {
      token,
      expiresAt: now + SESSION_DURATION,
    };
  },
});

// Validate a session and get user
export const validateSession = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.token) {
      return null;
    }
    
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!session) {
      return null;
    }
    
    // Check if expired
    if (session.expiresAt < Date.now()) {
      return null;
    }
    
    // Get user
    const user = await ctx.db.get(session.userId);
    if (!user) {
      return null;
    }
    
    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      sessionId: session._id,
    };
  },
});

// Refresh session (extend expiration)
export const refreshSession = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Invalid or expired session");
    }
    
    const now = Date.now();
    await ctx.db.patch(session._id, {
      expiresAt: now + SESSION_DURATION,
      lastActiveAt: now,
    });
    
    return {
      token: session.token,
      expiresAt: now + SESSION_DURATION,
    };
  },
});

// Invalidate a session (logout)
export const invalidateSession = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (session) {
      await ctx.db.delete(session._id);
    }
    
    return { success: true };
  },
});

// Invalidate all sessions for a user (logout everywhere)
export const invalidateAllSessions = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    
    return { invalidated: sessions.length };
  },
});

// Get all active sessions for a user
export const getUserSessions = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gte(q.field("expiresAt"), now))
      .collect();
    
    return sessions.map(s => ({
      id: s._id,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      // Don't expose the actual token
    }));
  },
});

// Internal: Clean up expired sessions (run periodically)
export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expiredSessions = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();
    
    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }
    
    return { deleted: expiredSessions.length };
  },
});

