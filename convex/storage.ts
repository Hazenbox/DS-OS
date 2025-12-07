"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { put, head } from "@vercel/blob";

// ============================================================================
// STORAGE UTILITIES - CDN Upload for Token Bundles
// ============================================================================

/**
 * Upload token bundle to Vercel Blob Storage (CDN)
 * Returns CDN URL with proper cache headers
 */
export const uploadBundle = action({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    version: v.string(),
    type: v.union(v.literal("global"), v.literal("component")),
    componentId: v.optional(v.id("components")),
    cssContent: v.optional(v.string()),
    jsonContent: v.string(),
    modes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{
    cssUrl?: string;
    jsonUrl: string;
  }> => {
    // Build storage path: /tenants/{tenantId}/projects/{projectId}/bundles/{version}/
    const basePath = `tenants/${args.tenantId}/projects/${args.projectId}/bundles/${args.version}`;
    
    const results: { cssUrl?: string; jsonUrl: string } = {
      jsonUrl: "",
    };

    // Upload JSON bundle
    const jsonPath = args.componentId
      ? `${basePath}/components/${args.componentId}/tokens.json`
      : `${basePath}/tokens.json`;
    
    const jsonBlob = await put(jsonPath, args.jsonContent, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
    results.jsonUrl = jsonBlob.url;

    console.log(`[STORAGE] Uploaded JSON bundle to: ${jsonBlob.url}`);

    // Upload CSS bundle if provided
    if (args.cssContent) {
      const cssPath = args.componentId
        ? `${basePath}/components/${args.componentId}/tokens.css`
        : `${basePath}/tokens.css`;
      
      const cssBlob = await put(cssPath, args.cssContent, {
        access: "public",
        contentType: "text/css",
        addRandomSuffix: false,
        // Cache for 1 year (browser cache)
        cacheControlMaxAge: 31536000, // 1 year in seconds
      });
      results.cssUrl = cssBlob.url;

      console.log(`[STORAGE] Uploaded CSS bundle to: ${cssBlob.url}`);

      // Upload mode-specific CSS files if multiple modes
      if (args.modes && args.modes.length > 1) {
        for (const mode of args.modes) {
          // Generate mode-specific CSS
          const modeCss = generateModeCSS(args.cssContent, mode);
          const modeCssPath = `${basePath}/tokens.${mode}.css`;
          
          const modeBlob = await put(modeCssPath, modeCss, {
            access: "public",
            contentType: "text/css",
            addRandomSuffix: false,
            cacheControlMaxAge: 31536000, // 1 year
          });
          
          console.log(`[STORAGE] Uploaded ${mode} mode CSS to: ${modeBlob.url}`);
        }
      }
    }

    return results;
  },
});

/**
 * Generate mode-specific CSS from base CSS
 * Extracts only the relevant mode selector and :root fallback
 */
function generateModeCSS(baseCss: string, mode: string): string {
  // If CSS already has mode selectors, extract the relevant one
  if (baseCss.includes(`[data-theme="${mode}"]`)) {
    const lines = baseCss.split("\n");
    const modeLines: string[] = [];
    let inModeBlock = false;
    let foundModeBlock = false;
    
    // Extract header comments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("/*") && !line.includes("Modes:")) {
        modeLines.push(line);
      } else if (line.trim() === "") {
        modeLines.push(line);
      } else if (line.includes(`[data-theme="${mode}"]`)) {
        foundModeBlock = true;
        inModeBlock = true;
        modeLines.push(line);
      } else if (inModeBlock && line.trim() === "}") {
        modeLines.push(line);
        inModeBlock = false;
        // Also include :root block for fallback
        if (foundModeBlock) {
          // Find :root block
          let inRootBlock = false;
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].includes(":root")) {
              inRootBlock = true;
              modeLines.push("");
              modeLines.push(lines[j]);
            } else if (inRootBlock && lines[j].trim() === "}") {
              modeLines.push(lines[j]);
              break;
            } else if (inRootBlock) {
              modeLines.push(lines[j]);
            }
          }
        }
        break;
      } else if (inModeBlock) {
        modeLines.push(line);
      }
    }
    
    return modeLines.join("\n");
  }
  
  // If no mode selectors, return base CSS (for backward compatibility)
  return baseCss;
}

/**
 * Check if bundle exists in storage
 */
export const checkBundleExists = action({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    version: v.string(),
    type: v.union(v.literal("global"), v.literal("component")),
    componentId: v.optional(v.id("components")),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const basePath = `tenants/${args.tenantId}/projects/${args.projectId}/bundles/${args.version}`;
    const jsonPath = args.componentId
      ? `${basePath}/components/${args.componentId}/tokens.json`
      : `${basePath}/tokens.json`;
    
    try {
      await head(jsonPath);
      return true;
    } catch {
      return false;
    }
  },
});

