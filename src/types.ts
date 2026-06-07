// Public type definitions shared across the codec.

// A JSON Schema document (draft 2023-02). Kept structural; we read it dynamically.
export type JsonSchema = Record<string, unknown>;

// Any value expressible in JSON.
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

// The decoded state: a JSON object keyed by property name.
export type StateObject = { [key: string]: JsonValue };

// A bijection between a schema-valid state object and its canonical URL parameters.
export interface Codec {
  // Serialise a schema-valid state to canonical URL parameters.
  encode(state: StateObject): URLSearchParams;
  // Parse URL parameters back to the state object, coercing by schema type.
  decode(params: string | URLSearchParams): StateObject;
}
