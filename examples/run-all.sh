#!/usr/bin/env bash
# Runs every example. Each one asserts its own result, so a non-zero exit means an
# example stopped matching what its SCRIPT.md promises on camera.
#
# The `before` files assert the *wrong* behaviour on purpose: that is the problem
# the video opens with, and it has to keep reproducing.
set -euo pipefail

cd "$(dirname "$0")/.."
failed=0

for file in examples/*/before.ts examples/*/after.ts; do
  printf '  node %-44s' "$file"
  if node "$file" >/dev/null 2>&1; then echo 'ok'; else echo 'FAILED'; failed=1; fi
done

for file in examples/*/before.py examples/*/after.py; do
  printf '  python3 %-41s' "$file"
  if PYTHONPATH=packages/py python3 "$file" >/dev/null 2>&1; then echo 'ok'; else echo 'FAILED'; failed=1; fi
done

if [ "$failed" -ne 0 ]; then
  echo
  echo 'An example failed. Run it directly to see why.' >&2
  exit 1
fi

echo
echo 'every example ran and asserted its own result'
