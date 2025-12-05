import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

// Sign up with email and password
export const signup = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Input validation
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error("Invalid email address");
    }
    if (!args.password || args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await hashPassword(args.password);
    
    // Create user
    const userId = await ctx.db.insert("users", {
      email,
      emailVerified: true, // Auto-verify for now
      name: args.name || email.split("@")[0],
      role: "user",
      provider: "email",
      providerId: passwordHash, // Store hash in providerId for email users
      createdAt: Date.now(),
    });

    return {
      userId,
      email,
      name: args.name || email.split("@")[0],
      role: "user",
      message: "User created successfully.",
    };
  },
});

// Login with email/password
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      // Use generic error to prevent user enumeration
      throw new Error("Invalid email or password");
    }

    // Check if this is an email/password user
    if (user.provider !== 'email') {
      throw new Error(`Please sign in with ${user.provider}`);
    }

    // Verify password
    const passwordHash = user.providerId;
    if (!passwordHash) {
      throw new Error("Invalid email or password");
    }

    const isValid = await verifyPassword(args.password, passwordHash);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    // Update last login
    await ctx.db.patch(user._id, {
      lastLoginAt: Date.now(),
    });

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
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
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    
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
        lastLoginAt: Date.now(),
        name: args.name || existingByProvider.name,
        image: args.image || existingByProvider.image,
      });

      return {
        userId: existingByProvider._id,
        email: existingByProvider.email,
        name: args.name || existingByProvider.name,
        image: args.image || existingByProvider.image,
        role: existingByProvider.role,
        isNewUser: false,
      };
    }

    // Check if user exists by email (link accounts)
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingByEmail) {
      // Only link if existing account is email provider
      // Don't overwrite another OAuth provider
      if (existingByEmail.provider === 'email') {
        await ctx.db.patch(existingByEmail._id, {
          provider: args.provider,
          providerId: args.providerId,
          image: args.image || existingByEmail.image,
          lastLoginAt: Date.now(),
        });
      } else {
        // Account exists with different OAuth - just update login time
        await ctx.db.patch(existingByEmail._id, {
          lastLoginAt: Date.now(),
        });
      }

      return {
        userId: existingByEmail._id,
        email: existingByEmail.email,
        name: existingByEmail.name,
        image: args.image || existingByEmail.image,
        role: existingByEmail.role,
        isNewUser: false,
      };
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email,
      emailVerified: true, // OAuth emails are verified
      name: args.name || email.split("@")[0],
      image: args.image,
      role: "user",
      provider: args.provider,
      providerId: args.providerId,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    return {
      userId,
      email,
      name: args.name || email.split("@")[0],
      image: args.image,
      role: "user",
      isNewUser: true,
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
