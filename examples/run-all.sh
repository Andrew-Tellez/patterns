#!/usr/bin/env bash
# Runs every example. Each one asserts its own result, so a non-zero exit means an
# example stopped matching what its SCRIPT.md promises on camera.
#
# The `before` files assert the *wrong* behaviour on purpose: that is the problem
# the video opens with, and it has to keep reproducing.
set -euo pipefail

cd "$(dirname "$0")/.."
failed=0

# Node strips types rather than checking them, so the examples need a real
# typecheck — that is what verifies the @ts-expect-error in 06-observer, whose
# whole point is a compile-time guarantee.
TSC=packages/ts/node_modules/.bin/tsc
if [ -x "$TSC" ]; then
  printf '  %-52s' 'tsc --noEmit -p examples/tsconfig.json'
  if "$TSC" --noEmit -p examples/tsconfig.json >/dev/null 2>&1; then echo 'ok'; else echo 'FAILED'; failed=1; fi
else
  echo '  (skipping typecheck: run npm ci in packages/ts first)'
fi

for file in examples/*/before.ts examples/*/after.ts; do
  printf '  node %-44s' "$file"
  if node "$file" >/dev/null 2>&1; then echo 'ok'; else echo 'FAILED'; failed=1; fi
done

for file in examples/*/before.py examples/*/after.py; do
  printf '  python3 %-41s' "$file"
  if PYTHONPATH=packages/py python3 "$file" >/dev/null 2>&1; then echo 'ok'; else echo 'FAILED'; failed=1; fi
done

# Go and C# examples are whole programs rather than a before/after pair, so they
# run through their own toolchain.
if command -v go >/dev/null 2>&1; then
  for dir in examples/*/go; do
    [ -d "$dir" ] || continue
    printf '  go run %-45s' "./$dir"
    if (cd "$dir" && go run . >/dev/null 2>&1); then echo 'ok'; else echo 'FAILED'; failed=1; fi
  done
fi

if command -v dotnet >/dev/null 2>&1; then
  for dir in examples/*/csharp; do
    [ -d "$dir" ] || continue
    printf '  dotnet run %-42s' "./$dir"
    if (cd "$dir" && dotnet run --verbosity quiet >/dev/null 2>&1); then echo 'ok'; else echo 'FAILED'; failed=1; fi
  done
fi

if [ "$failed" -ne 0 ]; then
  echo
  echo 'An example failed. Run it directly to see why.' >&2
  exit 1
fi

echo
echo 'every example ran and asserted its own result'
