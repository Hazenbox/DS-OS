import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";

// List all font files for a project
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
      .query("fontFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Create a new font file
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
    originalName: v.string(),
    fontFamily: v.string(),
    fontUrl: v.string(),
    format: v.union(v.literal("woff"), v.literal("woff2"), v.literal("ttf"), v.literal("otf")),
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
    
    const fontId = await ctx.db.insert("fontFiles", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      name: args.name,
      originalName: args.originalName,
      fontFamily: args.fontFamily,
      fontUrl: args.fontUrl,
      format: args.format,
      uploadedAt: Date.now(),
      uploadedBy: userEmail,
    });
    return fontId;
  },
});

// Rename a font file
export const rename = mutation({
  args: {
    id: v.id("fontFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const font = await ctx.db.get(args.id);
    if (!font) {
      throw new Error("Font file not found");
    }
    
    // Verify font belongs to tenant
    verifyTenantResource(ctx, args.tenantId, font);
    
    await ctx.db.patch(args.id, { name: args.name.trim() });
    return { success: true };
  },
});

// Delete a font file
export const remove = mutation({
  args: {
    id: v.id("fontFiles"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify tenant access and require developer role
    await getTenantContext(ctx, args.userId, args.tenantId);
    await requireRole(ctx, args.tenantId, args.userId, "developer");
    
    const font = await ctx.db.get(args.id);
    if (!font) {
      throw new Error("Font file not found");
    }
    
    // Verify font belongs to tenant
    verifyTenantResource(ctx, args.tenantId, font);
    
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Get font by family name
export const getByFamily = query({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    fontFamily: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Verify project belongs to tenant
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    verifyTenantResource(ctx, args.tenantId, project);
    
    const font = await ctx.db
      .query("fontFiles")
      .withIndex("by_font_family", (q) => q.eq("fontFamily", args.fontFamily))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();
    
    return font;
  },
});

