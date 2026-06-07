#!/usr/bin/env zsh
# Run a script against the library (pass a file as $1).
exec deno run --allow-read "${1:-src/mod.ts}"
