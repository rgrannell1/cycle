// Table-driven tests for the withCompression wrapper: compressed round-trips,
// readable-param fallback, empty state, custom param names and bad payloads.

import { assertEquals, assertThrows } from "@std/assert";
import LZString from "lz-string";
import { createCodec, type JsonSchema, type StateObject, withCompression } from "../src/mod.ts";

// A small schema covering scalars, an array and a nested object.
const SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2023-02/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    content: { type: "string", description: "Free text." },
    ids: {
      type: "array",
      description: "Selected identifiers.",
      items: { type: "integer", description: "One identifier." },
    },
    filter: { $ref: "#/$defs/Filter", description: "Nested filter object." },
  },
  $defs: {
    Filter: {
      type: "object",
      additionalProperties: false,
      description: "A range filter.",
      properties: {
        min: { type: "number", description: "Lower bound." },
      },
    },
  },
};

interface RoundTripCase {
  name: string;
  state: StateObject;
}

const ROUND_TRIP_CASES: RoundTripCase[] = [
  { name: "plain text", state: { content: "hello world" } },
  { name: "unicode and percent sequences", state: { content: "\u{1F308} 100% — %F %H:%M:%S" } },
  { name: "nested and array values", state: { ids: [7, 9], filter: { min: 0.5 } } },
  { name: "empty string leaf", state: { content: "" } },
];

Deno.test("withCompression: state round-trips through the compressed form", () => {
  const codec = withCompression(createCodec(SCHEMA));
  for (const { name, state } of ROUND_TRIP_CASES) {
    const params = codec.encode(state);
    assertEquals([...params.keys()], ["c"], `case: ${name}`);
    assertEquals(codec.decode(params), state, `case: ${name}`);
    assertEquals(codec.decode(params.toString()), state, `case: ${name} (string input)`);
  }
});

Deno.test("withCompression: encode is deterministic (canonical)", () => {
  const codec = withCompression(createCodec(SCHEMA));
  const state: StateObject = { content: "abc", ids: [1] };
  assertEquals(codec.encode(state).toString(), codec.encode(state).toString());
});

Deno.test("withCompression: empty state encodes to no parameters", () => {
  const codec = withCompression(createCodec(SCHEMA));
  const params = codec.encode({});
  assertEquals(params.toString(), "");
  assertEquals(codec.decode(params), {});
});

Deno.test("withCompression: decode falls back to readable canonical params", () => {
  const inner = createCodec(SCHEMA);
  const codec = withCompression(inner);
  const readable = inner.encode({ content: "plain", ids: [3] }).toString();
  assertEquals(codec.decode(readable), { content: "plain", ids: [3] });
});

Deno.test("withCompression: custom param name is honoured", () => {
  const codec = withCompression(createCodec(SCHEMA), { param: "z" });
  const params = codec.encode({ content: "hi" });
  assertEquals([...params.keys()], ["z"]);
  assertEquals(codec.decode(params), { content: "hi" });
});

Deno.test("withCompression: compressed payload matches lz-string of canonical params", () => {
  const inner = createCodec(SCHEMA);
  const codec = withCompression(inner);
  const state: StateObject = { content: "hello", filter: { min: 1 } };
  const expected = LZString.compressToEncodedURIComponent(inner.encode(state).toString());
  assertEquals(codec.encode(state).get("c"), expected);
});

Deno.test("withCompression: an undecompressable payload throws", () => {
  const codec = withCompression(createCodec(SCHEMA));
  assertThrows(
    () => codec.decode("c=%25not-lz"),
    Error,
    "could not decompress",
  );
});
