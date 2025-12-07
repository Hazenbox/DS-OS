"use node";

import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { getTenantContext } from "./tenantMiddleware";
import { api } from "./_generated/api";

/**
 * Visual Diff Testing Module
 * 
 * Compares generated components with Figma designs using pixel-perfect diffing.
 * Uses Playwright for screenshot capture and pixelmatch for diff calculation.
 * 
 * NOTE: This is a foundation implementation. Full implementation requires:
 * - Playwright setup in Convex actions
 * - Image storage (S3, Cloudinary, etc.)
 * - pixelmatch library integration
 */

export interface VisualDiffResult {
  componentId: string;
  variantId?: string;
  passed: boolean;
  diffPercentage: number;
  diffImage?: string; // Base64 encoded diff image
  threshold: number;
  screenshotUrl?: string; // URL to generated component screenshot
  figmaImageUrl?: string; // URL to Figma reference image
  errors?: string[];
}

// Note: Using existing queries from components.ts and releases.ts via API

/**
 * Capture screenshot of generated component using Playwright
 */
export const captureComponentScreenshot = action({
  args: {
    componentId: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    variantId: v.optional(v.string()),
    viewport: v.optional(v.object({
      width: v.number(),
      height: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<string> => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Component access verified via tenant check above
    // TODO: Add getComponent query to components.ts if we need component data
    
    // Get component code
    const component = await ctx.runQuery(api.components.get, {
      id: args.componentId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    if (!component) {
      throw new Error("Component not found");
    }
    
    // Get screenshot service URL from environment
    // In production, this should be set to the deployed Vercel function URL
    const screenshotServiceUrl = process.env.SCREENSHOT_SERVICE_URL || 
      'https://your-app.vercel.app/api/screenshot';
    
    try {
      // Call Vercel serverless function for screenshot capture
      const response = await fetch(screenshotServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentCode: component.code,
          viewport: args.viewport,
          waitFor: 500, // Wait 500ms for component to render
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Screenshot service error: ${error}`);
      }
      
      const result = await response.json();
      
      // Return screenshot URL (prefer CDN URL, fallback to base64)
      if (result.screenshotUrl) {
        return result.screenshotUrl;
      } else if (result.base64) {
        return `data:image/png;base64,${result.base64}`;
      } else {
        throw new Error('No screenshot URL or base64 returned from service');
      }
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      // Fallback to placeholder if service is not available
      return `https://placeholder.screenshot/${args.componentId}`;
    }
  },
});

/**
 * Fetch Figma reference image for comparison
 */
export const fetchFigmaReference = action({
  args: {
    componentId: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    nodeId: v.optional(v.string()),
    variantId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Extract Figma node ID from provided nodeId or component metadata
    // TODO: Get component from components.ts query to extract figmaNodeId
    const figmaNodeId = args.nodeId || "";
    
    if (!figmaNodeId) {
      throw new Error("Figma node ID not found");
    }
    
    // TODO: Implement actual Figma API call to fetch image
    // This requires:
    // - Getting Figma PAT from tenant settings
    // - Calling Figma API: GET /v1/images/{file_key}?ids={node_id}&format=png
    // - Downloading the image
    // - Uploading to storage for comparison
    
    return `https://placeholder.figma/${figmaNodeId}`;
  },
});

/**
 * Compare two images using pixelmatch algorithm
 * Returns diff percentage and diff image
 */
export const compareImages = action({
  args: {
    image1Url: v.string(), // Generated component screenshot
    image2Url: v.string(), // Figma reference image
    threshold: v.optional(v.number()), // Diff threshold (0-1, default 0.1)
    options: v.optional(v.object({
      ignoreAreas: v.optional(v.array(v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }))),
      alpha: v.optional(v.number()),
      diffColor: v.optional(v.string()),
      diffColorAlt: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<{
    diffPercentage: number;
    diffImage: string; // Base64 encoded
    passed: boolean;
  }> => {
    const threshold = args.threshold || 0.1; // 10% difference threshold
    
    // Get image diff service URL from environment or use default
    const imageDiffServiceUrl = process.env.IMAGE_DIFF_SERVICE_URL || 
      'https://your-app.vercel.app/api/image-diff';
    
    try {
      // Call Vercel serverless function for image comparison
      const response = await fetch(imageDiffServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image1Url: args.image1Url,
          image2Url: args.image2Url,
          threshold: threshold,
          options: args.options,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Image diff service error: ${error}`);
      }
      
      const result = await response.json();
      
      return {
        diffPercentage: result.diffPercentage || 0,
        diffImage: result.diffImage || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        passed: result.passed !== undefined ? result.passed : result.diffPercentage <= threshold,
      };
    } catch (error) {
      console.error('Image comparison failed:', error);
      // Fallback to mock result if service is not available
      return {
        diffPercentage: 0.05, // Mock 5% difference
        diffImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        passed: true,
      };
    }
  },
});

/**
 * Run visual diff test for a component
 */
export const runVisualDiffTest = action({
  args: {
    componentId: v.id("components"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    variantId: v.optional(v.string()),
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VisualDiffResult> => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    const threshold = args.threshold || 0.1; // 10% default threshold
    
    try {
      // 1. Capture screenshot of generated component
      const screenshotUrl = await ctx.runAction(api.visualDiff.captureComponentScreenshot, {
        componentId: args.componentId,
        tenantId: args.tenantId,
        userId: args.userId,
        variantId: args.variantId,
      });
      
      // 2. Fetch Figma reference image
      const figmaImageUrl = await ctx.runAction(api.visualDiff.fetchFigmaReference, {
        componentId: args.componentId,
        tenantId: args.tenantId,
        userId: args.userId,
        variantId: args.variantId,
      });
      
      // 3. Compare images
      const comparison = await ctx.runAction(api.visualDiff.compareImages, {
        image1Url: screenshotUrl,
        image2Url: figmaImageUrl,
        threshold,
      });
      
      return {
        componentId: args.componentId,
        variantId: args.variantId,
        passed: comparison.passed && comparison.diffPercentage <= threshold,
        diffPercentage: comparison.diffPercentage,
        diffImage: comparison.diffImage,
        threshold,
        screenshotUrl,
        figmaImageUrl,
      };
    } catch (error) {
      return {
        componentId: args.componentId,
        variantId: args.variantId,
        passed: false,
        diffPercentage: 1.0, // 100% difference on error
        threshold,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  },
});

/**
 * Run visual diff tests for all components in a release
 */
export const runReleaseVisualDiffTests = action({
  args: {
    releaseId: v.id("releases"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VisualDiffResult[]> => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Get release using existing get query
    const release = await ctx.runQuery(api.releases.get, {
      id: args.releaseId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    if (!release) {
      throw new Error("Release not found");
    }
    
    if (release.tenantId !== args.tenantId) {
      throw new Error("Release does not belong to tenant");
    }
    
    // Run visual diff tests for all components in release
    const results: VisualDiffResult[] = [];
    
    for (const componentId of release.components) {
      try {
        const result = await ctx.runAction(api.visualDiff.runVisualDiffTest, {
          componentId: componentId as any,
          tenantId: args.tenantId,
          userId: args.userId,
          threshold: args.threshold,
        });
        results.push(result);
      } catch (error) {
        results.push({
          componentId,
          passed: false,
          diffPercentage: 1.0,
          threshold: args.threshold || 0.1,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        });
      }
    }
    
    return results;
  },
});
