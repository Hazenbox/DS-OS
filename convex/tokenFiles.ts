import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTenantContext, verifyTenantResource, requireRole } from "./tenantMiddleware";
import { api, internal } from "./_generated/api";
import { parseTokensFromJSON } from "./tokenParser";

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

// Create a new token file and parse tokens server-side
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    name: v.string(),
    originalName: v.string(),
    content: v.string(), // Raw JSON content
  },
  handler: async (ctx, args) => {
    try {
      // Verify tenant access and require developer role
      await getTenantContext(ctx, args.userId, args.tenantId);
      await requireRole(ctx, args.tenantId, args.userId, "developer");
      
      // Verify project belongs to tenant
      const project = await ctx.db.get(args.projectId);
      if (!project) {
        throw new Error("Project not found");
      }
      verifyTenantResource(ctx, args.tenantId, project);
      
      // Parse JSON content server-side
      let parsedTokens;
      let tokenCount = 0;
      
      try {
        const json = JSON.parse(args.content);
        parsedTokens = parseTokensFromJSON(json);
        tokenCount = parsedTokens.length;
        
        console.log(`[TOKEN FILES] Parsed ${tokenCount} tokens from ${args.originalName}`);
      } catch (error) {
        console.error(`[TOKEN FILES] Failed to parse JSON:`, error);
        throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Get user email
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("User not found");
      }
      const userEmail = user.email || "unknown";
      
      // Create the file record
      const fileId = await ctx.db.insert("tokenFiles", {
        tenantId: args.tenantId,
        projectId: args.projectId,
        name: args.name,
        originalName: args.originalName,
        content: args.content,
        tokenCount: tokenCount,
        isActive: true, // New files are active by default
        uploadedAt: Date.now(),
        uploadedBy: userEmail,
      });
      
      // Import tokens automatically (server-side)
      if (parsedTokens.length > 0) {
        try {
          // Import tokens immediately via internal mutation
          await ctx.runMutation(internal.tokenFiles._importTokensFromFile, {
            fileId,
            tenantId: args.tenantId,
            projectId: args.projectId,
            userId: args.userId,
            tokens: parsedTokens.map(t => ({
              name: t.name,
              value: t.value,
              valueByMode: t.valueByMode,
              type: t.type,
              description: t.description,
              modes: t.modes,
            })),
          });
        } catch (importError) {
          console.error(`[TOKEN FILES] Failed to import tokens:`, importError);
          // Don't fail the file creation if import fails - file is already created
          // But log the error for debugging
          throw new Error(`File created but token import failed: ${importError instanceof Error ? importError.message : 'Unknown error'}`);
        }
      }
      
      return fileId;
    } catch (error) {
      // Provide more detailed error messages
      console.error(`[TOKEN FILES] Error in create mutation:`, error);
      if (error instanceof Error) {
        // Re-throw with original message if it's already a descriptive error
        if (error.message.includes("Access denied") || 
            error.message.includes("not found") || 
            error.message.includes("Invalid") ||
            error.message.includes("does not belong")) {
          throw error;
        }
        // Otherwise wrap in a more descriptive error
        throw new Error(`Failed to create token file: ${error.message}`);
      }
      throw new Error(`Failed to create token file: Unknown error`);
    }
  },
});

// Internal mutation to import tokens from a file
export const _importTokensFromFile = internalMutation({
  args: {
    fileId: v.id("tokenFiles"),
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    tokens: v.array(v.object({
      name: v.string(),
      value: v.string(),
      valueByMode: v.optional(v.any()), // Record<string, string>
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
      modes: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    try {
      // Verify file exists
      const file = await ctx.db.get(args.fileId);
      if (!file) {
        throw new Error("File not found");
      }
      
      // Use bulkImport mutation via runMutation
      await ctx.runMutation(api.tokens.bulkImport, {
        projectId: args.projectId,
        tenantId: args.tenantId,
        userId: args.userId,
        tokens: args.tokens,
        sourceFileId: args.fileId,
        clearExisting: false, // Don't clear existing tokens
      });
      
      console.log(`[TOKEN FILES] Imported ${args.tokens.length} tokens from file ${args.fileId}`);
    } catch (error) {
      console.error(`[TOKEN FILES] Error in _importTokensFromFile:`, error);
      throw new Error(`Failed to import tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

