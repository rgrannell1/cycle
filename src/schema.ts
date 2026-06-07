// Schema navigation: resolve $ref into $defs, read concrete leaf types, and
// reject schemas that cannot define a bijection.

import type { JsonSchema } from "./types.ts";

// A single node within the schema tree.
export type SchemaNode = Record<string, unknown>;

// The concrete types a leaf or container may declare.
export type ConcreteType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null"
  | "array"
  | "object";

// The only $ref form supported: local pointers into $defs.
const DEFS_PREFIX = "#/$defs/";

const FORBIDDEN_KEYWORDS = ["oneOf", "anyOf", "allOf", "not"];

// Lookup of admissible type names.
const ADMISSIBLE_TYPES: Record<ConcreteType, true> = {
  string: true,
  number: true,
  integer: true,
  boolean: true,
  null: true,
  array: true,
  object: true,
};

// Follow a node's $ref into $defs; return the node unchanged when it has none.
export function resolveRef(root: JsonSchema, node: SchemaNode): SchemaNode {
  const ref = node["$ref"];
  if (ref === undefined) {
    return node;
  }
  if (typeof ref !== "string" || !ref.startsWith(DEFS_PREFIX)) {
    throw new Error(`cycle: unsupported $ref ${String(ref)}`);
  }
  const defName = ref.slice(DEFS_PREFIX.length);
  const defs = root["$defs"] as Record<string, SchemaNode> | undefined;
  const target = defs?.[defName];
  if (target === undefined) {
    throw new Error(`cycle: $ref ${ref} not found in $defs`);
  }
  return target;
}

// Read the single concrete type declared by a node.
export function nodeType(node: SchemaNode): ConcreteType {
  const declared = node["type"];
  if (typeof declared !== "string") {
    throw new Error("cycle: every schema node must declare a single string type");
  }
  if (!(declared in ADMISSIBLE_TYPES)) {
    throw new Error(`cycle: unsupported type ${declared}`);
  }
  return declared as ConcreteType;
}

// Throw if any reachable node uses a forbidden combinator or a non-concrete type.
export function assertAdmissible(root: JsonSchema): void {
  walkAdmissible(root, root as SchemaNode, new Set<string>());
}

function rejectForbidden(node: SchemaNode): void {
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (keyword in node) {
      throw new Error(`cycle: ${keyword} is not supported`);
    }
  }
}

function walkAdmissible(
  root: JsonSchema,
  node: SchemaNode,
  visited: Set<string>,
): void {
  rejectForbidden(node);
  const ref = node["$ref"];
  if (typeof ref === "string") {
    if (visited.has(ref)) {
      return;
    }
    visited.add(ref);
    walkAdmissible(root, resolveRef(root, node), visited);
    return;
  }
  const declared = nodeType(node);
  if (declared === "object") {
    walkObjectChildren(root, node, visited);
  } else if (declared === "array") {
    walkArrayItems(root, node, visited);
  }
}

function walkObjectChildren(
  root: JsonSchema,
  node: SchemaNode,
  visited: Set<string>,
): void {
  const properties = node["properties"] as
    | Record<string, SchemaNode>
    | undefined;
  if (properties === undefined) {
    return;
  }
  for (const child of Object.values(properties)) {
    walkAdmissible(root, child, visited);
  }
}

function walkArrayItems(
  root: JsonSchema,
  node: SchemaNode,
  visited: Set<string>,
): void {
  const items = node["items"] as SchemaNode | undefined;
  if (items === undefined) {
    throw new Error("cycle: array schemas must declare items");
  }
  walkAdmissible(root, items, visited);
}
