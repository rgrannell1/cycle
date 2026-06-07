// Acceptance test: a shape picker's state in a URL.
//
// State shape:
//   shape — one of circle | triangle | square
//   fill  — a #rrggbb hex colour
//
// The whole flow is: describe the state as a schema, build a codec, round-trip.

import { assertEquals } from "@std/assert";
import { createCodec, type JsonSchema } from "../../src/mod.ts";

const schema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2023-02/schema",
  type: "object",
  additionalProperties: false,
  description: "Appearance of a drawn shape.",
  properties: {
    shape: {
      type: "string",
      enum: ["circle", "triangle", "square"],
      description: "Which shape to draw.",
    },
    fill: {
      type: "string",
      pattern: "^#[0-9a-fA-F]{6}$",
      description: "Fill colour as a #rrggbb hex string.",
    },
  },
};

Deno.test("shape + fill round-trips through the URL", () => {
  const codec = createCodec(schema);

  const state = { shape: "triangle", fill: "#3366ff" };

  // state -> canonical query string (the # is percent-encoded by URLSearchParams)
  const params = codec.encode(state);
  assertEquals(params.toString(), "shape=triangle&fill=%233366ff");

  // ...and straight back to the original state
  assertEquals(codec.decode(params), state);
});
