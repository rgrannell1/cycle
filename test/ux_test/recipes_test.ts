// Acceptance test: a cookbook in a URL — exercising array handling.
//
// State shape:
//   recipes — a list of { name, ingredients[] }
//
// Two ends of the spectrum: an empty list, and a populated list whose elements
// themselves contain arrays (nested indexing).

import { assertEquals } from "@std/assert";
import { createCodec, type JsonSchema, type StateObject } from "../../src/mod.ts";

const schema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2023-02/schema",
  type: "object",
  additionalProperties: false,
  description: "A cookbook.",
  properties: {
    recipes: {
      type: "array",
      description: "Every recipe in the book.",
      items: {
        type: "object",
        additionalProperties: false,
        description: "A single recipe.",
        properties: {
          name: { type: "string", description: "What the dish is called." },
          ingredients: {
            type: "array",
            description: "Ingredients, in order.",
            items: { type: "string", description: "One ingredient." },
          },
        },
      },
    },
  },
};

interface Scenario {
  name: string;
  state: StateObject;
  params: string;
}

const scenarios: Scenario[] = [
  {
    name: "Nothing — an empty recipe list",
    state: { recipes: [] },
    // An empty array collapses to a single bare marker.
    params: "recipes=",
  },
  {
    name: "Egg & Toast — one recipe with ingredients",
    state: {
      recipes: [
        { name: "Egg & Toast", ingredients: ["egg", "bread", "butter"] },
      ],
    },
    // Nested arrays index by position: recipes.<i>.ingredients.<j>.
    params: "recipes.0.name=Egg+%26+Toast" +
      "&recipes.0.ingredients.0=egg" +
      "&recipes.0.ingredients.1=bread" +
      "&recipes.0.ingredients.2=butter",
  },
  {
    name: "Boiled Water — a populated recipe with an empty inner array",
    state: {
      recipes: [
        { name: "Boiled Water", ingredients: [] },
      ],
    },
    // The inner empty array gets its own bare marker, nested under the element.
    params: "recipes.0.name=Boiled+Water&recipes.0.ingredients=",
  },
  {
    name: "Two recipes — indices distinguish the elements",
    state: {
      recipes: [
        { name: "Tea", ingredients: ["water", "tea"] },
        { name: "Toast", ingredients: ["bread"] },
      ],
    },
    params: "recipes.0.name=Tea" +
      "&recipes.0.ingredients.0=water" +
      "&recipes.0.ingredients.1=tea" +
      "&recipes.1.name=Toast" +
      "&recipes.1.ingredients.0=bread",
  },
];

for (const scenario of scenarios) {
  Deno.test(`recipes round-trip: ${scenario.name}`, () => {
    const codec = createCodec(schema);

    const encoded = codec.encode(scenario.state);
    assertEquals(encoded.toString(), scenario.params);

    assertEquals(codec.decode(encoded), scenario.state);
  });
}
