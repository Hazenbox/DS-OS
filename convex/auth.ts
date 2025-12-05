import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// PASSWORD HASHING
// ============================================================================
// Simple password hashing (for demo - use bcrypt/argon2 in production)
// In production, use a proper hashing library via Convex actions

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "ds-os-salt-v1");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// ============================================================================
// SESSION TOKEN GENERATION
// ============================================================================
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// RATE LIMITING HELPER
// ============================================================================
async function checkAuthRateLimit(ctx: any, identifier: string): Promise<void> {
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  const windowStart = Date.now() - windowMs;
  
  const attempts = await ctx.db
    .query("rateLimits")
    .withIndex("by_identifier_action", (q: any) => 
      q.eq("identifier", identifier).eq("action", "AUTH")
    )
    .filter((q: any) => q.gte(q.field("timestamp"), windowStart))
    .collect();
  
  if (attempts.length >= maxAttempts) {
    const resetTime = Math.ceil((windowMs - (Date.now() - Math.min(...attempts.map((a: any) => a.timestamp)))) / 1000 / 60);
    throw new Error(`Too many login attempts. Please try again in ${resetTime} minutes.`);
  }
}

async function recordAuthAttempt(ctx: any, identifier: string, success: boolean): Promise<void> {
  await ctx.db.insert("rateLimits", {
    identifier,
    action: "AUTH",
    timestamp: Date.now(),
    success,
  });
}

// Sign up with email and password
export const signup = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Input validation
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error("Invalid email address");
    }
    if (email.length > 254) {
      throw new Error("Email address too long");
    }
    if (!args.password || args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (args.password.length > 128) {
      throw new Error("Password too long");
    }

    // Check rate limit
    await checkAuthRateLimit(ctx, email);

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      await recordAuthAttempt(ctx, email, false);
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await hashPassword(args.password);
    const now = Date.now();
    
    // Create user
    const userId = await ctx.db.insert("users", {
      email,
      emailVerified: true, // Auto-verify for now
      name: args.name || email.split("@")[0],
      role: "user",
      provider: "email",
      providerId: passwordHash, // Store hash in providerId for email users
      createdAt: now,
      lastLoginAt: now,
    });

    // Create session
    const sessionToken = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      expiresAt: now + SESSION_DURATION,
      userAgent: args.userAgent,
      createdAt: now,
      lastActiveAt: now,
    });

    await recordAuthAttempt(ctx, email, true);

    return {
      userId,
      email,
      name: args.name || email.split("@")[0],
      role: "user",
      sessionToken,
      expiresAt: now + SESSION_DURATION,
      message: "User created successfully.",
    };
  },
});

// Login with email/password
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    
    // Check rate limit
    await checkAuthRateLimit(ctx, email);
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      await recordAuthAttempt(ctx, email, false);
      // Use generic error to prevent user enumeration
      throw new Error("Invalid email or password");
    }

    // Check if this is an email/password user
    if (user.provider !== 'email') {
      await recordAuthAttempt(ctx, email, false);
      throw new Error(`Please sign in with ${user.provider}`);
    }

    // Verify password
    const passwordHash = user.providerId;
    if (!passwordHash) {
      await recordAuthAttempt(ctx, email, false);
      throw new Error("Invalid email or password");
    }

    const isValid = await verifyPassword(args.password, passwordHash);
    if (!isValid) {
      await recordAuthAttempt(ctx, email, false);
      throw new Error("Invalid email or password");
    }

    const now = Date.now();

    // Update last login
    await ctx.db.patch(user._id, {
      lastLoginAt: now,
    });

    // Create session
    const sessionToken = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token: sessionToken,
      expiresAt: now + SESSION_DURATION,
      userAgent: args.userAgent,
      createdAt: now,
      lastActiveAt: now,
    });

    await recordAuthAttempt(ctx, email, true);

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      sessionToken,
      expiresAt: now + SESSION_DURATION,
    };
  },
});

// OAuth login/signup (Google or GitHub)
export const oauthLogin = mutation({
  args: {
    provider: v.union(v.literal("google"), v.literal("github")),
    providerId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const now = Date.now();
    
    let userId: any;
    let userName: string | undefined;
    let userImage: string | undefined;
    let userRole: string;
    let isNewUser = false;
    
    // Check if user exists by provider ID
    const existingByProvider = await ctx.db
      .query("users")
      .withIndex("by_provider", (q) => 
        q.eq("provider", args.provider).eq("providerId", args.providerId)
      )
      .first();

    if (existingByProvider) {
      // Update last login and potentially update profile info
      await ctx.db.patch(existingByProvider._id, {
        lastLoginAt: now,
        name: args.name || existingByProvider.name,
        image: args.image || existingByProvider.image,
      });

      userId = existingByProvider._id;
      userName = args.name || existingByProvider.name;
      userImage = args.image || existingByProvider.image;
      userRole = existingByProvider.role;
    } else {
      // Check if user exists by email (link accounts)
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (existingByEmail) {
        // Only link if existing account is email provider
        if (existingByEmail.provider === 'email') {
          await ctx.db.patch(existingByEmail._id, {
            provider: args.provider,
            providerId: args.providerId,
            image: args.image || existingByEmail.image,
            lastLoginAt: now,
          });
        } else {
          await ctx.db.patch(existingByEmail._id, {
            lastLoginAt: now,
          });
        }

        userId = existingByEmail._id;
        userName = existingByEmail.name;
        userImage = args.image || existingByEmail.image;
        userRole = existingByEmail.role;
      } else {
        // Create new user
        userId = await ctx.db.insert("users", {
          email,
          emailVerified: true, // OAuth emails are verified
          name: args.name || email.split("@")[0],
          image: args.image,
          role: "user",
          provider: args.provider,
          providerId: args.providerId,
          createdAt: now,
          lastLoginAt: now,
        });

        userName = args.name || email.split("@")[0];
        userImage = args.image;
        userRole = "user";
        isNewUser = true;
      }
    }

    // Create session
    const sessionToken = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      expiresAt: now + SESSION_DURATION,
      userAgent: args.userAgent,
      createdAt: now,
      lastActiveAt: now,
    });

    return {
      userId,
      email,
      name: userName,
      image: userImage,
      role: userRole,
      sessionToken,
      expiresAt: now + SESSION_DURATION,
      isNewUser,
    };
  },
});

// Verify email with token
export const verifyEmail = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("emailVerifications")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!verification) {
      throw new Error("Invalid verification token");
    }

    if (verification.verified) {
      throw new Error("Email already verified");
    }

    if (verification.expiresAt < Date.now()) {
      throw new Error("Verification token has expired");
    }

    // Mark as verified
    await ctx.db.patch(verification._id, {
      verified: true,
    });

    // Update user
    await ctx.db.patch(verification.userId, {
      emailVerified: true,
    });

    return { success: true, message: "Email verified successfully" };
  },
});

// Get current user
export const getCurrentUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  },
});

// Resend verification email
export const resendVerification = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    if (user.emailVerified) {
      throw new Error("Email already verified");
    }

    // Delete old verification tokens
    const oldVerifications = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const verification of oldVerifications) {
      await ctx.db.delete(verification._id);
    }

    // Create new verification token
    const verificationToken = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await ctx.db.insert("emailVerifications", {
      userId: user._id,
      token: verificationToken,
      expiresAt,
      verified: false,
    });

    // In production, send email with verification link
    console.log(`New verification token for ${email}: ${verificationToken}`);
    
    return {
      message: "Verification email sent",
    };
  },
});

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

// Validate session and get user
export const validateSession = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = args.sessionToken;
    if (!token) {
      return null;
    }
    
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    
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
    };
  },
});

// Logout (invalidate session)
export const logout = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    
    if (session) {
      await ctx.db.delete(session._id);
    }
    
    return { success: true };
  },
});

// Logout from all devices
export const logoutAll = mutation({
  args: {
    userId: v.id("users"),
    sessionToken: v.string(), // Current session to verify identity
  },
  handler: async (ctx, args) => {
    // Verify current session
    const currentSession = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    
    if (!currentSession || currentSession.userId !== args.userId) {
      throw new Error("Unauthorized");
    }
    
    // Delete all sessions for this user
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

// Refresh session (extend expiration)
export const refreshSession = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
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
      sessionToken: session.token,
      expiresAt: now + SESSION_DURATION,
    };
  },
});
