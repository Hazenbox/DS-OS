/**
 * Fix Orphaned Records
 * 
 * Finds and fixes any records that don't have tenantId after migration.
 * This can happen if:
 * - Records were created after migration but before schema update
 * - Migration missed some records
 * - System activity records
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// Find all records without tenantId
export const findOrphanedRecords = query({
  args: {},
  handler: async (ctx) => {
    const results = {
      projects: [] as Id<"projects">[],
      tokens: [] as Id<"tokens">[],
      components: [] as Id<"components">[],
      tokenFiles: [] as Id<"tokenFiles">[],
      releases: [] as Id<"releases">[],
      activities: [] as Id<"activity">[],
      settings: [] as Id<"settings">[],
      brands: [] as Id<"brands">[],
      figmaExtractions: [] as Id<"figmaExtractions">[],
    };

    // Find projects without tenantId
    const allProjects = await ctx.db.query("projects").collect();
    for (const project of allProjects) {
      if (!project.tenantId) {
        results.projects.push(project._id);
      }
    }

    // Find tokens without tenantId
    const allTokens = await ctx.db.query("tokens").collect();
    for (const token of allTokens) {
      if (!token.tenantId) {
        results.tokens.push(token._id);
      }
    }

    // Find components without tenantId
    const allComponents = await ctx.db.query("components").collect();
    for (const component of allComponents) {
      if (!component.tenantId) {
        results.components.push(component._id);
      }
    }

    // Find tokenFiles without tenantId
    const allTokenFiles = await ctx.db.query("tokenFiles").collect();
    for (const tokenFile of allTokenFiles) {
      if (!tokenFile.tenantId) {
        results.tokenFiles.push(tokenFile._id);
      }
    }

    // Find releases without tenantId
    const allReleases = await ctx.db.query("releases").collect();
    for (const release of allReleases) {
      if (!release.tenantId) {
        results.releases.push(release._id);
      }
    }

    // Find activities without tenantId
    const allActivities = await ctx.db.query("activity").collect();
    for (const activity of allActivities) {
      if (!activity.tenantId) {
        results.activities.push(activity._id);
      }
    }

    // Find settings without tenantId
    const allSettings = await ctx.db.query("settings").collect();
    for (const setting of allSettings) {
      if (!setting.tenantId) {
        results.settings.push(setting._id);
      }
    }

    // Find brands without tenantId
    const allBrands = await ctx.db.query("brands").collect();
    for (const brand of allBrands) {
      if (!brand.tenantId) {
        results.brands.push(brand._id);
      }
    }

    // Find figmaExtractions without tenantId
    const allFigmaExtractions = await ctx.db.query("figmaExtractions").collect();
    for (const extraction of allFigmaExtractions) {
      if (!extraction.tenantId) {
        results.figmaExtractions.push(extraction._id);
      }
    }

    return results;
  },
});

// Fix orphaned records by associating them with a tenant
export const fixOrphanedRecords = mutation({
  args: {
    defaultTenantId: v.optional(v.id("tenants")), // Optional - will try to find tenant from project/user
  },
  handler: async (ctx, args) => {
    const results = {
      fixed: 0,
      deleted: 0,
      errors: [] as string[],
    };

    try {
      // Find orphaned activities
      const orphanedActivities = await ctx.db
        .query("activity")
        .filter((q) => q.eq(q.field("tenantId"), undefined))
        .collect();

      for (const activity of orphanedActivities) {
        try {
          // Try to find tenant from project
          if (activity.projectId) {
            const project = await ctx.db.get(activity.projectId);
            if (project?.tenantId) {
              await ctx.db.patch(activity._id, { tenantId: project.tenantId });
              results.fixed++;
              continue;
            }
          }

          // If no project or project has no tenant, delete the orphaned activity
          // (these are likely old system activities)
          await ctx.db.delete(activity._id);
          results.deleted++;
        } catch (error: any) {
          results.errors.push(`Error fixing activity ${activity._id}: ${error.message}`);
        }
      }

      // Similar logic for other record types if needed
      // For now, we'll focus on activities since that's the immediate issue

    } catch (error: any) {
      results.errors.push(error.message || String(error));
    }

    return results;
  },
});

