"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getTenantContext } from "./tenantMiddleware";

/**
 * Release Testing Module
 * 
 * Runs visual diff and accessibility tests for all components in a release.
 * Results are stored in the release record.
 */

/**
 * Run tests for all components in a release
 */
export const runReleaseTests = action({
  args: {
    releaseId: v.id("releases"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    testTypes: v.optional(v.array(v.union(v.literal("visual"), v.literal("accessibility")))),
  },
  handler: async (ctx, args): Promise<{
    visualDiffResults: any[];
    accessibilityResults: any[];
  }> => {
    // Verify tenant access
    await getTenantContext(ctx, args.userId, args.tenantId);
    
    // Get release
    const release = await ctx.runQuery(api.releases.get, {
      id: args.releaseId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    
    if (!release) {
      throw new Error("Release not found");
    }
    
    // Verify release belongs to tenant
    if (release.tenantId !== args.tenantId) {
      throw new Error("Release does not belong to tenant");
    }
    
    const testTypes = args.testTypes || ["visual", "accessibility"];
    const componentIds = release.components || [];
    
    console.log(`[RELEASE TESTS] Running tests for ${componentIds.length} components in release ${args.releaseId}`);
    
    // Run tests for each component
    const visualDiffResults: any[] = [];
    const accessibilityResults: any[] = [];
    
    for (const componentId of componentIds) {
      try {
        // Run visual diff test if requested
        if (testTypes.includes("visual")) {
          try {
            const visualDiffResult = await ctx.runAction(api.visualDiff.runVisualDiffTest, {
              componentId: componentId as Id<"components">,
              tenantId: args.tenantId,
              userId: args.userId,
              threshold: 0.1, // 10% difference threshold
            });
            
            visualDiffResults.push({
              componentId,
              variantId: visualDiffResult.variantId,
              passed: visualDiffResult.passed,
              diffPercentage: visualDiffResult.diffPercentage,
              diffImage: visualDiffResult.diffImage,
              threshold: visualDiffResult.threshold,
              screenshotUrl: visualDiffResult.screenshotUrl,
              figmaImageUrl: visualDiffResult.figmaImageUrl,
              errors: visualDiffResult.errors,
              testedAt: Date.now(),
            });
            
            console.log(`[RELEASE TESTS] Visual diff for ${componentId}: ${visualDiffResult.passed ? 'PASSED' : 'FAILED'} (${(visualDiffResult.diffPercentage * 100).toFixed(2)}% diff)`);
          } catch (error) {
            console.error(`[RELEASE TESTS] Visual diff failed for ${componentId}:`, error);
            visualDiffResults.push({
              componentId,
              passed: false,
              diffPercentage: 1.0, // 100% difference on error
              threshold: 0.1,
              errors: [error instanceof Error ? error.message : "Visual diff test failed"],
              testedAt: Date.now(),
            });
          }
        }
        
        // Run accessibility test if requested
        if (testTypes.includes("accessibility")) {
          try {
            const accessibilityResult = await ctx.runAction(api.accessibilityTesting.runAccessibilityTest, {
              componentId: componentId as Id<"components">,
              tenantId: args.tenantId,
              userId: args.userId,
              rules: {
                level: "AA", // WCAG AA compliance
              },
            });
            
            accessibilityResults.push({
              componentId,
              variantId: accessibilityResult.variantId,
              passed: accessibilityResult.passed,
              violations: accessibilityResult.violations,
              testedAt: accessibilityResult.testedAt,
              score: accessibilityResult.score,
            });
            
            console.log(`[RELEASE TESTS] Accessibility for ${componentId}: ${accessibilityResult.passed ? 'PASSED' : 'FAILED'} (score: ${accessibilityResult.score || 0})`);
          } catch (error) {
            console.error(`[RELEASE TESTS] Accessibility test failed for ${componentId}:`, error);
            accessibilityResults.push({
              componentId,
              passed: false,
              violations: [{
                id: "test-error",
                impact: "critical",
                description: error instanceof Error ? error.message : "Accessibility test failed",
                help: "Check component rendering and test setup",
                helpUrl: "",
                nodes: [],
              }],
              testedAt: Date.now(),
              score: 0,
            });
          }
        }
      } catch (error) {
        console.error(`[RELEASE TESTS] Failed to test component ${componentId}:`, error);
        // Continue with other components
      }
    }
    
    // Update release with test results
    await ctx.runMutation(api.releases.updateTestResults, {
      releaseId: args.releaseId,
      tenantId: args.tenantId,
      userId: args.userId,
      visualDiffResults: testTypes.includes("visual") ? visualDiffResults : undefined,
      accessibilityResults: testTypes.includes("accessibility") ? accessibilityResults : undefined,
    });
    
    console.log(`[RELEASE TESTS] Completed tests for release ${args.releaseId}`);
    
    return {
      visualDiffResults,
      accessibilityResults,
    };
  },
});

