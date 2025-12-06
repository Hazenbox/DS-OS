import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";

// List all token files for a project
export const list = query({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return [];
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    return await ctx.db
      .query("tokenFiles")
      .withIndex("by_tenant_project", (q) => 
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .order("desc")
      .collect();
  },
});

// Create a new token file
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
    originalName: v.string(),
    content: v.string(),
    tokenCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    // Get user email
    const user = await ctx.db.get(args.userId);
    const userEmail = user?.email || "unknown";
    
    const fileId = await ctx.db.insert("tokenFiles", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      name: args.name,
      originalName: args.originalName,
      content: args.content,
      tokenCount: args.tokenCount,
      isActive: true, // New files are active by default
      uploadedAt: Date.now(),
      uploadedBy: userEmail,
    });
    return fileId;
  },
});

// Rename a token file
export const rename = mutation({
  args: {
    id: v.id("tokenFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const file = await ctx.db.get(args.id);
    if (!file) {
      throw new Error("File not found");
    }
    
    // Verify file belongs to tenant
    verifyTenantResource(ctx, args.tenantId, file);
    
    await ctx.db.patch(args.id, { name: args.name });
    return { success: true };
  },
});

// Toggle active status
export const toggleActive = mutation({
  args: {
    id: v.id("tokenFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const file = await ctx.db.get(args.id);
    if (!file) {
      throw new Error("File not found");
    }
    
    // Verify file belongs to tenant
    verifyTenantResource(ctx, args.tenantId, file);
    
    await ctx.db.patch(args.id, { isActive: !file.isActive });
    return { success: true, isActive: !file.isActive };
  },
});

// Delete a token file
export const remove = mutation({
  args: {
    id: v.id("tokenFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const file = await ctx.db.get(args.id);
    if (!file) {
      throw new Error("File not found");
    }
    
    // Verify file belongs to tenant
    verifyTenantResource(ctx, args.tenantId, file);
    
    // Also delete tokens linked to this file (verify they belong to tenant)
    const linkedTokens = await ctx.db
      .query("tokens")
      .withIndex("by_source_file", (q) => q.eq("sourceFileId", args.id))
      .collect();
    
    for (const token of linkedTokens) {
      verifyTenantResource(ctx, args.tenantId, token);
      await ctx.db.delete(token._id);
    }
    
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Get file content (for preview/download)
export const getContent = query({
  args: {
    id: v.id("tokenFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const file = await ctx.db.get(args.id);
    if (!file) {
      return null;
    }
    
    // Verify file belongs to tenant
    verifyTenantResource(ctx, args.tenantId, file);
    
    return {
      name: file.name,
      content: file.content,
    };
  },
});

