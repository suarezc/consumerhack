/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as answers from "../answers.js";
import type * as crons from "../crons.js";
import type * as days from "../days.js";
import type * as demo from "../demo.js";
import type * as http from "../http.js";
import type * as judgeHook from "../judgeHook.js";
import type * as lanterns from "../lanterns.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lifecycle from "../lifecycle.js";
import type * as notes from "../notes.js";
import type * as questions from "../questions.js";
import type * as trees from "../trees.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  answers: typeof answers;
  crons: typeof crons;
  days: typeof days;
  demo: typeof demo;
  http: typeof http;
  judgeHook: typeof judgeHook;
  lanterns: typeof lanterns;
  "lib/payments": typeof lib_payments;
  lifecycle: typeof lifecycle;
  notes: typeof notes;
  questions: typeof questions;
  trees: typeof trees;
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
