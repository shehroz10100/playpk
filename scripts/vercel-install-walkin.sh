#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Vercel project for walk-in POS only.
# Drop mobile/Expo from workspaces to avoid uuid/text-encoding conflicts.
node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.workspaces = ['apps/api', 'apps/walkin', 'packages/*'];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
NODE

npm install \
  --workspace=@playpk/walkin \
  --workspace=@playpk/shared-types \
  --include-workspace-root \
  --no-audit \
  --no-fund
