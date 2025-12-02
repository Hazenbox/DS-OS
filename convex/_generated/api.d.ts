/* eslint-disable */
/**
 * Generated API types.
 * 
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Run `npx convex dev` to regenerate.
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as tokens from "../tokens.js";
import type * as components from "../components.js";
import type * as activity from "../activity.js";
import type * as releases from "../releases.js";
import type * as seed from "../seed.js";

/**
 * A utility for referencing Convex functions in your app's API.
 */
declare const fullApi: ApiFromModules<{
  tokens: typeof tokens;
  components: typeof components;
  activity: typeof activity;
  releases: typeof releases;
  seed: typeof seed;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

