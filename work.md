# Work

## Requirements

The library defines a bijection between URL query parameters and JSON state objects, mediated by a JSON Schema. It exposes two inverse operations: `encode` maps a schema-valid state object to a URL parameter representation, and `decode` maps a URL parameter representation back to the state object.

The schema describes the shape and types of the state. Because URL parameter values are strings, `decode` uses the schema to coerce each value to its declared type. `encode` uses the schema to serialise each typed value to a string.

Round-tripping is lossless for schema-valid input: `decode(encode(state))` equals the original state. The URL representation produced by `encode` is canonical, so `encode(decode(params))` equals `params` for any canonical parameter string.

The project is Deno/TypeScript.

## Design

**Constraints:**
- Deno/TypeScript; esbuild in `bs/`; lint plugin for no-single-letter-vars + max-line-length.
- JSON Schema dialect `https://json-schema.org/draft/2023-02/schema`; all types in `$defs`, `additionalProperties: false`, descriptions everywhere.

**Decisions:**
- API: a `createCodec(schema)` factory returning a `Codec` with `encode(state): URLSearchParams` (state → params) and `decode(params: string | URLSearchParams): state` (params → state). `createCodec` runs `assertAdmissible` and compiles Ajv once. (Supersedes the earlier `new Codec().to()/.from()` sketch — the factory + `encode`/`decode` shape is what shipped.)
- Admissible schemas: every leaf has one concrete type (string, number, integer, boolean, null) or is an array/object of concrete leaves. No `oneOf`/`anyOf`/unions/missing-`type` — constructor rejects these.
- Optional properties allowed. Required properties allowed. Validation via Ajv (`npm:ajv`), compiled once.
- Flattening: dotted paths. `{a:{b:1}}` → `a.b=1`; arrays via numeric index `ids.0=7&ids.1=9`.
- Canonical form: `to` emits params in schema property order (depth-first). `to(from(p)) === p` holds only for canonical `p`.
- Number canonical form: `String(n)` ↔ `Number(s)` (so `1.0`→`1`), validated by Ajv after decode.

**Emptiness / optionality encoding** (no reserved sentinel — schema type at each path disambiguates a bare `path=`):
- absent optional → no param mentioning the path.
- present-but-leafless (`""`, `null`, `[]`, `{}`) → a bare `path=`; the schema's concrete type at that path decides which.
- present non-empty array/object → descendant leaves only (`path.0=…`, `path.a=…`), no bare `path=`.
- `path=` under a number/boolean/integer path is invalid → Ajv rejects.

**Module layout:**
- `src/types.ts` — public types + `Codec` interface. ✓
- `src/mod.ts` — entry point + re-exports. ✓ (skeleton)
- `src/schema.ts` — `$ref`→`$defs` resolution, schema admissibility check, path→type lookup. ✓
- `src/encode.ts` — `toParams` (state → params). ✓
- `src/decode.ts` — `fromParams` (params → state, schema-driven coercion). ✓
- `test/codec_test.ts` — table-driven encode/decode/round-trip tests. ✓

**Sequence:** 1 scaffold ✓ · 2 schema walker ✓ · 3 `encode` ✓ · 4 `decode` ✓ · 5 table tests ✓ — feature-complete, 30 tests green.

**Ajv note:** compiled with `{ strict: false, validateSchema: false }` — the custom `draft/2023-02` `$schema` URI is not a meta-schema Ajv ships, so meta-validation is skipped; admissibility is enforced separately by `assertAdmissible`.

## Snags
