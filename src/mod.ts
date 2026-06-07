// Public entry point: build a Codec from a JSON Schema.

import { Ajv, type ValidateFunction } from "ajv";
import type { Codec, JsonSchema, StateObject } from "./types.ts";
import { assertAdmissible } from "./schema.ts";
import { toParams } from "./encode.ts";
import { fromParams } from "./decode.ts";

export type { Codec, JsonSchema, JsonValue, StateObject } from "./types.ts";

// Compile a validator and check the schema once, returning the encode/decode pair.
export function createCodec(schema: JsonSchema): Codec {
  assertAdmissible(schema);
  // validateSchema:false skips the meta-schema check; the custom 2023-02 dialect
  // URI is not registered with Ajv and admissibility is already enforced above.
  const ajv = new Ajv({ strict: false, validateSchema: false });
  const validate = ajv.compile(schema);

  return {
    encode(state: StateObject): URLSearchParams {
      assertValid(ajv, validate, state);
      return toParams(schema, state);
    },
    decode(params: string | URLSearchParams): StateObject {
      const search = typeof params === "string" ? new URLSearchParams(params) : params;
      const state = fromParams(schema, search);
      assertValid(ajv, validate, state);
      return state;
    },
  };
}

// Throw a descriptive error when a state object fails schema validation.
function assertValid(
  ajv: Ajv,
  validate: ValidateFunction,
  state: StateObject,
): void {
  if (!validate(state)) {
    throw new Error(`cycle: state does not satisfy schema: ${ajv.errorsText(validate.errors)}`);
  }
}
