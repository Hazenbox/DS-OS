/**
 * Tenant Migration Script
 * 
 * Migrates existing user-owned data to tenant-scoped data.
 * 
 * Strategy:
 * 1. For each user, create a "personal" tenant if they don't have one
 * 2. Migrate all user-owned projects to tenant-owned
 * 3. Update all child records (tokens, components, etc.) with tenantId
 * 
 * Usage:
 * - Run in dry-run mode first to see what will be migrated
 * - Then run actual migration
 * - Verify data integrity
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { createPersonalTenant } from "../tenantMiddleware";

// ============================================================================
// DRY RUN - Preview migration without making changes
// ============================================================================

export const dryRun = query({
  args: {},
  handler: async (ctx) => {
    const results = {
      usersToMigrate: 0,
      projectsToMigrate: 0,
      tokensToMigrate: 0,
      componentsToMigrate: 0,
      tokenFilesToMigrate: 0,
      releasesToMigrate: 0,
      activitiesToMigrate: 0,
      settingsToMigrate: 0,
      errors: [] as string[],
    };

    try {
      // Get all users
      const users = await ctx.db.query("users").collect();
      results.usersToMigrate = users.length;

      // For each user, check their projects
      for (const user of users) {
        if (!user.email) continue;

        // Check if user already has a tenant
        const existingTenantUser = await ctx.db
          .query("tenantUsers")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .first();

        if (existingTenantUser) {
          // User already has tenant, skip
          continue;
        }

        // Count projects for this user
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", user.email))
          .collect();

        results.projectsToMigrate += projects.length;

        // Count child records
        for (const project of projects) {
          const tokens = await ctx.db
            .query("tokens")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();
          results.tokensToMigrate += tokens.length;

          const components = await ctx.db
            .query("components")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();
          results.componentsToMigrate += components.length;

          const tokenFiles = await ctx.db
            .query("tokenFiles")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();
          results.tokenFilesToMigrate += tokenFiles.length;

          const releases = await ctx.db
            .query("releases")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();
          results.releasesToMigrate += releases.length;

          const activities = await ctx.db
            .query("activity")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();
          results.activitiesToMigrate += activities.length;
        }

        // Count settings
        const settings = await ctx.db
          .query("settings")
          .withIndex("by_user", (q) => q.eq("userId", user.email))
          .collect();
        results.settingsToMigrate += settings.length;
      }
    } catch (error: any) {
      results.errors.push(error.message || String(error));
    }

    return results;
  },
});

// ============================================================================
// ACTUAL MIGRATION
// ============================================================================

export const migrate = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRunMode = args.dryRun ?? false;
    const results = {
      tenantsCreated: 0,
      projectsMigrated: 0,
      tokensMigrated: 0,
      componentsMigrated: 0,
      tokenFilesMigrated: 0,
      releasesMigrated: 0,
      activitiesMigrated: 0,
      settingsMigrated: 0,
      errors: [] as string[],
    };

    try {
      // Get all users
      const users = await ctx.db.query("users").collect();

      for (const user of users) {
        if (!user.email) continue;

        try {
          // Check if user already has a tenant
          const existingTenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();

          let tenantId: Id<"tenants">;

          if (existingTenantUser) {
            // User already has tenant, use it
            tenantId = existingTenantUser.tenantId;
          } else {
            // Create personal tenant
            if (!dryRunMode) {
              tenantId = await createPersonalTenant(ctx, user._id, user.email);
              results.tenantsCreated++;
            } else {
              // In dry run, just count
              results.tenantsCreated++;
              continue; // Skip actual migration in dry run
            }
          }

          // Migrate projects
          const projects = await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", user.email))
            .collect();

          for (const project of projects) {
            if (!dryRunMode) {
              await ctx.db.patch(project._id, {
                tenantId,
              });
            }
            results.projectsMigrated++;

            // Migrate child records
            const tokens = await ctx.db
              .query("tokens")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            for (const token of tokens) {
              if (!dryRunMode) {
                await ctx.db.patch(token._id, {
                  tenantId,
                });
              }
              results.tokensMigrated++;
            }

            const components = await ctx.db
              .query("components")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            for (const component of components) {
              if (!dryRunMode) {
                await ctx.db.patch(component._id, {
                  tenantId,
                });
              }
              results.componentsMigrated++;
            }

            const tokenFiles = await ctx.db
              .query("tokenFiles")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            for (const tokenFile of tokenFiles) {
              if (!dryRunMode) {
                await ctx.db.patch(tokenFile._id, {
                  tenantId,
                });
              }
              results.tokenFilesMigrated++;
            }

            const releases = await ctx.db
              .query("releases")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            for (const release of releases) {
              if (!dryRunMode) {
                await ctx.db.patch(release._id, {
                  tenantId,
                });
              }
              results.releasesMigrated++;
            }

            const activities = await ctx.db
              .query("activity")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            for (const activity of activities) {
              if (!dryRunMode) {
                await ctx.db.patch(activity._id, {
                  tenantId,
                });
              }
              results.activitiesMigrated++;
            }
          }

          // Migrate settings
          const settings = await ctx.db
            .query("settings")
            .withIndex("by_user", (q) => q.eq("userId", user.email))
            .collect();
          for (const setting of settings) {
            if (!dryRunMode) {
              await ctx.db.patch(setting._id, {
                tenantId,
              });
            }
            results.settingsMigrated++;
          }
        } catch (error: any) {
          results.errors.push(`Error migrating user ${user.email}: ${error.message || String(error)}`);
        }
      }
    } catch (error: any) {
      results.errors.push(error.message || String(error));
    }

    return {
      ...results,
      dryRun: dryRunMode,
      message: dryRunMode
        ? "Dry run completed. No changes were made."
        : "Migration completed successfully.",
    };
  },
});

// ============================================================================
// VERIFICATION - Check migration integrity
// ============================================================================

export const verify = query({
  args: {},
  handler: async (ctx) => {
    const issues: string[] = [];

    // Check for projects without tenantId
    const projectsWithoutTenant = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("tenantId"), undefined))
      .collect();
    if (projectsWithoutTenant.length > 0) {
      issues.push(`${projectsWithoutTenant.length} projects missing tenantId`);
    }

    // Check for tokens without tenantId
    const tokensWithoutTenant = await ctx.db
      .query("tokens")
      .filter((q) => q.eq(q.field("tenantId"), undefined))
      .collect();
    if (tokensWithoutTenant.length > 0) {
      issues.push(`${tokensWithoutTenant.length} tokens missing tenantId`);
    }

    // Check for components without tenantId
    const componentsWithoutTenant = await ctx.db
      .query("components")
      .filter((q) => q.eq(q.field("tenantId"), undefined))
      .collect();
    if (componentsWithoutTenant.length > 0) {
      issues.push(`${componentsWithoutTenant.length} components missing tenantId`);
    }

    // Check for orphaned records (tenantId doesn't exist)
    const tenants = await ctx.db.query("tenants").collect();
    const tenantIds = new Set(tenants.map((t) => t._id));

    const allProjects = await ctx.db.query("projects").collect();
    for (const project of allProjects) {
      if (project.tenantId && !tenantIds.has(project.tenantId)) {
        issues.push(`Project ${project._id} has invalid tenantId ${project.tenantId}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  },
});

