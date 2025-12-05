import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

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
    
    // Create user with email auto-verified
    const userId = await ctx.db.insert("users", {
      email: args.email,
      emailVerified: true,
      name: args.name || args.email.split("@")[0],
      role: "user",
      provider: "email",
      createdAt: Date.now(),
    });

    return {
      userId,
      email: args.email,
      name: args.name || args.email.split("@")[0],
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
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
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingByEmail) {
      // Link the OAuth provider to existing account
      await ctx.db.patch(existingByEmail._id, {
        provider: args.provider,
        providerId: args.providerId,
        image: args.image || existingByEmail.image,
        lastLoginAt: Date.now(),
      });

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
      email: args.email,
      emailVerified: true, // OAuth emails are verified
      name: args.name || args.email.split("@")[0],
      image: args.image,
      role: "user",
      provider: args.provider,
      providerId: args.providerId,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    return {
      userId,
      email: args.email,
      name: args.name || args.email.split("@")[0],
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
