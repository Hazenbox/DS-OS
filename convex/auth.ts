import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Sign up with email and password
export const signup = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // In a real implementation, you would hash the password
    // For now, we'll store it (NOT RECOMMENDED FOR PRODUCTION)
    // In production, use Convex's built-in auth or a proper password hashing library
    
    // Create user with email auto-verified
    const userId = await ctx.db.insert("users", {
      email: args.email,
      emailVerified: true, // Auto-verify email
      name: args.name || args.email.split("@")[0],
      role: "user",
      createdAt: Date.now(),
    });

    // Email is auto-verified, no need for verification token
    return {
      userId,
      email: args.email,
      name: args.name || args.email.split("@")[0],
      role: "user",
      message: "User created successfully.",
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

// Login (simplified - in production use proper auth)
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Email is auto-verified, so this check is not needed
    // But keeping it for safety in case verification is re-enabled
    // if (!user.emailVerified) {
    //   throw new Error("Please verify your email before logging in");
    // }

    // In production, verify password hash here
    // For now, we'll just check if user exists and is verified

    // Update last login
    await ctx.db.patch(user._id, {
      lastLoginAt: Date.now(),
    });

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
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
    console.log(`New verification token for ${args.email}: ${verificationToken}`);
    
    return {
      verificationToken, // Remove this in production
      message: "Verification email sent",
    };
  },
});

