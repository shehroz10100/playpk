#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Drop mobile/Expo from workspaces for Vercel so we never install
# uuid@7 / text-encoding@0.7 (from xcode + react-native-qrcode-svg).
node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.workspaces = ['apps/api', 'apps/dashboard', 'packages/*'];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
NODE

npm install \
  --workspace=@playpk/dashboard \
  --workspace=@playpk/shared-types \
  --include-workspace-root \
  --no-audit \
  --no-fund
