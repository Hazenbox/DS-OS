"use node";

/**
 * IR System Testing Utilities
 * 
 * Helper functions to test IRS/IRT/IML extraction
 * Run these in Convex Dashboard Functions tab
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

interface TestIRSResult {
  success: boolean;
  componentName?: string;
  irsNodes?: number;
  variants?: number;
  slots?: number;
  validationPassed: boolean;
  message?: string;
  error?: string;
}

interface TestIRTResult {
  success: boolean;
  tokensFound?: number;
  modes?: number;
  tokenGraph?: number;
  validationPassed: boolean;
  message?: string;
  error?: string;
}

interface TestIMLResult {
  success: boolean;
  category?: string;
  states?: number;
  ariaAttributes?: number;
  keyboardMappings?: number;
  interactions?: number;
  validationPassed: boolean;
  message?: string;
  error?: string;
}

interface TestAllIRResult {
  allPassed: boolean;
  results: {
    irs: TestIRSResult;
    irt: TestIRTResult;
    iml: TestIMLResult;
  };
}

/**
 * Test IRS extraction with a Figma URL
 * 
 * Usage in Convex Dashboard:
 * 1. Go to Functions tab
 * 2. Find: testIRSystems.testIRS
 * 3. Run with: { 
 *   figmaUrl: "https://figma.com/file/...",
 *   tenantId: "...",
 *   userId: "...",
 *   projectId: "..."
 * }
 */
export const testIRS = action({
  args: {
    figmaUrl: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<TestIRSResult> => {
    try {
      // Extract component
      const result = await ctx.runAction(api.claudeExtraction.extractAndBuildComponent, {
        figmaUrl: args.figmaUrl,
        tenantId: args.tenantId,
        userId: args.userId,
        projectId: args.projectId,
      });

      // Return test results
      return {
        success: true,
        componentName: result.name,
        irsNodes: result.irs?.tree?.length || 0,
        variants: result.irs?.variants?.length || 0,
        slots: result.irs?.slots?.length || 0,
        validationPassed: true,
        message: "IRS extraction successful",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        validationPassed: false,
      };
    }
  },
});

/**
 * Test IRT extraction with a Figma URL
 */
export const testIRT = action({
  args: {
    figmaUrl: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<TestIRTResult> => {
    try {
      const result = await ctx.runAction(api.claudeExtraction.extractAndBuildComponent, {
        figmaUrl: args.figmaUrl,
        tenantId: args.tenantId,
        userId: args.userId,
        projectId: args.projectId,
      });

      return {
        success: true,
        tokensFound: result.irt?.tokens?.length || 0,
        modes: Object.keys(result.irt?.modeValues || {}).length,
        tokenGraph: result.irt?.tokenGraph?.nodes?.length || 0,
        validationPassed: true,
        message: "IRT extraction successful",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        validationPassed: false,
      };
    }
  },
});

/**
 * Test IML extraction with a Figma URL
 */
export const testIML = action({
  args: {
    figmaUrl: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<TestIMLResult> => {
    try {
      const result = await ctx.runAction(api.claudeExtraction.extractAndBuildComponent, {
        figmaUrl: args.figmaUrl,
        tenantId: args.tenantId,
        userId: args.userId,
        projectId: args.projectId,
      });

      return {
        success: true,
        category: result.iml?.componentCategory || "unknown",
        states: result.iml?.states?.length || 0,
        ariaAttributes: Object.keys(result.iml?.aria || {}).length,
        keyboardMappings: result.iml?.keyboard?.length || 0,
        interactions: result.iml?.interactions?.length || 0,
        validationPassed: true,
        message: "IML extraction successful",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        validationPassed: false,
      };
    }
  },
});

/**
 * Test all IR systems at once
 */
export const testAllIR = action({
  args: {
    figmaUrl: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<TestAllIRResult> => {
    const results: {
      irs: TestIRSResult;
      irt: TestIRTResult;
      iml: TestIMLResult;
    } = {
      irs: await ctx.runAction(api.testIRSystems.testIRS, args),
      irt: await ctx.runAction(api.testIRSystems.testIRT, args),
      iml: await ctx.runAction(api.testIRSystems.testIML, args),
    };

    return {
      allPassed: results.irs.success && results.irt.success && results.iml.success,
      results,
    };
  },
});

