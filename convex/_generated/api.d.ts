/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as claudeExtraction from "../claudeExtraction.js";
import type * as components_ from "../components.js";
import type * as figma from "../figma.js";
import type * as figmaExtraction from "../figmaExtraction.js";
import type * as github from "../github.js";
import type * as migrations_clearAllData from "../migrations/clearAllData.js";
import type * as migrations_fixOrphanedRecords from "../migrations/fixOrphanedRecords.js";
import type * as migrations_tenantMigration from "../migrations/tenantMigration.js";
import type * as projectMembers from "../projectMembers.js";
import type * as projects from "../projects.js";
import type * as rateLimit from "../rateLimit.js";
import type * as releases from "../releases.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as tenantMiddleware from "../tenantMiddleware.js";
import type * as tenants from "../tenants.js";
import type * as tokenFiles from "../tokenFiles.js";
import type * as tokens from "../tokens.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  auth: typeof auth;
  claudeExtraction: typeof claudeExtraction;
  components: typeof components_;
  figma: typeof figma;
  figmaExtraction: typeof figmaExtraction;
  github: typeof github;
  "migrations/clearAllData": typeof migrations_clearAllData;
  "migrations/fixOrphanedRecords": typeof migrations_fixOrphanedRecords;
  "migrations/tenantMigration": typeof migrations_tenantMigration;
  projectMembers: typeof projectMembers;
  projects: typeof projects;
  rateLimit: typeof rateLimit;
  releases: typeof releases;
  seed: typeof seed;
  sessions: typeof sessions;
  settings: typeof settings;
  tenantMiddleware: typeof tenantMiddleware;
  tenants: typeof tenants;
  tokenFiles: typeof tokenFiles;
  tokens: typeof tokens;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
