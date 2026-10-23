#!/bin/sh
set -eu
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "缺少 .env。请复制 .env.example 为 .env 并填好配置。" >&2
  exit 1
fi

docker compose up -d --build --wait
echo "博客端口: ${BLOG_PORT:-8080}"
echo "编辑器端口: ${EDITOR_PORT:-8081}"
