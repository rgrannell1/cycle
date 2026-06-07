// Table-driven round-trip tests for the codec.
// Each case asserts encode(state) === params (canonical) and decode(params) === state,
// closing both bijection directions.

import { assertEquals, assertThrows } from "@std/assert";
import { createCodec, type JsonSchema, type StateObject } from "../src/mod.ts";

// A schema exercising scalars, nesting, arrays, optionals and a $ref.
const SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2023-02/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string", description: "Free-text search." },
    page: { type: "integer", description: "Page index." },
    ratio: { type: "number", description: "A fractional weight." },
    active: { type: "boolean", description: "Whether the filter is on." },
    nothing: { type: "null", description: "An always-null slot." },
    ids: {
      type: "array",
      description: "Selected identifiers.",
      items: { type: "integer", description: "One identifier." },
    },
    filter: { $ref: "#/$defs/Filter", description: "Nested filter object." },
    tags: {
      type: "array",
      description: "Tag objects.",
      items: { $ref: "#/$defs/Tag", description: "One tag." },
    },
  },
  $defs: {
    Filter: {
      type: "object",
      additionalProperties: false,
      description: "A range filter.",
      properties: {
        min: { type: "number", description: "Lower bound." },
        max: { type: "number", description: "Upper bound." },
      },
    },
    Tag: {
      type: "object",
      additionalProperties: false,
      description: "A labelled tag.",
      properties: {
        name: { type: "string", description: "Tag name." },
      },
    },
  },
};

interface Case {
  name: string;
  state: StateObject;
  params: string;
}

const CASES: Case[] = [
  {
    name: "flat scalars in schema order",
    state: { query: "hello world", page: 2, ratio: 0.5, active: true, nothing: null },
    params: "query=hello+world&page=2&ratio=0.5&active=true&nothing=",
  },
  {
    name: "number canonical form (1.0 -> 1)",
    state: { ratio: 1 },
    params: "ratio=1",
  },
  {
    name: "empty string vs absent",
    state: { query: "" },
    params: "query=",
  },
  {
    name: "array of scalars by index",
    state: { ids: [7, 9] },
    params: "ids.0=7&ids.1=9",
  },
  {
    name: "empty array bare marker",
    state: { ids: [] },
    params: "ids=",
  },
  {
    name: "nested object via $ref",
    state: { filter: { min: 0, max: 10 } },
    params: "filter.min=0&filter.max=10",
  },
  {
    name: "empty nested object bare marker",
    state: { filter: {} },
    params: "filter=",
  },
  {
    name: "array of objects",
    state: { tags: [{ name: "a" }, { name: "b" }] },
    params: "tags.0.name=a&tags.1.name=b",
  },
  {
    name: "everything absent",
    state: {},
    params: "",
  },
];

for (const testCase of CASES) {
  Deno.test(`encode: ${testCase.name}`, () => {
    const codec = createCodec(SCHEMA);
    assertEquals(codec.encode(testCase.state).toString(), testCase.params);
  });

  Deno.test(`decode: ${testCase.name}`, () => {
    const codec = createCodec(SCHEMA);
    assertEquals(codec.decode(testCase.params), testCase.state);
  });

  Deno.test(`round-trip: ${testCase.name}`, () => {
    const codec = createCodec(SCHEMA);
    const encoded = codec.encode(testCase.state);
    assertEquals(codec.decode(encoded), testCase.state);
  });
}

Deno.test("createCodec rejects oneOf combinators", () => {
  assertThrows(
    () =>
      createCodec({
        type: "object",
        additionalProperties: false,
        properties: { mode: { oneOf: [{ type: "string" }] } },
      }),
    Error,
    "oneOf",
  );
});

Deno.test("encode rejects state that violates the schema", () => {
  const codec = createCodec(SCHEMA);
  assertThrows(
    () => codec.encode({ page: "not-an-integer" } as unknown as StateObject),
    Error,
    "does not satisfy schema",
  );
});

Deno.test("decode rejects a malformed integer", () => {
  const codec = createCodec(SCHEMA);
  assertThrows(() => codec.decode("page=abc"), Error);
});
