// Opt-in compression wrapper around a Codec. The inner codec's canonical
// parameter string is compressed with lz-string into a single URL-safe
// parameter (default `c`), keeping shared URLs compact. Decoding auto-detects:
// a compressed parameter is decompressed and delegated; anything else is
// treated as readable canonical params, so uncompressed URLs still decode.

import LZString from "lz-string";
import type { Codec, StateObject } from "./types.ts";

// Options for withCompression.
export interface CompressionOptions {
  // Query parameter holding the compressed payload. Must not collide with a
  // top-level schema property name, or readable-param detection misfires.
  param?: string;
}

// The default compressed-payload parameter name.
const DEFAULT_PARAM = "c";

// Wrap a codec so encode emits one compressed parameter and decode accepts
// both the compressed and the readable canonical forms.
export function withCompression(codec: Codec, options?: CompressionOptions): Codec {
  const param = options?.param ?? DEFAULT_PARAM;

  return {
    encode(state: StateObject): URLSearchParams {
      const canonical = codec.encode(state).toString();
      if (canonical === "") {
        return new URLSearchParams();
      }
      const compressed = LZString.compressToEncodedURIComponent(canonical);
      return new URLSearchParams([[param, compressed]]);
    },
    decode(params: string | URLSearchParams): StateObject {
      const search = typeof params === "string" ? new URLSearchParams(params) : params;
      const compressed = search.get(param);
      if (compressed === null) {
        return codec.decode(search);
      }
      const canonical = LZString.decompressFromEncodedURIComponent(compressed);
      if (canonical === null) {
        throw new Error(`cycle: could not decompress the "${param}" parameter`);
      }
      return codec.decode(canonical);
    },
  };
}
