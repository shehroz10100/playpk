#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Vercel hosts ONLY the player/company dashboard.
# Drop mobile + walkin from workspaces so install stays lean and avoids
# Expo/uuid conflicts (and so a failed walkin build cannot block deploy).
node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.workspaces = ['apps/api', 'apps/dashboard', 'packages/*'];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
NODE

# Keep CSS tooling available: Vercel may set production install and omit devDeps.
NPM_CONFIG_PRODUCTION=false npm install \
  --workspace=@playpk/dashboard \
  --workspace=@playpk/shared-types \
  --workspace=@playpk/api \
  --include-workspace-root \
  --include=dev \
  --no-audit \
  --no-fund

# Prisma client for password-reset updates from Vercel when DATABASE_URL is set.
# Dummy URL is only for generate (no DB connection); real DATABASE_URL is used at runtime.
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}" \
  npx prisma generate --schema=apps/api/prisma/schema.prisma
