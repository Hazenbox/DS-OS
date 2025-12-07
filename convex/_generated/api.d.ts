/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessibilityTesting from "../accessibilityTesting.js";
import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as blendModeUtils from "../blendModeUtils.js";
import type * as claudeExtraction from "../claudeExtraction.js";
import type * as codeGenerator from "../codeGenerator.js";
import type * as componentIntelligence from "../componentIntelligence.js";
import type * as components_ from "../components.js";
import type * as figma from "../figma.js";
import type * as figmaExtraction from "../figmaExtraction.js";
import type * as fontFiles from "../fontFiles.js";
import type * as github from "../github.js";
import type * as gradientUtils from "../gradientUtils.js";
import type * as http from "../http.js";
import type * as imlExtraction from "../imlExtraction.js";
import type * as irsExtraction from "../irsExtraction.js";
import type * as irtExtraction from "../irtExtraction.js";
import type * as mdxGenerator from "../mdxGenerator.js";
import type * as migrations_clearAllData from "../migrations/clearAllData.js";
import type * as migrations_fixOrphanedRecords from "../migrations/fixOrphanedRecords.js";
import type * as migrations_tenantMigration from "../migrations/tenantMigration.js";
import type * as nodeRenderer from "../nodeRenderer.js";
import type * as projectMembers from "../projectMembers.js";
import type * as projects from "../projects.js";
import type * as rateLimit from "../rateLimit.js";
import type * as releases from "../releases.js";
import type * as scim_events from "../scim/events.js";
import type * as scim_helpers from "../scim/helpers.js";
import type * as scim_users from "../scim/users.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as sso_config from "../sso/config.js";
import type * as sso_oidc from "../sso/oidc.js";
import type * as sso_oidcAction from "../sso/oidcAction.js";
import type * as tenantMiddleware from "../tenantMiddleware.js";
import type * as tenants from "../tenants.js";
import type * as textOnPathUtils from "../textOnPathUtils.js";
import type * as tokenFiles from "../tokenFiles.js";
import type * as tokens from "../tokens.js";
import type * as vectorGraphicsUtils from "../vectorGraphicsUtils.js";
import type * as visualDiff from "../visualDiff.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessibilityTesting: typeof accessibilityTesting;
  activity: typeof activity;
  auth: typeof auth;
  blendModeUtils: typeof blendModeUtils;
  claudeExtraction: typeof claudeExtraction;
  codeGenerator: typeof codeGenerator;
  componentIntelligence: typeof componentIntelligence;
  components: typeof components_;
  figma: typeof figma;
  figmaExtraction: typeof figmaExtraction;
  fontFiles: typeof fontFiles;
  github: typeof github;
  gradientUtils: typeof gradientUtils;
  http: typeof http;
  imlExtraction: typeof imlExtraction;
  irsExtraction: typeof irsExtraction;
  irtExtraction: typeof irtExtraction;
  mdxGenerator: typeof mdxGenerator;
  "migrations/clearAllData": typeof migrations_clearAllData;
  "migrations/fixOrphanedRecords": typeof migrations_fixOrphanedRecords;
  "migrations/tenantMigration": typeof migrations_tenantMigration;
  nodeRenderer: typeof nodeRenderer;
  projectMembers: typeof projectMembers;
  projects: typeof projects;
  rateLimit: typeof rateLimit;
  releases: typeof releases;
  "scim/events": typeof scim_events;
  "scim/helpers": typeof scim_helpers;
  "scim/users": typeof scim_users;
  seed: typeof seed;
  sessions: typeof sessions;
  settings: typeof settings;
  "sso/config": typeof sso_config;
  "sso/oidc": typeof sso_oidc;
  "sso/oidcAction": typeof sso_oidcAction;
  tenantMiddleware: typeof tenantMiddleware;
  tenants: typeof tenants;
  textOnPathUtils: typeof textOnPathUtils;
  tokenFiles: typeof tokenFiles;
  tokens: typeof tokens;
  vectorGraphicsUtils: typeof vectorGraphicsUtils;
  visualDiff: typeof visualDiff;
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
