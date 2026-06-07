// Encode a schema-valid state object to canonical URL parameters.
// Recurses the schema alongside the value, emitting dotted-path leaves and a
// bare `path=` marker for a present-but-empty value.

import type { JsonSchema, JsonValue, StateObject } from "./types.ts";
import { nodeType, resolveRef, type SchemaNode } from "./schema.ts";

// An ordered (key, value) pair destined for URLSearchParams.
type Entry = [string, string];

// Serialise a state object to canonical, schema-ordered URL parameters.
export function toParams(root: JsonSchema, state: StateObject): URLSearchParams {
  const entries: Entry[] = [];
  const rootNode = resolveRef(root, root as SchemaNode);
  encodeValue(root, rootNode, state, "", entries);
  return new URLSearchParams(entries);
}

// Extend a dotted path with one segment.
function joinPath(prefix: string, segment: string): string {
  return prefix === "" ? segment : `${prefix}.${segment}`;
}

// Render a scalar; null and "" both serialise to the empty marker value.
function serializeScalar(value: JsonValue): string {
  return value === null ? "" : String(value);
}

function encodeValue(
  root: JsonSchema,
  node: SchemaNode,
  value: JsonValue,
  path: string,
  entries: Entry[],
): void {
  const declared = nodeType(node);
  if (declared === "object") {
    encodeObject(root, node, value, path, entries);
  } else if (declared === "array") {
    encodeArray(root, node, value, path, entries);
  } else {
    entries.push([path, serializeScalar(value)]);
  }
}

function encodeObject(
  root: JsonSchema,
  node: SchemaNode,
  value: JsonValue,
  path: string,
  entries: Entry[],
): void {
  const properties = (node["properties"] ?? {}) as Record<string, SchemaNode>;
  const record = value as { [key: string]: JsonValue };
  const before = entries.length;
  for (const [key, childNode] of Object.entries(properties)) {
    if (!(key in record)) {
      continue;
    }
    const child = resolveRef(root, childNode);
    encodeValue(root, child, record[key], joinPath(path, key), entries);
  }
  if (entries.length === before && path !== "") {
    entries.push([path, ""]);
  }
}

function encodeArray(
  root: JsonSchema,
  node: SchemaNode,
  value: JsonValue,
  path: string,
  entries: Entry[],
): void {
  const items = resolveRef(root, node["items"] as SchemaNode);
  const elements = value as JsonValue[];
  if (elements.length === 0) {
    if (path !== "") {
      entries.push([path, ""]);
    }
    return;
  }
  for (let idx = 0; idx < elements.length; idx++) {
    encodeValue(root, items, elements[idx], joinPath(path, String(idx)), entries);
  }
}
