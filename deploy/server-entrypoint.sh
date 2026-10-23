#!/bin/sh
set -eu
cd /app
if [ -n "${BLOG_DIST:-}" ]; then
  pnpm --filter server exec tsx src/publish-blog.ts
fi
exec pnpm --filter server start
