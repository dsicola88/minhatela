#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export ALLOW_REMOTE_MIGRATE="${ALLOW_REMOTE_MIGRATE:-1}"
node scripts/migrate.js
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  node scripts/seed.js || true
fi
exec node src/index.js
