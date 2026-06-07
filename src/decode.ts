// Decode canonical URL parameters back to a schema-valid state object.
// Recurses the schema alongside the parameter set, coercing each leaf string to
// its declared type and reading a bare `path=` marker as a present-but-empty value.

import type { JsonSchema, JsonValue, StateObject } from "./types.ts";
import {
  type ConcreteType,
  nodeType,
  resolveRef,
  type SchemaNode,
} from "./schema.ts";

// The outcome of decoding one subtree: whether the path was present, and its value.
interface Decoded {
  present: boolean;
  value: JsonValue;
}

const ABSENT: Decoded = { present: false, value: null };

// Parse canonical parameters into the schema-typed state object.
export function fromParams(root: JsonSchema, params: URLSearchParams): StateObject {
  const rootNode = resolveRef(root, root as SchemaNode);
  const decoded = decodeValue(root, rootNode, "", params);
  return (decoded.present ? decoded.value : {}) as StateObject;
}

// Extend a dotted path with one segment.
function joinPath(prefix: string, segment: string): string {
  return prefix === "" ? segment : `${prefix}.${segment}`;
}

// Whether any parameter describes the subtree rooted at this path.
function presentAt(params: URLSearchParams, path: string): boolean {
  if (path === "") {
    return true;
  }
  if (params.has(path)) {
    return true;
  }
  const prefix = `${path}.`;
  for (const key of params.keys()) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function decodeValue(
  root: JsonSchema,
  node: SchemaNode,
  path: string,
  params: URLSearchParams,
): Decoded {
  const declared = nodeType(node);
  if (declared === "object") {
    return decodeObject(root, node, path, params);
  }
  if (declared === "array") {
    return decodeArray(root, node, path, params);
  }
  return decodeScalar(declared, path, params);
}

function decodeObject(
  root: JsonSchema,
  node: SchemaNode,
  path: string,
  params: URLSearchParams,
): Decoded {
  if (!presentAt(params, path)) {
    return ABSENT;
  }
  const properties = (node["properties"] ?? {}) as Record<string, SchemaNode>;
  const record: { [key: string]: JsonValue } = {};
  for (const [key, childNode] of Object.entries(properties)) {
    const child = resolveRef(root, childNode);
    const decoded = decodeValue(root, child, joinPath(path, key), params);
    if (decoded.present) {
      record[key] = decoded.value;
    }
  }
  // No present children: the subtree exists only via a bare marker, so it is {}.
  return { present: true, value: record };
}

function decodeArray(
  root: JsonSchema,
  node: SchemaNode,
  path: string,
  params: URLSearchParams,
): Decoded {
  if (!presentAt(params, path)) {
    return ABSENT;
  }
  const items = resolveRef(root, node["items"] as SchemaNode);
  const elements: JsonValue[] = [];
  for (let idx = 0;; idx++) {
    const childPath = joinPath(path, String(idx));
    if (!presentAt(params, childPath)) {
      break;
    }
    const decoded = decodeValue(root, items, childPath, params);
    if (!decoded.present) {
      break;
    }
    elements.push(decoded.value);
  }
  // No indexed children: the subtree exists only via a bare marker, so it is [].
  return { present: true, value: elements };
}

function decodeScalar(
  declared: ConcreteType,
  path: string,
  params: URLSearchParams,
): Decoded {
  if (!params.has(path)) {
    return ABSENT;
  }
  const raw = params.get(path) as string;
  return { present: true, value: coerceScalar(raw, declared) };
}

// Coerce a parameter string to its declared scalar type. A string passes through
// and null's only form is the empty marker; every other scalar's canonical form is
// its JSON text, so JSON.parse inverts it. Finer checks (integer vs number, enums,
// patterns) are left to the Ajv validation that runs after decoding.
function coerceScalar(raw: string, declared: ConcreteType): JsonValue {
  if (declared === "string") {
    return raw;
  }
  if (declared === "null") {
    if (raw !== "") {
      throw new Error(`cycle: expected empty value for null, got ${raw}`);
    }
    return null;
  }
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    const shown = raw === "" ? "empty value" : raw;
    throw new Error(`cycle: ${shown} is not a valid ${declared}`);
  }
}
