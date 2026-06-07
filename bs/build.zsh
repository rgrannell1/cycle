#!/usr/bin/env zsh
# Bundle the library to dist/ with esbuild.
exec deno run -A npm:esbuild src/mod.ts --bundle --format=esm --outfile=dist/cycle.js
