/**
 * Migration Runner Script
 * 
 * This script helps run the tenant migration from the command line.
 * 
 * Usage:
 * 1. Make sure Convex dev server is running: `npx convex dev`
 * 2. Run this script: `npx tsx scripts/run-migration.ts`
 * 
 * Or use the Convex dashboard:
 * 1. Go to your Convex dashboard
 * 2. Navigate to Functions
 * 3. Run `migrations.tenantMigration.dryRun` first
 * 4. Then run `migrations.tenantMigration.migrate` with `{ dryRun: false }`
 * 5. Finally run `migrations.tenantMigration.verify` to check
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL or CONVEX_URL environment variable is required");
  console.log("\nTo get your Convex URL:");
  console.log("1. Run 'npx convex dev'");
  console.log("2. Check your .env.local file for VITE_CONVEX_URL");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function runMigration() {
  console.log("🚀 Starting Tenant Migration Process\n");

  try {
    // Step 1: Dry Run
    console.log("📊 Step 1: Running dry run to preview changes...");
    const dryRunResult = await client.query(api.migrations.tenantMigration.dryRun, {});
    console.log("\n📋 Dry Run Results:");
    console.log(`   Users to migrate: ${dryRunResult.usersToMigrate}`);
    console.log(`   Projects to migrate: ${dryRunResult.projectsToMigrate}`);
    console.log(`   Tokens to migrate: ${dryRunResult.tokensToMigrate}`);
    console.log(`   Components to migrate: ${dryRunResult.componentsToMigrate}`);
    console.log(`   Token Files to migrate: ${dryRunResult.tokenFilesToMigrate}`);
    console.log(`   Releases to migrate: ${dryRunResult.releasesToMigrate}`);
    console.log(`   Activities to migrate: ${dryRunResult.activitiesToMigrate}`);
    console.log(`   Settings to migrate: ${dryRunResult.settingsToMigrate}`);
    
    if (dryRunResult.errors.length > 0) {
      console.log("\n⚠️  Errors found:");
      dryRunResult.errors.forEach((error) => console.log(`   - ${error}`));
    }

    if (dryRunResult.projectsToMigrate === 0) {
      console.log("\n✅ No data to migrate. All data is already tenant-scoped!");
      return;
    }

    // Step 2: Confirm
    console.log("\n⚠️  This will migrate all existing data to tenant-scoped data.");
    console.log("   Make sure you have a backup if needed.");
    console.log("\n   To proceed, run the migration from the Convex dashboard:");
    console.log("   - Function: migrations.tenantMigration.migrate");
    console.log("   - Args: { dryRun: false }");
    console.log("\n   Or modify this script to auto-proceed (remove the return below).");

    // Uncomment the following to auto-run migration:
    // console.log("\n🔄 Step 2: Running actual migration...");
    // const migrationResult = await client.mutation(api.migrations.tenantMigration.migrate, { dryRun: false });
    // console.log("\n✅ Migration Results:");
    // console.log(`   Tenants created: ${migrationResult.tenantsCreated}`);
    // console.log(`   Projects migrated: ${migrationResult.projectsMigrated}`);
    // console.log(`   Tokens migrated: ${migrationResult.tokensMigrated}`);
    // console.log(`   Components migrated: ${migrationResult.componentsMigrated}`);
    // console.log(`   Token Files migrated: ${migrationResult.tokenFilesMigrated}`);
    // console.log(`   Releases migrated: ${migrationResult.releasesMigrated}`);
    // console.log(`   Activities migrated: ${migrationResult.activitiesMigrated}`);
    // console.log(`   Settings migrated: ${migrationResult.settingsMigrated}`);
    // 
    // if (migrationResult.errors.length > 0) {
    //   console.log("\n⚠️  Errors during migration:");
    //   migrationResult.errors.forEach((error) => console.log(`   - ${error}`));
    // }

    // Step 3: Verify
    // console.log("\n🔍 Step 3: Verifying migration...");
    // const verifyResult = await client.query(api.migrations.tenantMigration.verify, {});
    // if (verifyResult.valid) {
    //   console.log("✅ Migration verified successfully!");
    // } else {
    //   console.log("❌ Migration verification found issues:");
    //   verifyResult.issues.forEach((issue) => console.log(`   - ${issue}`));
    // }

  } catch (error: any) {
    console.error("\n❌ Error running migration:", error.message);
    process.exit(1);
  }
}

runMigration();

