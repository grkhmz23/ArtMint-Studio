#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

pnpm --filter @artmint/web exec vitest run \
  src/__tests__/mint-create-routes.test.ts \
  src/__tests__/upload-commit-route.test.ts \
  src/__tests__/mint-completion-routes.test.ts
