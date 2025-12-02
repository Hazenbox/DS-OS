/* eslint-disable */
/**
 * Generated data model types.
 * 
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Run `npx convex dev` to regenerate.
 */

import type { DataModelFromSchemaDefinition } from "convex/server";
import type { DocumentByName, TableNamesInDataModel } from "convex/server";
import type schema from "../schema.js";

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 */
export type Id<TableName extends TableNames> = Doc<TableName>["_id"];

/**
 * A type describing your Convex data model.
 */
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

